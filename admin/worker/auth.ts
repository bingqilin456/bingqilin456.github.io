import { z } from "zod";
import type { SessionView } from "#shared/contracts";
import type { WorkerEnv } from "#worker/env";
import { getSetupStatus } from "#worker/env";
import { AppError, jsonResponse } from "#worker/errors";
import { githubRequest, repositoryBase } from "#worker/github";
import { randomId, challenge, signValue, verifyValue, encryptValue, decryptValue } from "#worker/crypto";
const pendingSchema=z.object({state:z.string(),verifier:z.string(),expiresAt:z.number()});
const cookieSchema=z.object({id:z.string(),expiresAt:z.number()});
const sessionSchema=z.object({id:z.string(),user:z.object({login:z.string(),avatarUrl:z.string()}),csrfToken:z.string(),expiresAt:z.number(),token:z.string(),repository:z.string(),branch:z.string()});
export type AuthenticatedSession=z.infer<typeof sessionSchema>;
function cookie(request:Request,name:string):string {
 const values=request.headers.get("Cookie") || "";
 return values.split(";").map(value=>value.trim()).find(value=>value.startsWith(name+"="))?.slice(name.length+1) || "";
}
function settings(env:WorkerEnv):{origin:string;secret:string} {
 if(!getSetupStatus(env).configured || !env.APP_ORIGIN || !env.SESSION_SECRET) throw new AppError(503,"NOT_CONFIGURED","后台尚未连接 GitHub，请先完成连接设置。");
 return {origin:env.APP_ORIGIN,secret:env.SESSION_SECRET};
}
export function authCookie(name:string,value:string,env:WorkerEnv,maxAge:number):string {
 const secure=env.APP_ORIGIN?.startsWith("https:") ? "; Secure" : "";
 return name+"="+value+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+maxAge+secure;
}
function redirect(location:string,cookies:readonly string[]):Response {
 const headers=new Headers({Location:location,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"});
 for(const value of cookies) headers.append("Set-Cookie",value);
 return new Response(null,{status:302,headers});
}
export async function beginLogin(request:Request,env:WorkerEnv):Promise<Response> {
 const {origin,secret}=settings(env),state=randomId(),verifier=randomId();
 if(new URL(request.url).origin!==origin) throw new AppError(403,"INVALID_ORIGIN","请从后台的正式地址登录。");
 const pending=await signValue({state,verifier,expiresAt:Date.now()+600_000},secret);
 const url=new URL("https://github.com/login/oauth/authorize");
 url.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID || "",redirect_uri:origin+"/api/auth/callback",scope:"public_repo",state,code_challenge:await challenge(verifier),code_challenge_method:"S256",allow_signup:"false"}).toString();
 return redirect(url.toString(),[authCookie("bql_oauth",pending,env,600)]);
}
export async function finishLogin(request:Request,env:WorkerEnv,fetcher:typeof fetch=fetch):Promise<Response> {
 const {origin,secret}=settings(env),url=new URL(request.url);
 let pending:z.infer<typeof pendingSchema>;
 try { pending=await verifyValue(cookie(request,"bql_oauth"),secret,pendingSchema); }
 catch { throw new AppError(400,"INVALID_STATE","登录校验失效，请重新开始登录。"); }
 if(pending.expiresAt<=Date.now() || pending.state!==url.searchParams.get("state") || !url.searchParams.get("code") || url.origin!==origin) throw new AppError(400,"INVALID_STATE","登录校验过期或不匹配，请重新登录。");
 let exchanged:Response;
 try { exchanged=await fetcher("https://github.com/login/oauth/access_token",{method:"POST",signal:AbortSignal.timeout(20000),headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get("code"),redirect_uri:origin+"/api/auth/callback",code_verifier:pending.verifier})}); }
 catch { throw new AppError(502,"OAUTH_UNAVAILABLE","GitHub 登录服务暂时无法连接。"); }
 const tokenResult=z.object({access_token:z.string().min(1),expires_in:z.number().positive().optional(),scope:z.string().optional()}).safeParse(exchanged.ok ? await exchanged.json() : null);
 if(!tokenResult.success) throw new AppError(401,"OAUTH_FAILED","GitHub 授权未完成，请重新登录。");
 const token=tokenResult.data.access_token;
 const user=await githubRequest(token,"/user",z.object({login:z.string(),avatar_url:z.string()}),{},fetcher);
 const allowed=(env.ALLOWED_GITHUB_USERS || "bingqilin456").split(",").map(name=>name.trim().toLowerCase());
 if(!allowed.includes(user.login.toLowerCase())) throw new AppError(403,"USER_NOT_ALLOWED","该 GitHub 账号不在管理员名单中。");
 const repository=await githubRequest(token,repositoryBase(env),z.object({private:z.boolean(),permissions:z.object({push:z.boolean()})}),{},fetcher);
 if(repository.private || !repository.permissions.push) throw new AppError(403,"NO_PUSH_ACCESS","后台仅支持有写入权限的公开博客仓库。");
 const ttl=Math.min(28800,Math.floor(tokenResult.data.expires_in || 28800));
 if(ttl<1 || !env.SESSIONS) throw new AppError(401,"TOKEN_EXPIRED","GitHub 授权已过期，请重新登录。");
 const session:AuthenticatedSession={id:randomId(),user:{login:user.login,avatarUrl:user.avatar_url},csrfToken:randomId(),expiresAt:Date.now()+ttl*1000,token,repository:repositoryBase(env),branch:env.GITHUB_BRANCH || "master"};
 await env.SESSIONS.put("session:"+session.id,await encryptValue(session,secret),{expirationTtl:Math.max(ttl,60)});
 const old=cookie(request,"bql_session");
 if(old) { try { const previous=await verifyValue(old,secret,cookieSchema); await env.SESSIONS.delete("session:"+previous.id); } catch { /* Old invalid cookies are replaced. */ } }
 return redirect(origin+"/",[authCookie("bql_oauth","",env,0),authCookie("bql_session",await signValue({id:session.id,expiresAt:session.expiresAt},secret),env,ttl)]);
}
export async function requireSession(request:Request,env:WorkerEnv):Promise<AuthenticatedSession> {
 const denied=():AppError=>new AppError(401,"UNAUTHENTICATED","会话已过期，请使用管理员 GitHub 账号登录。");
 if(!env.SESSIONS || !env.SESSION_SECRET || !getSetupStatus(env).configured) throw denied();
 try {
  const view=await verifyValue(cookie(request,"bql_session"),env.SESSION_SECRET,cookieSchema);
  if(view.expiresAt<=Date.now()) throw denied();
  const stored=await env.SESSIONS.get("session:"+view.id);
  if(!stored) throw denied();
  const session=await decryptValue(stored,env.SESSION_SECRET,sessionSchema);
  const allowed=(env.ALLOWED_GITHUB_USERS || "bingqilin456").split(",").map(value=>value.trim().toLowerCase());
  if(session.id!==view.id || session.expiresAt<=Date.now() || !allowed.includes(session.user.login.toLowerCase()) || session.repository!==repositoryBase(env) || session.branch!==(env.GITHUB_BRANCH || "master")) throw denied();
  return session;
 } catch { throw denied(); }
}
export function sessionView(session:AuthenticatedSession):SessionView {
 return {user:session.user,csrfToken:session.csrfToken,expiresAt:session.expiresAt};
}
export function assertWriteRequest(request:Request,session:AuthenticatedSession,env:WorkerEnv):void {
 if(request.headers.get("Origin")!==env.APP_ORIGIN || request.headers.get("X-CSRF-Token")!==session.csrfToken) throw new AppError(403,"CSRF_REJECTED","写入校验失败，请刷新后台后重试。");
}
export async function logout(request:Request,env:WorkerEnv):Promise<Response> {
 const session=await requireSession(request,env); assertWriteRequest(request,session,env);
 await env.SESSIONS?.delete("session:"+session.id);
 const response=jsonResponse({ok:true});
 response.headers.append("Set-Cookie",authCookie("bql_session","",env,0));
 return response;
}


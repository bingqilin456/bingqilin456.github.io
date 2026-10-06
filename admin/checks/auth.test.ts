import assert from "node:assert/strict";
import test from "node:test";
import { beginLogin, finishLogin, requireSession, assertWriteRequest, logout, sessionView } from "#worker/auth";
import { signValue } from "#worker/crypto";
import type { WorkerEnv } from "#worker/env";
function fixture(): {env:WorkerEnv;storage:Map<string,string>} {
 const storage=new Map<string,string>();
 return {storage,env:{GITHUB_OWNER:"owner",GITHUB_REPO:"blog",GITHUB_CLIENT_ID:"id",GITHUB_CLIENT_SECRET:"secret",APP_ORIGIN:"https://admin.example.com",SESSION_SECRET:"x".repeat(40),ALLOWED_GITHUB_USERS:"admin",SESSIONS:{async get(key){return storage.get(key)||null},async put(key,value){storage.set(key,value)},async delete(key){storage.delete(key)}}}};
}
function mock(login="admin",push=true):typeof fetch { return async input => {
 const url=String(input);
 return Response.json(url.includes("access_token") ? {access_token:"private-test-token",token_type:"bearer",scope:"public_repo"} : url.endsWith("/user") ? {login,avatar_url:"https://github.com/avatar.png"} : {private:false,permissions:{push}});
};}
async function login(env:WorkerEnv,fetcher:typeof fetch):Promise<Response> {
 const start=await beginLogin(new Request(env.APP_ORIGIN+"/api/auth/login"),env);
 const state=new URL(start.headers.get("Location")||"").searchParams.get("state");
 return finishLogin(new Request(env.APP_ORIGIN+"/api/auth/callback?code=test&state="+state,{headers:{Cookie:(start.headers.get("Set-Cookie")||"").split(";")[0]}}),env,fetcher);
}
test("state 篡改、过期、非白名单、无写权限拒绝",async () => {
 const {env}=fixture();
 await assert.rejects(finishLogin(new Request(env.APP_ORIGIN+"/api/auth/callback?state=bad&code=x",{headers:{Cookie:"bql_oauth=broken"}}),env,mock()),{status:400});
 const expired=await signValue({state:"state",verifier:"verifier",expiresAt:Date.now()-1},env.SESSION_SECRET||"");
 await assert.rejects(finishLogin(new Request(env.APP_ORIGIN+"/api/auth/callback?state=state&code=x",{headers:{Cookie:"bql_oauth="+expired}}),env,mock()),{status:400});
 await assert.rejects(login(env,mock("intruder")),{status:403});
 await assert.rejects(login(env,mock("admin",false)),{status:403});
});
test("登录 cookie 安全，KV 不含明文 token，CSRF 与 Origin 校验，退出移除会话",async () => {
 const {env,storage}=fixture(),response=await login(env,mock());
 const cookie=response.headers.getSetCookie().find(value=>value.startsWith("bql_session="))||"";
 for(const attribute of ["HttpOnly","Secure","SameSite=Lax"]) assert.ok(cookie.includes(attribute));
 assert.ok(![...storage.values()].some(value=>value.includes("private-test-token")));
 const req=new Request(env.APP_ORIGIN+"/api/post",{method:"POST",headers:{Cookie:cookie.split(";")[0],Origin:env.APP_ORIGIN||""}});
 const session=await requireSession(req,env);
 const expiredSession=await signValue({id:session.id,expiresAt:Date.now()-1},env.SESSION_SECRET || "");
 await assert.rejects(requireSession(new Request(req,{headers:{Cookie:"bql_session="+expiredSession}}),env),{status:401});
 assert.ok(!JSON.stringify(sessionView(session)).includes("private-test-token"));
 assert.throws(()=>assertWriteRequest(req,session,env),{status:403});
 const good=new Request(req,{headers:{Cookie:cookie.split(";")[0],Origin:env.APP_ORIGIN||"","X-CSRF-Token":session.csrfToken}});
 assertWriteRequest(good,session,env);
 assert.throws(()=>assertWriteRequest(new Request(good,{headers:{Origin:"https://evil.example","X-CSRF-Token":session.csrfToken}}),session,env),{status:403});
 await logout(good,env);
 await assert.rejects(requireSession(req,env),{status:401});
});


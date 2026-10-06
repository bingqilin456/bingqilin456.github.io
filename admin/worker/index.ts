import { z } from "zod";
import type { WorkerEnv } from "#worker/env";
import { getSetupStatus } from "#worker/env";
import { AppError, errorResponse, jsonResponse } from "#worker/errors";
import { beginLogin, finishLogin, logout, requireSession, sessionView, assertWriteRequest, authCookie } from "#worker/auth";
import { createRepository } from "#worker/repository";
import { listPosts, loadPost, savePost, deletePost, changeTaxonomy } from "#worker/content-service";
import { uploadImage, listImages, serveImage } from "#worker/media";
import { listDeployments, checkConnection } from "#worker/publishing";
import { boundedBody, jsonInput } from "#worker/request-body";
import { savePostSchema, taxonomySchema } from "#shared/post-schema";
export async function handleRequest(request:Request,env:WorkerEnv):Promise<Response> {
 const url=new URL(request.url),route=url.pathname,method=request.method;
 try {
  if(route==="/api/setup" && method==="GET")return jsonResponse(getSetupStatus(env));
  if(route==="/api/auth/login" && method==="GET")return await beginLogin(request,env);
  if(route==="/api/auth/callback" && method==="GET")return await finishLogin(request,env);
  if(route==="/api/auth/logout" && method==="POST")return await logout(request,env);
  if(route.startsWith("/api/")){
   const session=await requireSession(request,env);
   if(method!=="GET")assertWriteRequest(request,session,env);
   if(route==="/api/session" && method==="GET")return jsonResponse(sessionView(session));
   const repo=createRepository(env,session.token);
   if(route==="/api/posts" && method==="GET")return jsonResponse(await listPosts(repo));
   if(route==="/api/post" && method==="GET")return jsonResponse(await loadPost(repo,url.searchParams.get("path") || ""));
   if(route==="/api/post" && method==="POST")return jsonResponse(await savePost(repo,await jsonInput(request,savePostSchema)));
   if(route==="/api/post" && method==="DELETE"){
    const input=await jsonInput(request,z.object({path:z.string(),expectedSha:z.string().min(1)}));
    return jsonResponse(await deletePost(repo,input.path,input.expectedSha));
   }
   if(route==="/api/taxonomy" && method==="POST")return jsonResponse(await changeTaxonomy(repo,await jsonInput(request,taxonomySchema)));
   if(route==="/api/media" && method==="GET")return jsonResponse(await listImages(repo));
   if(route==="/api/media" && method==="POST"){
    if(!request.headers.get("Content-Type")?.startsWith("multipart/form-data"))throw new AppError(415,"CONTENT_TYPE","请使用图片上传表单。");
    const bytes=await boundedBody(request,5*1024*1024+65536);
    let form:FormData;
    try{form=await new Response(bytes,{headers:{"Content-Type":request.headers.get("Content-Type") || ""}}).formData();}catch{throw new AppError(400,"INVALID_UPLOAD","图片上传格式无效。");}
    const file=form.get("file");if(!(file instanceof File))throw new AppError(400,"MISSING_IMAGE","请选择图片。");
    return jsonResponse(await uploadImage(repo,file));
   }
   if(route==="/api/media/file" && method==="GET")return await serveImage(repo,url.searchParams.get("path") || "");
   if(route==="/api/deployments" && method==="GET")return jsonResponse(await listDeployments(repo,20));
   if(route==="/api/connection" && method==="GET")return jsonResponse(await checkConnection(repo));
   throw new AppError(404,"ROUTE_NOT_FOUND","接口不存在。");
  }
  if(route==="/api")throw new AppError(404,"ROUTE_NOT_FOUND","接口不存在。");
  return env.ASSETS ? await env.ASSETS.fetch(request) : new Response("请先运行 pnpm build。",{status:503});
 }catch(error){
  if(route==="/api/auth/callback" && env.APP_ORIGIN){
   const location=new URL("/login",env.APP_ORIGIN);location.searchParams.set("error",error instanceof AppError ? error.code : "OAUTH_FAILED");
   return new Response(null,{status:302,headers:{"Location":location.toString(),"Cache-Control":"no-store","Referrer-Policy":"no-referrer","Set-Cookie":authCookie("bql_oauth","",env,0)}});
  }
  return errorResponse(error);
 }
}
export default {fetch:handleRequest};

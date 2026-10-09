import { z } from "zod";
import type { WorkerEnv } from "#worker/env";
import { getSetupStatus } from "#worker/env";
import { AppError, errorResponse, jsonResponse } from "#worker/errors";
import { beginLogin, finishLogin, logout, requireSession, sessionView, assertWriteRequest, authCookie } from "#worker/auth";
import { createRepository } from "#worker/repository";
import { listPosts, loadPost, savePost, deletePost, changeTaxonomy } from "#worker/content-service";
import { uploadImage, listImages, serveImage } from "#worker/media";
import { listDeployments, checkConnection } from "#worker/publishing";
import { jsonInput, imageUploadFile } from "#worker/request-body";
import { savePostSchema, taxonomySchema } from "#shared/post-schema";
import { loadGallery, saveGallery, loadTools, saveTools } from "#worker/managed-content";
import { saveGallerySchema, saveToolsSchema, albumIdSchema } from "#shared/managed-schema";
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
   if(route==="/api/gallery" && method==="GET")return jsonResponse(await loadGallery(repo));
   if(route==="/api/gallery" && method==="POST")return jsonResponse(await saveGallery(repo,await jsonInput(request,saveGallerySchema)));
   if(route==="/api/tools" && method==="GET")return jsonResponse(await loadTools(repo));
   if(route==="/api/tools" && method==="POST")return jsonResponse(await saveTools(repo,await jsonInput(request,saveToolsSchema)));
   if(route==="/api/gallery/image" && method==="GET")return await serveImage(repo,url.searchParams.get("path") || "","gallery-image");
   if(route==="/api/gallery/image" && method==="POST"){
    const albumId=albumIdSchema.safeParse(url.searchParams.get("album"));
    if(!albumId.success)throw new AppError(400,"INVALID_ALBUM","相册标识无效。");
    const result=await uploadImage(repo,await imageUploadFile(request),albumId.data);
    return jsonResponse({src:result.item.path.slice("public".length),commit:result.commit});
   }
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
    return jsonResponse(await uploadImage(repo,await imageUploadFile(request)));
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

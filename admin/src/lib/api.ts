import type { ZodType } from "zod";
import { failureSchema } from "@shared/api-schema";
let csrfToken="";
export function setCsrfToken(value:string):void {csrfToken=value;}
export class ApiError extends Error {
 status:number;code:string;requestId:string;retryAt?:number;
 constructor(status:number,code:string,message:string,requestId="",retryAt?:number){super(message);this.status=status;this.code=code;this.requestId=requestId;this.retryAt=retryAt;}
}
export async function apiRequest<T>(path:string,schema:ZodType<T>,init:RequestInit={}):Promise<T> {
 const headers=new Headers(init.headers),method=init.method || "GET";
 if(method!=="GET")headers.set("X-CSRF-Token",csrfToken);
 if(init.body && !(init.body instanceof FormData))headers.set("Content-Type","application/json");
 let response:Response;
 try{response=await fetch(path,{...init,headers,credentials:"same-origin",signal:init.signal || AbortSignal.timeout(120000)});}
 catch(error){if(error instanceof Error && error.name==="AbortError")throw error;throw new ApiError(0,"NETWORK","网络连接失败，请检查连接后重试。");}
 let value:unknown;try{value=await response.json();}catch{throw new ApiError(response.status,"API_UNAVAILABLE","后台接口未启动或返回异常，请检查连接设置。");}
 if(!response.ok){
  const parsed=failureSchema.safeParse(value);
  if(response.status===401)window.dispatchEvent(new Event("bql-session-expired"));
  if(parsed.success)throw new ApiError(response.status,parsed.data.error.code,parsed.data.error.message,parsed.data.error.requestId,parsed.data.error.retryAt);
  throw new ApiError(response.status,"REQUEST_FAILED","请求未完成，请重试。");
 }
 const parsed=schema.safeParse(value);
 if(!parsed.success)throw new ApiError(502,"INVALID_RESPONSE","后台数据格式异常，请更新后台后重试。");
 return parsed.data;
}
export function safeLink(value:string|null|undefined):string|undefined {
 if(!value)return undefined;try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.toString():undefined;}catch{return undefined;}
}


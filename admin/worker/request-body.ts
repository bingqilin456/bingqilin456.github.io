import { z } from "zod";
import { AppError } from "#worker/errors";
export async function boundedBody(request:Request,limit:number):Promise<Uint8Array<ArrayBuffer>> {
 if(Number(request.headers.get("Content-Length"))>limit)throw new AppError(413,"BODY_TOO_LARGE","提交内容超过大小限制。");
 const reader=request.body?.getReader();if(!reader)throw new AppError(400,"EMPTY_BODY","请求内容不能为空。");
 const parts:Uint8Array[]=[],deadline=Date.now()+30000;let size=0;
 try {
  for(;;){const {value,done}=await reader.read();if(done)break;if(Date.now()>deadline)throw new AppError(408,"BODY_TIMEOUT","上传超时，请重试。");size+=value.length;if(size>limit)throw new AppError(413,"BODY_TOO_LARGE","提交内容超过大小限制。");parts.push(value);}
 }catch(error){await reader.cancel();throw error;}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
export async function jsonInput<T>(request:Request,schema:z.ZodType<T>):Promise<T> {
 if(!request.headers.get("Content-Type")?.includes("application/json"))throw new AppError(415,"CONTENT_TYPE","请使用 JSON 提交数据。");
 const body=await boundedBody(request,3_000_000);
 let value:unknown;try{value=JSON.parse(new TextDecoder().decode(body));}catch{throw new AppError(400,"INVALID_JSON","提交内容不是有效 JSON。");}
 const parsed=schema.safeParse(value);
 if(!parsed.success)throw new AppError(400,"INVALID_FIELDS","字段验证失败："+parsed.error.issues.map(issue=>issue.path.join(".")+": "+issue.message).slice(0,3).join("；"));
 return parsed.data;
}


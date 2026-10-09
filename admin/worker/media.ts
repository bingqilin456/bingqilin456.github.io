import type { Repository, MediaItem, CommitReceipt } from "#shared/contracts";
import { assertContentPath } from "#shared/paths";
import { AppError } from "#worker/errors";
import { albumIdSchema } from "#shared/managed-schema";
const MAX_SIZE=5*1024*1024;
const extensions:Record<string,string>={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",avif:"image/avif",gif:"image/gif"};
export function imageMime(path:string):string { return extensions[path.split(".").pop()?.toLowerCase() || ""] || ""; }
function detected(bytes:Uint8Array):string {
 const starts=(values:number[]):boolean=>values.every((value,index)=>bytes[index]===value);
 const text=(start:number,end:number):string=>new TextDecoder().decode(bytes.slice(start,end));
 if(starts([137,80,78,71,13,10,26,10]))return "image/png";
 if(starts([255,216,255]))return "image/jpeg";
 if(text(0,6)==="GIF87a" || text(0,6)==="GIF89a")return "image/gif";
 if(text(0,4)==="RIFF" && text(8,12)==="WEBP")return "image/webp";
 if(text(4,8)==="ftyp" && (text(8,12)==="avif" || text(8,12)==="avis" || text(16,32).includes("avif")))return "image/avif";
 return "";
}
export async function listImages(repo:Repository):Promise<MediaItem[]> {
 return (await repo.listFiles()).filter(file=>{
  try{assertContentPath(file.path,"image");return ["100644","100755"].includes(file.mode);}catch{return false;}
 }).map(file=>({path:file.path,sha:file.sha,name:file.path.split("/").pop() || file.path,size:file.size}));
}
export async function uploadImage(repo:Repository,file:File,albumId?:string):Promise<{item:MediaItem;commit:CommitReceipt}> {
 if(albumId!==undefined && !albumIdSchema.safeParse(albumId).success)throw new AppError(400,"INVALID_ALBUM","相册标识无效。");
 if(!file.size || file.size>MAX_SIZE)throw new AppError(413,"IMAGE_SIZE","图片必须大于 0 且不超过 5 MB。");
 const extension=file.name.split(".").pop()?.toLowerCase() || "";
 const bytes=new Uint8Array(await file.arrayBuffer()),mime=extensions[extension];
 if(!mime || mime!==detected(bytes) || (file.type && file.type!==mime))throw new AppError(400,"IMAGE_TYPE","仅支持文件头匹配的 PNG、JPEG、WebP、AVIF 或 GIF 图片。");
 const name=new Date().toISOString().slice(0,10)+"-"+crypto.randomUUID()+"."+extension,path=albumId===undefined?"src/content/posts/assets/"+name:"public/gallery/"+albumId+"/"+name;
 const commit=await repo.commit([{path,expectedSha:null,content:bytes}],"上传图片："+name);
 return {item:{path,sha:"",name,size:file.size},commit};
}
export async function serveImage(repo:Repository,path:string,kind:"image"|"gallery-image"="image"):Promise<Response> {
 try{assertContentPath(path,kind);}catch{throw new AppError(400,"INVALID_PATH","图片路径无效。");}
 const bytes=await repo.readBytes(path),mime=imageMime(path);
 if(detected(bytes)!==mime)throw new AppError(400,"IMAGE_TYPE","图片内容与扩展名不匹配。");
 return new Response(new Uint8Array(bytes),{headers:{"Content-Type":mime,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
}


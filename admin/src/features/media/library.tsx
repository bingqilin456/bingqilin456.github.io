import { useEffect,useRef,useState } from "react";
import { Upload, ImagePlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, ConnectionGate, ErrorNotice, Loading, Empty, CommitNotice } from "@/components/page";
import { useResource } from "@/lib/use-resource";
import { apiRequest } from "@/lib/api";
import { imagesSchema,uploadSchema } from "@shared/api-schema";
import type { MediaItem, CommitReceipt } from "@shared/contracts";
export function MediaLibrary({onSelect}:{onSelect?:(item:MediaItem)=>void}):React.JSX.Element {
 const {data:images,error,loading,reload}=useResource("/api/media",imagesSchema),[busy,setBusy]=useState(false),[writeError,setWriteError]=useState<Error|null>(null),[receipt,setReceipt]=useState<CommitReceipt|null>(null);
 const uploadRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>uploadRequest.current?.abort(),[]);
 async function upload(file:File|undefined):Promise<void>{
  if(!file)return;setWriteError(null);
  if(!file.size || file.size>5*1024*1024){setWriteError(new Error("请选择大于 0 且不超过 5 MB 的图片。"));return;}
  const form=new FormData();form.append("file",file);setBusy(true);
  const controller=new AbortController();uploadRequest.current=controller;
  try{const result=await apiRequest("/api/media",uploadSchema,{method:"POST",body:form,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])});if(controller.signal.aborted)return;setReceipt(result.commit);if(onSelect)onSelect(result.item);else reload();}
  catch(reason){if(!controller.signal.aborted)setWriteError(reason instanceof Error?reason:new Error("上传失败"));}finally{if(!controller.signal.aborted)setBusy(false);uploadRequest.current=null;}
 }
 return <><div className="upload-zone"><div className="empty-icon"><ImagePlus size={24}/></div><div><strong>给文章添一张配图</strong><p>PNG / JPEG / WebP / AVIF / GIF，每张不超过 5 MB</p></div><label className="upload-button"><span><Upload size={16}/>{busy?"正在上传…":"选择图片上传"}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" disabled={busy} aria-label="上传图片" onChange={event=>{const file=event.target.files?.[0];event.target.value="";void upload(file);}}/></label></div>{busy && <div className="upload-progress" role="status"><progress aria-label="正在上传图片"/>正在上传并保存到 GitHub，请稍候…</div>}<ErrorNotice error={error} retry={reload}/><ErrorNotice error={writeError}/>{receipt && <CommitNotice {...receipt}/>}<div className="media-heading"><small>{images?images.length+" 张图片":"图片素材"}</small><Button size="sm" variant="outline" onClick={reload} disabled={busy || loading}>刷新</Button></div>{loading?<Loading/>:images?.length?<div className="media-grid">{images.map(item=><button type="button" className="media-card" key={item.path} disabled={busy} onClick={()=>onSelect?.(item)} aria-label={"选择图片 "+item.name}><div className="media-preview"><img src={"/api/media/file?path="+encodeURIComponent(item.path)} alt={item.name} loading="lazy"/></div><div className="media-caption"><strong title={item.name}>{item.name}</strong><small>{(item.size/1024).toFixed(1)} KB</small>{onSelect && <Check size={15}/>}</div></button>)}</div>:!error && <Empty title="图片库还是空的" description="上传图片后，可以将它用作封面或插入文章。"/>}<p className="info-note">图片存于文章 assets 目录，使用相对引用进入博客现有图片优化流程。上传也会创建 GitHub 提交；此处不提供图片删除。</p></>;
}


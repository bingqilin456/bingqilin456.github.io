import { useState } from "react";
import { Copy } from "lucide-react";
import { MediaLibrary } from "@/features/media/library";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader,ConnectionGate,ErrorNotice } from "@/components/page";
import type { MediaItem } from "@shared/contracts";
import { imageReference } from "@shared/paths";
export function MediaPage():React.JSX.Element {
 const [item,setItem]=useState<MediaItem|null>(null),[path,setPath]=useState(""),[copied,setCopied]=useState(false),[error,setError]=useState<Error|null>(null);
 let reference="";
 try{if(item && path)reference=imageReference("src/content/posts/"+path,item.path);}catch{/* Explain invalid input without interpreting it. */}
 async function copy():Promise<void>{try{await navigator.clipboard.writeText("![图片]("+reference+")");setCopied(true);}catch{setError(new Error("复制失败，请手动选中引用文本复制。"));}}
 return <><PageHeader eyebrow="VISUAL LIBRARY" title="图片管理" description="为文字添上画面，把素材整理在同一个地方。"/><ConnectionGate><section className="panel media-panel"><MediaLibrary onSelect={selected=>{setItem(selected);setCopied(false);setError(null);}}/></section></ConnectionGate><Dialog open={Boolean(item)} onOpenChange={open=>{if(!open)setItem(null);}}><DialogContent><DialogTitle>复制图片引用</DialogTitle><DialogDescription>输入这张图片要插入的文章路径，生成正确的相对引用。</DialogDescription>{item && <img className="image-detail" src={"/api/media/file?path="+encodeURIComponent(item.path)} alt={item.name}/>}<label className="field-label">文章路径（相对 src/content/posts/）<Input value={path} onChange={event=>{setPath(event.target.value);setCopied(false);}} placeholder="生活/记录.md"/></label><code className="block-code">{reference?"![图片]("+reference+")":"输入有效的 .md 或 .mdx 文章路径"}</code><ErrorNotice error={error}/><Button disabled={!reference} onClick={()=>void copy()}><Copy size={16}/>{copied?"已复制":"复制 Markdown 引用"}</Button></DialogContent></Dialog></>;
}


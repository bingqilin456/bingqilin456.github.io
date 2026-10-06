import { marked } from "marked";
import DOMPurify from "dompurify";
import { assertContentPath } from "@shared/paths";
import { safeLink } from "@/lib/api";
export function renderPreview(markdown:string,postPath?:string,blogUrl?:string|null):string {
 const html=DOMPurify.sanitize(marked.parse(markdown,{async:false}),{FORBID_TAGS:["iframe","form","style","svg","math"],FORBID_ATTR:["style"]});
 const doc=new DOMParser().parseFromString(html,"text/html");
 for(const image of doc.querySelectorAll("img")){
  const source=image.getAttribute("src") || "";
  if(/^https?:\/\//.test(source))continue;
  if(source.startsWith("/") && safeLink(blogUrl)){image.src=new URL(source,blogUrl || "").toString();continue;}
  if(postPath && source && !source.startsWith("/")){
   try{const path=decodeURIComponent(new URL(source,"https://content.invalid/"+postPath).pathname.slice(1));assertContentPath(path,"image");image.src="/api/media/file?path="+encodeURIComponent(path);continue;}catch{/* Unresolvable local images have a visible fallback. */}
  }
  image.removeAttribute("src");image.alt=image.alt || "本地图片：发布后查看";
 }
 for(const link of doc.querySelectorAll("a")){link.setAttribute("target","_blank");link.setAttribute("rel","noopener noreferrer");}
 return DOMPurify.sanitize(doc.body.innerHTML,{FORBID_TAGS:["iframe","form","style","svg","math"],FORBID_ATTR:["style"]});
}


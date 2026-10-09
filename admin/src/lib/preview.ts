import { marked } from "marked";
import DOMPurify from "dompurify";
import { imagePreviewSource } from "@shared/paths";
export function renderPreview(markdown:string,postPath?:string,blogUrl?:string|null):string {
 const html=DOMPurify.sanitize(marked.parse(markdown,{async:false}),{FORBID_TAGS:["iframe","form","style","svg","math"],FORBID_ATTR:["style"]});
 const doc=new DOMParser().parseFromString(html,"text/html");
 for(const image of doc.querySelectorAll("img")){
  const source=image.getAttribute("src") || "";
  const resolved=imagePreviewSource(source,postPath,blogUrl);
  if(resolved){image.src=resolved;continue;}
  image.removeAttribute("src");image.alt=image.alt || "本地图片：发布后查看";
 }
 for(const link of doc.querySelectorAll("a")){link.setAttribute("target","_blank");link.setAttribute("rel","noopener noreferrer");}
 return DOMPurify.sanitize(doc.body.innerHTML,{FORBID_TAGS:["iframe","form","style","svg","math"],FORBID_ATTR:["style"]});
}


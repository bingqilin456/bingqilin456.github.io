const ROOT="src/content/posts/";
export function assertContentPath(path: string, kind: "post" | "image" | "catalog" | "gallery-image"): void {
 let decoded=path;
 try { for(let step=0;step<4;step++) { const next=decodeURIComponent(decoded); if(next===decoded) break; decoded=next; } } catch { throw new Error("路径编码无效"); }
 if(decoded.includes("%") || /[\\:\x00-\x1f\x7f?#]/.test(decoded) || decoded.split("/").some(part => !part || part==="." || part==="..") || decoded.length>600) throw new Error("路径不得包含穿越或特殊字符");
 if(kind==="catalog"){
  if(decoded!==path || !["src/content/gallery.json","src/content/tools.json"].includes(path))throw new Error("内容清单路径无效");
  return;
 }
 if(kind==="gallery-image"){
  if(!/^public\/gallery\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|avif|gif)$/i.test(path) || decoded!==path)throw new Error("相册图片路径无效");
  return;
 }
 if(!decoded.startsWith(ROOT))throw new Error("路径必须在 src/content/posts 内");
 const extension=kind==="post" ? /\.(md|mdx)$/ : /\.(png|jpe?g|webp|avif|gif)$/i;
 if(!extension.test(decoded)) throw new Error("文件扩展名不受支持");
 if(decoded!==path) throw new Error("请使用未编码的原始路径");
}
export function repositoryPathKind(path:string):"post"|"image"|"catalog"|"gallery-image" {
 if(path==="src/content/gallery.json" || path==="src/content/tools.json")return "catalog";
 if(path.startsWith("public/gallery/"))return "gallery-image";
 return /\.(md|mdx)$/.test(path)?"post":"image";
}
export function imageReference(postPath: string, imagePath: string): string {
 assertContentPath(postPath,"post"); assertContentPath(imagePath,"image");
 const source=postPath.split("/").slice(0,-1),target=imagePath.split("/");
 while(source.length && target.length && source[0]===target[0]) { source.shift(); target.shift(); }
 return "../".repeat(source.length)+target.join("/");
}
export function imageMarkdown(postPath:string,imagePath:string,alt:string):string {
 const reference=encodeURI(imageReference(postPath,imagePath)).replace(/[()]/g,character=>character==="("?"%28":"%29");
 const label=alt.replace(/[\\[\]()*_`]/g,"\\$&");
 return "\n!["+label+"]("+reference+")\n";
}
export function imagePreviewSource(source:string,postPath?:string,blogUrl?:string|null):string|undefined {
 if(/^https?:\/\//.test(source))return source;
 if(source.startsWith("/")){
  try{const base=new URL(blogUrl || "");if(["http:","https:"].includes(base.protocol))return new URL(source,base).toString();}catch{/* A public image needs a configured blog URL. */}
  return undefined;
 }
 if(postPath && source){
  try{const path=decodeURIComponent(new URL(source,"https://content.invalid/"+postPath).pathname.slice(1));assertContentPath(path,"image");return "/api/media/file?path="+encodeURIComponent(path);}catch{/* Unresolvable local images have a visible fallback. */}
 }
 return undefined;
}


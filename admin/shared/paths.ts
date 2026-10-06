const ROOT="src/content/posts/";
export function assertContentPath(path: string, kind: "post" | "image"): void {
 let decoded=path;
 try { for(let step=0;step<4;step++) { const next=decodeURIComponent(decoded); if(next===decoded) break; decoded=next; } } catch { throw new Error("路径编码无效"); }
 if(decoded.includes("%") || !decoded.startsWith(ROOT) || /[\\:\x00-\x1f\x7f?#]/.test(decoded) || decoded.split("/").some(part => !part || part==="." || part==="..") || decoded.length>600) throw new Error("路径必须在 src/content/posts 内，不得包含穿越或特殊字符");
 const extension=kind==="post" ? /\.(md|mdx)$/ : /\.(png|jpe?g|webp|avif|gif)$/i;
 if(!extension.test(decoded)) throw new Error("文件扩展名不受支持");
 if(decoded!==path) throw new Error("请使用未编码的原始路径");
}
export function imageReference(postPath: string, imagePath: string): string {
 assertContentPath(postPath,"post"); assertContentPath(imagePath,"image");
 const source=postPath.split("/").slice(0,-1),target=imagePath.split("/");
 while(source.length && target.length && source[0]===target[0]) { source.shift(); target.shift(); }
 return "../".repeat(source.length)+target.join("/");
}


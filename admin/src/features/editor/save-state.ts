import type { PostDocument,PostFields } from "#shared/contracts";
export interface PendingSave {path:string;slug:string;fields:PostFields;body:string}
export function editorSignature(fields:PostFields,body:string,slug:string):string{return JSON.stringify({fields,body,slug});}
function comparable(fields:PostFields):string{const {updated,...remaining}=fields;return JSON.stringify(remaining);}
export async function restoreSavedPost(pending:PendingSave,current:{fields:PostFields;body:string;slug:string},load:()=>Promise<PostDocument>):Promise<{post:PostDocument;fields:PostFields;saved:string}> {
 const post=await load();
 if(post.path!==pending.path || post.body!==pending.body || comparable(post.fields)!==comparable(pending.fields))throw new Error("保存已成功，但仓库又出现了新修改。请复制当前内容后重新打开文章比对，避免覆盖更新。");
 const unchanged=editorSignature(current.fields,current.body,current.slug)===editorSignature(pending.fields,pending.body,pending.slug);
 return {post,fields:unchanged?post.fields:current.fields,saved:editorSignature(post.fields,pending.body,pending.slug)};
}

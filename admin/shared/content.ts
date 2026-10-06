import { parseDocument, isMap, isNode, isCollection, visit } from "yaml";
import { postFieldsSchema } from "#shared/post-schema";
import { assertContentPath } from "#shared/paths";
import type { PostDocument, PostFields } from "#shared/contracts";
function split(raw: string): {bom:string;newline:string;yaml:string;body:string} {
 const match=/^(\uFEFF?)---(\r?\n)([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(raw);
 if(!match) throw new Error("文章缺少有效 YAML frontmatter");
 return {bom:match[1],newline:match[2],yaml:match[3],body:match[4]};
}
function document(source: string): ReturnType<typeof parseDocument> {
 const doc=parseDocument(source,{uniqueKeys:true});
 if(doc.errors.length || !isMap(doc.contents)) throw new Error("YAML 格式错误或字段重复");
 return doc;
}
export function parsePost(path: string, sha: string, raw: string): PostDocument {
 assertContentPath(path,"post");
 const parts=split(raw),doc=document(parts.yaml);
 const fields=postFieldsSchema.parse(doc.toJS({maxAliasCount:20}));
 return {path,sha,raw,fields,body:parts.body};
}
export function serializePost(original: string | null, fields: PostFields, body: string): string {
 const valid=postFieldsSchema.parse(fields);
 if(original===null) return "---\n"+newDocument(valid)+"---\n"+body;
 const parts=split(original),doc=document(parts.yaml),previous=postFieldsSchema.parse(doc.toJS({maxAliasCount:20}));
 const edits=[...new Set([...Object.keys(previous),...Object.keys(valid)])].filter(key=>JSON.stringify(Reflect.get(valid,key))!==JSON.stringify(Reflect.get(previous,key)));
 const anchors=new Set<string>();
 for(const key of edits){const old=doc.get(key,true);if(isNode(old))visit(old,{Node(_key,node){if(node.anchor)anchors.add(node.anchor);}});}
 // Detach references to edited anchors before replacing them. Unknown values must
 // remain their original value, rather than silently following the user's edit.
 if(anchors.size)visit(doc,{Alias(_key,alias){
  if(!anchors.has(alias.source))return;
  const target=alias.resolve(doc);if(!target)throw new Error("YAML 引用无法解析");
  const value:unknown=target.toJS(doc,{maxAliasCount:20}),replacement=doc.createNode(value);
  replacement.comment=alias.comment;replacement.commentBefore=alias.commentBefore;replacement.spaceBefore=alias.spaceBefore;
  return replacement;
 }});
 for(const key of edits) {
  const value=Reflect.get(valid,key),before=Reflect.get(previous,key);
  if(JSON.stringify(value)===JSON.stringify(before)) continue;
  if(value===undefined)doc.delete(key);
  else{
   const old=doc.get(key,true),replacement=doc.createNode(value);
   if(isNode(old)){replacement.comment=old.comment;replacement.commentBefore=old.commentBefore;replacement.spaceBefore=old.spaceBefore;}
   if(isCollection(old) && isCollection(replacement))replacement.flow=old.flow;
   doc.set(key,replacement);
  }
 }
 if(!edits.length && body===parts.body) return original;
 const yaml=edits.length ? doc.toString({lineWidth:0}).replace(/\n/g,parts.newline) : parts.yaml+parts.newline;
 return parts.bom+"---"+parts.newline+yaml+"---"+parts.newline+body;
}
function newDocument(fields: PostFields): string {
 const doc=document("title: placeholder");
 for(const [key,value] of Object.entries(fields)) if(value!==undefined) doc.set(key,value);
 return doc.toString({lineWidth:0});
}


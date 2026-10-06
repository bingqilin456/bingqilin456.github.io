import type { Repository, PostDocument, PostSummary, PostFields, CommitReceipt, TaxonomyChange, FileMutation } from "#shared/contracts";
import { parsePost, serializePost } from "#shared/content";
import { assertContentPath } from "#shared/paths";
import { applyTaxonomy } from "#shared/taxonomy";
import { savePostSchema, taxonomySchema } from "#shared/post-schema";
import { AppError } from "#worker/errors";
function postPath(path:string):void { try {assertContentPath(path,"post");}catch{throw new AppError(400,"INVALID_PATH","文章路径无效。");} }
export async function loadPost(repo:Repository,path:string):Promise<PostDocument> {
 postPath(path); const file=await repo.readFile(path);
 try { return parsePost(path,file.sha,file.raw); } catch { throw new AppError(422,"INVALID_FRONTMATTER","文章 frontmatter 格式不正确，请先在仓库中修复，后台不会覆盖它。"); }
}
export async function listPosts(repo:Repository):Promise<PostSummary[]> {
 const files=(await repo.listFiles()).filter(file=>file.path.startsWith("src/content/posts/") && /\.(md|mdx)$/.test(file.path));
 const result:PostSummary[]=[];
 for(const file of files) {
  try {
   const post=await loadPost(repo,file.path),fields=post.fields;
   result.push({path:post.path,sha:post.sha,title:fields.title,published:fields.published,updated:fields.updated,draft:fields.draft,pinned:fields.pinned,tags:fields.tags,category:fields.category});
  } catch(error) {
   if(!(error instanceof AppError && [400,422].includes(error.status))) throw error;
   result.push({path:file.path,sha:file.sha,title:file.path.split("/").pop() || file.path,published:"",draft:true,pinned:false,tags:[],category:null,error:"格式异常，请到仓库修复后刷新"});
  }
 }
 return result.sort((a,b)=>b.published.localeCompare(a.published));
}
export async function savePost(repo:Repository,input:{path:string;expectedSha:string|null;fields:PostFields;body:string}):Promise<CommitReceipt> {
 const valid=savePostSchema.parse(input);postPath(valid.path);
 let original:string|null=null;
 if(valid.expectedSha!==null) {
  const post=await loadPost(repo,valid.path);
  if(post.sha!==valid.expectedSha) throw new AppError(409,"VERSION_CONFLICT","这篇文章已被修改；编辑内容仍保留，请重新读取版本。");
  original=post.raw;
 }
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const fields={...valid.fields,...(original!==null ? {updated:today} : {})};
 return repo.commit([{path:valid.path,expectedSha:valid.expectedSha,content:serializePost(original,fields,valid.body)}],(fields.draft?"保存草稿：":"发布文章：")+fields.title);
}
export async function deletePost(repo:Repository,path:string,expectedSha:string):Promise<CommitReceipt> {
 postPath(path);if(!expectedSha)throw new AppError(400,"MISSING_VERSION","请先读取文章版本。");
 return repo.commit([{path,expectedSha,content:null}],"删除文章："+path);
}
export async function changeTaxonomy(repo:Repository,input:TaxonomyChange):Promise<CommitReceipt> {
 const change=taxonomySchema.parse(input);
 const snapshot=(await repo.listFiles()).filter(file=>file.path.startsWith("src/content/posts/") && /\.(md|mdx)$/.test(file.path));
 const posts:PostDocument[]=[];
 for(const file of snapshot) {
  const post=await loadPost(repo,file.path);
  if(post.sha!==file.sha) throw new AppError(409,"VERSION_CONFLICT","文章集合已变化，请刷新后重新确认。");
  if(change.kind==="tag" ? post.fields.tags.includes(change.source) : post.fields.category===change.source)posts.push(post);
 }
 const actual=posts.map(post=>({path:post.path,sha:post.sha})).sort((a,b)=>a.path.localeCompare(b.path));
 const expected=[...change.expected].sort((a,b)=>a.path.localeCompare(b.path));
 if(JSON.stringify(actual)!==JSON.stringify(expected)) throw new AppError(409,"TAXONOMY_CHANGED","受影响文章或版本已变化，请刷新后重新确认。");
 if(!actual.length) throw new AppError(400,"NO_REFERENCES","该名称没有文章引用。");
 const changes:FileMutation[]=posts.map(post=>({path:post.path,expectedSha:post.sha,content:serializePost(post.raw,applyTaxonomy(post.fields,change),post.body)}));
 return repo.commit(changes,"批量更新"+(change.kind==="tag"?"标签：":"分类：")+change.source,snapshot.map(file=>({path:file.path,sha:file.sha})));
}


import assert from "node:assert/strict";
import test from "node:test";
import { createRepository } from "#worker/repository";
import { assertContentPath } from "#shared/paths";

test("管理内容只开放两个 JSON 清单和相册图片，保留文章路径边界", () => {
 for(const path of ["src/content/gallery.json","src/content/tools.json"]){
  assert.doesNotThrow(()=>assertContentPath(path,"catalog"));
 }
 assert.doesNotThrow(()=>assertContentPath("public/gallery/travel/photo.webp","gallery-image"));
 for(const path of ["src/config/siteConfig.ts","src/content/other.json","public/gallery/../photo.webp","public/gallery/travel/photo.svg","public/gallery/travel/%2e%2e/photo.png"]){
  assert.throws(()=>assertContentPath(path,path.endsWith("json") || path.endsWith("ts")?"catalog":"gallery-image"));
 }
 assert.throws(()=>assertContentPath("public/gallery/travel/photo.webp","image"));
});
const env={GITHUB_OWNER:"owner",GITHUB_REPO:"blog",GITHUB_BRANCH:"master"};
test("GitHub blob 读取与文章编辑完整保留 UTF-8 BOM",async()=>{
 const raw="\uFEFF---\ntitle: A\npublished: 2026-10-05\n---\nbody",mock=fixture();
 const fetcher:typeof fetch=async(input,init)=>String(input).includes("/git/blobs/")?Response.json({content:Buffer.from(raw,"utf8").toString("base64"),encoding:"base64"}):mock.fetcher(input,init);
 const file=await createRepository(env,"token",fetcher).readFile("src/content/posts/a.md");
 assert.equal(file.raw,raw);
 const {parsePost,serializePost}=await import("#shared/content");
 const post=parsePost("src/content/posts/a.md",file.sha,file.raw);
 assert.ok(serializePost(file.raw,{...post.fields,title:"新标题"},post.body).startsWith("\uFEFF"));
});
import { listDeployments } from "#worker/publishing";
import type { Repository } from "#shared/contracts";
test("发布状态只匹配同 SHA 的 Pages 工作流最新运行",async () => {
 const {fetcher}=fixture(),base=createRepository(env,"token",fetcher);
 const repo:Repository={...base,async listCommits(){return [{sha:"target",url:"https://github.com/commit",committedAt:"2026-10-05T00:00:00Z"}]},async listWorkflowRuns(){return [
  {id:3,headSha:"other",status:"completed",conclusion:"success",url:"https://github.com/run",workflowPath:".github/workflows/deploy-pages.yml"},
  {id:2,headSha:"target",status:"completed",conclusion:"failure",url:"https://github.com/run",workflowPath:".github/workflows/deploy-pages.yml"},
  {id:1,headSha:"target",status:"completed",conclusion:"success",url:"https://github.com/run",workflowPath:".github/workflows/deploy-pages.yml"},
  {id:4,headSha:"target",status:"completed",conclusion:"success",url:"https://github.com/run",workflowPath:".github/workflows/ci.yml"}
 ]}};
 assert.equal((await listDeployments(repo,20))[0].run?.id,2);
 assert.equal((await listDeployments({...repo,async listWorkflowRuns(){return [{id:9,headSha:"other",status:"completed",conclusion:"success",url:"https://github.com/run",workflowPath:".github/workflows/deploy-pages.yml"}]}},20))[0].run,null);
});
test("Actions 翻页找记录，未创建仓库明确连接失败",async () => {
 let pages=0;
 const paginated:typeof fetch=async input=>{
  if(String(input).includes("/runs?")){pages++;return Response.json({workflow_runs:Array.from({length:pages===1?100:1},(_,i)=>({id:pages*100+i,head_sha:"sha",status:"completed",conclusion:"success",html_url:"https://github.com/run",path:".github/workflows/deploy-pages.yml"}))});}
  return Response.json({}, {status:404});
 };
 const repo=createRepository(env,"token",paginated);
 assert.equal((await repo.listWorkflowRuns("sha")).length,101);
 assert.equal(pages,2);
 assert.deepEqual(await repo.checkConnection(),{repositoryExists:false,branchExists:false,workflowExists:false});
});
function fixture(options: {truncated?:boolean;race?:boolean;symlink?:boolean} = {}): {fetcher:typeof fetch;writes:Array<{url:string;body:unknown}>} {
 const writes:Array<{url:string;body:unknown}>=[];
 const fetcher:typeof fetch=async (input,init) => {
  const url=String(input),method=init?.method || "GET";
  if(method!=="GET") {
   const body:unknown=JSON.parse(String(init?.body)); writes.push({url,body});
   if(method==="PATCH") return Response.json({}, {status:options.race ? 422 : 200});
   return Response.json({sha:url.includes("/blobs")?"newblob":url.includes("/trees")?"newtree":"newcommit",html_url:"https://github.com/commit",committer:{date:"2026-10-05T00:00:00Z"}});
  }
  if(url.includes("/git/ref/")) return Response.json({object:{sha:"head"}});
  if(url.includes("/git/commits/")) return Response.json({sha:"head",tree:{sha:"root"}});
  if(url.includes("/git/trees/")) {
   const file={path:"src/content/posts/a.md",sha:"old",mode:options.symlink?"120000":"100644",type:"blob",size:10};
   if(url.endsWith("recursive=1") && options.truncated) return Response.json({truncated:true,tree:[]});
   return Response.json({truncated:false,tree:[file]});
  }
  return Response.json({}, {status:404});
 };
 return {fetcher,writes};
}
test("旧 SHA、新建重名和符号链接不能写入；截断索引补全",async () => {
 const mock=fixture({truncated:true}),repo=createRepository(env,"test-token",mock.fetcher);
 assert.equal((await repo.listFiles()).length,1);
 await assert.rejects(repo.commit([{path:"src/content/posts/a.md",expectedSha:"stale",content:"x"}],"x"),{status:409});
 await assert.rejects(repo.commit([{path:"src/content/posts/a.md",expectedSha:null,content:"x"}],"x"),{status:409});
 const link=fixture({symlink:true});
 await assert.rejects(createRepository(env,"token",link.fetcher).commit([{path:"src/content/posts/a.md",expectedSha:"old",content:"x"}],"x"));
 assert.equal(mock.writes.length,0);
 await assert.rejects(repo.commit([{path:"src/content/posts/a.md",expectedSha:"old",content:"x"}],"taxonomy",[{path:"src/content/posts/a.md",sha:"old"},{path:"src/content/posts/new.md",sha:"new"}]),{status:409});
 assert.equal(mock.writes.length,0);
});
test("两文件只更新一次非强制 ref，竞争返回冲突",async () => {
 const mock=fixture(),repo=createRepository(env,"token",mock.fetcher);
 await repo.commit([{path:"src/content/posts/a.md",expectedSha:"old",content:"updated"},{path:"src/content/posts/b.md",expectedSha:null,content:"new"}],"update");
 const refs=mock.writes.filter(row=>row.url.includes("/git/refs/"));
 assert.equal(refs.length,1); assert.deepEqual(refs[0].body,{sha:"newcommit",force:false});
 const race=fixture({race:true});
 await assert.rejects(createRepository(env,"token",race.fetcher).commit([{path:"src/content/posts/a.md",expectedSha:"old",content:"x"}],"x"),{status:409});
});


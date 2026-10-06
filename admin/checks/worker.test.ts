import assert from "node:assert/strict";
import { test } from "node:test";
import { handleRequest } from "../worker/index.ts";
import { listPosts, savePost, changeTaxonomy } from "#worker/content-service";
import { uploadImage } from "#worker/media";
import { parsePost } from "#shared/content";
import type { Repository, FileMutation } from "#shared/contracts";
function memory(hasInvalid=true):{repo:Repository;writes:FileMutation[][]} {
 const files=new Map([["src/content/posts/a.md","---\ntitle: A\npublished: 2026-10-05\ntags: [A, B]\n---\nbody"],["src/content/posts/b.md","---\ntitle: [bad]\n---\nbody"]]);
 const writes:FileMutation[][]=[];
 if(!hasInvalid)files.delete("src/content/posts/b.md");
 const repo:Repository={
  async listFiles(){return [...files].map(([path,raw])=>({path,sha:"old",size:raw.length,mode:"100644"}));},
  async readFile(path){const raw=files.get(path);if(!raw)throw new Error("missing");return {sha:"old",raw};},
  async readBytes(){return new Uint8Array();},
  async commit(changes){writes.push([...changes]);return {sha:"new",url:"https://github.com/commit",committedAt:"2026-10-05T00:00:00Z"};},
  async listCommits(){return [];},async listWorkflowRuns(){return [];},
  async checkConnection(){return {repositoryExists:true,branchExists:true,workflowExists:true};}
 };
 return {repo,writes};
}
test("坏 YAML 单篇标记，保存与批量修改安全阻断；新建草稿格式有效",async () => {
 const {repo,writes}=memory(),posts=await listPosts(repo);
 assert.equal(posts.length,2);assert.ok(posts.find(post=>post.path.endsWith("b.md"))?.error);
 const fields=parsePost("src/content/posts/a.md","old",(await repo.readFile("src/content/posts/a.md")).raw).fields;
 await assert.rejects(savePost(repo,{path:"src/content/posts/b.md",expectedSha:"old",fields,body:"overwrite"}),{status:422});
 await assert.rejects(changeTaxonomy(repo,{kind:"tag",action:"merge",source:"A",target:"B",expected:[{path:"src/content/posts/a.md",sha:"old"}]}),{status:422});
 assert.equal(writes.length,0);
 await savePost(repo,{path:"src/content/posts/new.md",expectedSha:null,fields:{...fields,draft:true},body:"new"});
 const raw=writes[0][0].content;assert.equal(typeof raw,"string");
 if(typeof raw==="string")assert.equal(parsePost("src/content/posts/new.md","sha",raw).fields.draft,true);
 const clean=memory(false);
 await assert.rejects(changeTaxonomy(clean.repo,{kind:"tag",action:"merge",source:"A",target:"B",expected:[{path:"src/content/posts/a.md",sha:"stale"}]}),{status:409});
 assert.equal(clean.writes.length,0);
 await changeTaxonomy(clean.repo,{kind:"tag",action:"merge",source:"A",target:"B",expected:[{path:"src/content/posts/a.md",sha:"old"}]});
 assert.equal(clean.writes.length,1);
 const merged=clean.writes[0][0].content;
 if(typeof merged!=="string")throw new Error("invalid mutation");
 assert.deepEqual(parsePost("src/content/posts/a.md","new",merged).fields.tags,["B"]);
});
test("图片验证大小、扩展名和文件头，不接受 SVG 或伪装文件",async () => {
 const {repo,writes}=memory();
 for(const file of [new File(["<svg/>"],"a.svg",{type:"image/svg+xml"}),new File(["not png"],"a.png",{type:"image/png"}),new File([new Uint8Array(5*1024*1024+1)],"a.png",{type:"image/png"})])await assert.rejects(uploadImage(repo,file));
 assert.equal(writes.length,0);
});

test("未配置仓库时明确展示未连接，匿名不能读取正文", async () => {
  const setup = await handleRequest(new Request("http://localhost/api/setup"), {});
  const data = await setup.json();
  assert.equal(data.configured, false);
  assert.ok(data.missing.includes("GITHUB_REPO"));
  const response = await handleRequest(new Request("http://localhost/api/posts"), {});
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

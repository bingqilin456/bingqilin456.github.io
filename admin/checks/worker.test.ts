import assert from "node:assert/strict";
import { test } from "node:test";
import { handleRequest } from "../worker/index.ts";
import { listPosts, savePost, changeTaxonomy } from "#worker/content-service";
import { uploadImage } from "#worker/media";
import { parsePost } from "#shared/content";
import type { Repository, FileMutation } from "#shared/contracts";

test("相册清单保留照片顺序，只公开启用相册，封面移除后回退", async () => {
 const helpers=await import("../../src/utils/gallery-content.ts").catch(()=>null);
 assert.ok(helpers,"相册清单读取功能尚未实现");
 const photos=[{id:"second",src:"https://images.example/b.png",width:200,height:100,description:"第二张"},{id:"first",src:"/gallery/travel/a.png",width:100,height:100,description:"第一张"}];
 const album={id:"travel",name:"旅行",enabled:true,coverPhotoId:"first",photos};
 assert.deepEqual(helpers.getVisibleAlbums([album,{...album,id:"hidden",enabled:false}]).map(row=>row.id),["travel"]);
 assert.deepEqual(helpers.albumPhotoList(album).map(row=>row.id),["second","first"]);
 assert.equal(helpers.albumCoverSource(album),"/gallery/travel/a.png");
 assert.equal(helpers.albumCoverSource({...album,photos:photos.slice(0,1)}),"https://images.example/b.png");
 assert.equal(helpers.albumCoverSource({...album,photos:[]}),"");
});

test("管理清单保存验证版本与字段，删除引用不删除图片，坏 JSON 不被覆盖", async () => {
 const service=await import("../worker/managed-content.ts").catch(()=>null);
 assert.ok(service,"管理清单接口尚未实现");
 const {repo,writes}=memory(false);
 const photo={id:"photo",src:"/gallery/travel/photo.png",width:100,height:80,description:"照片"};
 const album={id:"travel",name:"旅行",description:"",date:"",location:"",tags:[],enabled:false,coverPhotoId:"photo",photos:[photo]};
 const old={albums:[album]};
 const repository:Repository={...repo,async listFiles(){return [{path:"src/content/gallery.json",sha:"old",size:100,mode:"100644"},{path:"public/gallery/travel/photo.png",sha:"image",size:100,mode:"100644"}];},async readFile(){return {sha:"old",raw:JSON.stringify(old)};}};
 assert.equal((await service.loadGallery(repository)).sha,"old");
 await assert.rejects(service.saveGallery(repository,{expectedSha:"stale",data:old}),{status:409});
 await service.saveGallery(repository,{expectedSha:"old",data:{albums:[{...album,photos:[]}]}});
 assert.equal(writes.length,1);
 assert.deepEqual(writes[0].map(row=>row.path),["src/content/gallery.json"]);
 const saved=writes[0][0].content;
 assert.equal(typeof saved,"string");
 if(typeof saved==="string"){assert.equal(JSON.parse(saved).albums[0].coverPhotoId,"");assert.equal(JSON.parse(saved).albums[0].enabled,false);}
 await assert.rejects(service.saveGallery(repository,{expectedSha:"old",data:{albums:[album,album]}}));
 await assert.rejects(service.saveTools({...repository,async listFiles(){return []; }},{expectedSha:null,data:{title:"",description:"",apis:[{id:"group",category:"工具",description:"",items:[{id:"tool",name:"恶意链接",url:"javascript:alert(1)",description:"",icon:"",enabled:true}]}]}}));
 const corrupt={...repository,async readFile(){return {sha:"old",raw:"broken json"};}};
 await assert.rejects(service.saveGallery(corrupt,{expectedSha:"old",data:old}),{status:422});
 assert.equal(writes.length,1);
});

test("后台保存的相册和工具清单通过仓库格式校验，SHA 对应最终文本", async () => {
 const service=await import("../worker/managed-content.ts");
 const {spawnSync}=await import("node:child_process"),{fileURLToPath}=await import("node:url"),{createHash}=await import("node:crypto");
 const root=fileURLToPath(new URL("../../",import.meta.url)),biome=fileURLToPath(new URL("../../node_modules/@biomejs/biome/bin/biome",import.meta.url));
 const tagCases=[[],["旅拍","2026"],["a \\\" b","line\n2"],...[8,9,10,11,28,29,30].flatMap(length=>[["a".repeat(length),"b".repeat(length)],["旅".repeat(length),"游".repeat(length)],["😀".repeat(length),"📸".repeat(length)]])];
 for(const tags of tagCases){
  const {repo,writes}=memory(false);
  const album={id:"travel",name:"旅行",description:"",date:"",location:"",tags,enabled:true,coverPhotoId:"photo",photos:[{id:"photo",src:"https://example.com/a.png",width:100,height:80,description:"照片"}]};
  const result=await service.saveGallery(repo,{expectedSha:null,data:{albums:[album]}});
  const raw=writes[0][0].content;assert.equal(typeof raw,"string");if(typeof raw!=="string")throw new Error("清单需为文本");
  const formatted=spawnSync(process.execPath,[biome,"format","--stdin-file-path=src/content/gallery.json"],{cwd:root,input:raw,encoding:"utf8"});
  assert.equal(formatted.status,0,formatted.stderr);assert.equal(raw,formatted.stdout,"保存后的清单不能阻断 GitHub Pages 格式检查");
  assert.equal(result.sha,createHash("sha1").update("blob "+Buffer.byteLength(raw)+"\0"+raw).digest("hex"));
 }
 const {repo,writes}=memory(false);
 await service.saveTools(repo,{expectedSha:null,data:{title:"导航",description:"",apis:[{id:"group",category:"工具",description:"",items:[{id:"tool",name:"示例",url:"https://example.com",description:"",icon:"",enabled:true}]}]}});
 const raw=writes[0][0].content;assert.equal(typeof raw,"string");if(typeof raw!=="string")throw new Error("清单需为文本");
 const formatted=spawnSync(process.execPath,[biome,"format","--stdin-file-path=src/content/tools.json"],{cwd:root,input:raw,encoding:"utf8"});
 assert.equal(formatted.status,0,formatted.stderr);assert.equal(raw,formatted.stdout);
});

test("相册上传写入独立图片路径；JSON 和相册图片接口仍要求登录", async () => {
 const {repo,writes}=memory(false);
 const file=new File([new Uint8Array([137,80,78,71,13,10,26,10])],"photo.png",{type:"image/png"});
 const result=await uploadImage(repo,file,"travel");
 assert.ok(result.item.path.startsWith("public/gallery/travel/"));
 assert.equal(writes.length,1);
 await assert.rejects(uploadImage(repo,file,"../escape"));
 for(const path of ["/api/gallery","/api/tools","/api/gallery/image?path=public/gallery/travel/photo.png"]){
  const response=await handleRequest(new Request("http://localhost"+path),{});
  assert.equal(response.status,401);
 }
});
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

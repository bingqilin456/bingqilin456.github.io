import { z } from "zod";
import type { CommitReceipt, FileMutation, Repository, RepositoryFile, WorkflowRun } from "#shared/contracts";
import { assertContentPath, repositoryPathKind } from "#shared/paths";
import { AppError } from "#worker/errors";
import { githubRequest, repositoryBase, toBase64, fromBase64 } from "#worker/github";
import type { WorkerEnv } from "#worker/env";
const shaSchema=z.object({sha:z.string()});
const headSchema=z.object({object:shaSchema});
const commitSchema=shaSchema.extend({tree:shaSchema});
const treeSchema=z.object({truncated:z.boolean(),tree:z.array(z.object({path:z.string(),sha:z.string(),mode:z.string(),type:z.string(),size:z.number().optional()}))});
const receiptSchema=shaSchema.extend({html_url:z.string().optional(),committer:z.object({date:z.string()}).optional()});
const commitsSchema=z.array(shaSchema.extend({html_url:z.string(),commit:z.object({committer:z.object({date:z.string()}).nullable()})}));
const runSchema=z.object({id:z.number(),head_sha:z.string(),status:z.string(),conclusion:z.string().nullable(),html_url:z.string(),path:z.string()});
export function createRepository(env: WorkerEnv, token: string, fetcher: typeof fetch = fetch): Repository {
 const base=repositoryBase(env),branch=encodeURIComponent(env.GITHUB_BRANCH || "master");
 const request=<T>(path:string,schema:z.ZodType<T>,init:RequestInit={}):Promise<T> => githubRequest(token,base+path,schema,init,fetcher);
 async function head():Promise<{sha:string;tree:string}> {
  const ref=await request("/git/ref/heads/"+branch,headSchema);
  const commit=await request("/git/commits/"+ref.object.sha,commitSchema);
  return {sha:ref.object.sha,tree:commit.tree.sha};
 }
 async function index(tree:string):Promise<RepositoryFile[]> {
  const recursive=await request("/git/trees/"+tree+"?recursive=1",treeSchema);
  const files:RepositoryFile[]=[];
  function add(entries:z.infer<typeof treeSchema>["tree"],prefix:string):void {
   for(const entry of entries) if(entry.type==="blob") files.push({path:prefix+entry.path,sha:entry.sha,size:entry.size || 0,mode:entry.mode});
  }
  if(!recursive.truncated) { add(recursive.tree,""); return files; }
  async function walk(sha:string,prefix:string):Promise<void> {
   const part=await request("/git/trees/"+sha,treeSchema);
   if(part.truncated) throw new AppError(502,"INCOMPLETE_TREE","仓库目录太大，无法确认完整文件列表；本次操作已停止。");
   add(part.tree,prefix);
   for(const entry of part.tree) if(entry.type==="tree") await walk(entry.sha,prefix+entry.path+"/");
  }
  await walk(tree,""); return files;
 }
 function safe(file:RepositoryFile|undefined):RepositoryFile {
  if(!file) throw new AppError(404,"FILE_NOT_FOUND","文件不存在。");
  if(!["100644","100755"].includes(file.mode)) throw new AppError(400,"UNSAFE_FILE","不支持符号链接或特殊文件。");
  return file;
 }
 let readSnapshot:Promise<RepositoryFile[]>|undefined;
 function readIndex():Promise<RepositoryFile[]> {readSnapshot ??= head().then(current=>index(current.tree));return readSnapshot;}
 async function read(path:string):Promise<{sha:string;bytes:Uint8Array}> {
  assertContentPath(path,repositoryPathKind(path));
  const file=safe((await readIndex()).find(row=>row.path===path));
  if(file.size>6_000_000) throw new AppError(413,"FILE_TOO_LARGE","文件超过后台读取上限。");
  const blob=await request("/git/blobs/"+file.sha,z.object({content:z.string(),encoding:z.literal("base64")}));
  return {sha:file.sha,bytes:fromBase64(blob.content)};
 }
 return {
  async listFiles():Promise<RepositoryFile[]> { return readIndex(); },
  async readFile(path:string):Promise<{sha:string;raw:string}> { const file=await read(path); return {sha:file.sha,raw:new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(file.bytes)}; },
  async readBytes(path:string):Promise<Uint8Array> { return (await read(path)).bytes; },
  async commit(changes:readonly FileMutation[],message:string,expectedPosts?:readonly {path:string;sha:string}[]):Promise<CommitReceipt> {
   if(!changes.length || new Set(changes.map(row=>row.path)).size!==changes.length) throw new AppError(400,"INVALID_CHANGES","没有可提交的修改，或路径重复。");
   const current=await head(),files=await index(current.tree);
   if(expectedPosts) {
    const actual=files.filter(file=>file.path.startsWith("src/content/posts/") && /\.(md|mdx)$/.test(file.path)).map(file=>({path:file.path,sha:file.sha})).sort((a,b)=>a.path.localeCompare(b.path));
    const expected=[...expectedPosts].sort((a,b)=>a.path.localeCompare(b.path));
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw new AppError(409,"TAXONOMY_CHANGED","文章集合已变化，请刷新后重新确认。");
   }
   for(const change of changes) {
    try {
     const kind=repositoryPathKind(change.path);
     assertContentPath(change.path,kind);
     if(kind==="gallery-image" && (!(change.content instanceof Uint8Array) || change.expectedSha!==null))throw new Error("相册图片只允许新增");
     if(kind==="catalog" && typeof change.content!=="string")throw new Error("清单必须是 JSON 文本");
     if(kind==="post" && change.content instanceof Uint8Array)throw new Error("文章必须是文本");
     if(kind==="image" && typeof change.content==="string")throw new Error("图片必须是二进制");
    } catch { throw new AppError(400,"INVALID_PATH","写入路径或文件类型不受支持。"); }
    const file=files.find(row=>row.path===change.path);
    if(file) safe(file);
    if((file?.sha || null)!==change.expectedSha) throw new AppError(409,"VERSION_CONFLICT","文件已被其他设备修改；请保留编辑内容并重新读取版本。");
    if(change.content===null && !file) throw new AppError(409,"VERSION_CONFLICT","要删除的文件已不存在。");
    if(files.some(row=>change.path.startsWith(row.path+"/") || row.path.startsWith(change.path+"/"))) throw new AppError(400,"INVALID_PATH","路径与已有文件或目录冲突。");
   }
   const tree:Array<{path:string;mode:string;type:"blob";sha:string|null}>=[];
   for(const change of changes) {
    const old=files.find(row=>row.path===change.path);
    const blob=change.content===null ? null : await request("/git/blobs",shaSchema,{method:"POST",body:JSON.stringify({content:typeof change.content==="string" ? change.content : toBase64(change.content),encoding:typeof change.content==="string" ? "utf-8" : "base64"})});
    tree.push({path:change.path,mode:old?.mode || "100644",type:"blob",sha:blob?.sha || null});
   }
   const createdTree=await request("/git/trees",shaSchema,{method:"POST",body:JSON.stringify({base_tree:current.tree,tree})});
   const created=await request("/git/commits",receiptSchema,{method:"POST",body:JSON.stringify({message,tree:createdTree.sha,parents:[current.sha]})});
   try { await request("/git/refs/heads/"+branch,z.unknown(),{method:"PATCH",body:JSON.stringify({sha:created.sha,force:false})}); }
   catch(error) { if(error instanceof AppError && [409,422].includes(error.status)) throw new AppError(409,"VERSION_CONFLICT","分支已更新；本次修改未发布，请刷新后重新确认。"); throw error; }
   return {sha:created.sha,url:created.html_url || "https://github.com/"+env.GITHUB_OWNER+"/"+env.GITHUB_REPO+"/commit/"+created.sha,committedAt:created.committer?.date || new Date().toISOString()};
  },
  async listCommits(limit:number):Promise<CommitReceipt[]> {
   const commits=await request("/commits?sha="+branch+"&per_page="+Math.min(Math.max(limit,1),100),commitsSchema);
   return commits.map(row=>({sha:row.sha,url:row.html_url,committedAt:row.commit.committer?.date || ""}));
  },
  async listWorkflowRuns(sha:string):Promise<WorkflowRun[]> {
   const result:WorkflowRun[]=[];
   for(let page=1;;page++) {
    const payload=await request("/actions/workflows/deploy-pages.yml/runs?head_sha="+encodeURIComponent(sha)+"&per_page=100&page="+page,z.object({workflow_runs:z.array(runSchema)}));
    result.push(...payload.workflow_runs.map(row=>({id:row.id,headSha:row.head_sha,status:row.status,conclusion:row.conclusion,url:row.html_url,workflowPath:row.path})));
    if(payload.workflow_runs.length<100) return result;
    if(page>=10) throw new AppError(502,"INCOMPLETE_RUNS","发布记录过多，无法确认最新状态。");
   }
  },
  async checkConnection():Promise<{repositoryExists:boolean;branchExists:boolean;workflowExists:boolean}> {
   const result={repositoryExists:false,branchExists:false,workflowExists:false};
   try { await request("",z.unknown()); result.repositoryExists=true; await head(); result.branchExists=true; await request("/contents/.github/workflows/deploy-pages.yml?ref="+branch,z.unknown()); result.workflowExists=true; }
   catch(error) { if(!(error instanceof AppError && error.status===404)) throw error; }
   return result;
  }
 };
}


import { z } from "zod";
import { AppError } from "#worker/errors";
import type { WorkerEnv } from "#worker/env";
export function repositoryBase(env: WorkerEnv): string {
 if(!env.GITHUB_OWNER || !env.GITHUB_REPO || !/^[\w.-]+$/.test(env.GITHUB_OWNER) || !/^[\w.-]+$/.test(env.GITHUB_REPO)) throw new AppError(503,"NOT_CONFIGURED","请先配置目标 GitHub 仓库。");
 return "/repos/"+encodeURIComponent(env.GITHUB_OWNER)+"/"+encodeURIComponent(env.GITHUB_REPO);
}
export async function githubRequest<T>(token: string, path: string, schema: z.ZodType<T>, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
 let response:Response;
 try {
  response=await fetcher("https://api.github.com"+path,{...init,signal:AbortSignal.timeout(20000),headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"BQL-Blog-Admin","Content-Type":"application/json",...init.headers}});
 } catch { throw new AppError(502,"GITHUB_UNAVAILABLE","GitHub 暂时无法连接，请稍后重试。"); }
 if(!response.ok) {
  if(response.status===429 || (response.status===403 && (response.headers.get("x-ratelimit-remaining")==="0" || response.headers.has("retry-after")))) {
   const retry=Number(response.headers.get("retry-after")) || 60;
   const reset=Number(response.headers.get("x-ratelimit-reset"))*1000 || Date.now()+retry*1000;
   throw new AppError(429,"RATE_LIMIT","GitHub 请求次数受限，请等待后重试。",reset);
  }
  const messages:Record<number,string>={401:"GitHub 授权已失效，请重新登录。",403:"当前账号没有操作该仓库的权限。",404:"仓库、分支或文件不存在。",409:"仓库版本发生变化，请重新读取后确认。",422:"GitHub 拒绝了此次修改，请检查路径或刷新版本。"};
  throw new AppError(response.status>=500 ? 502 : response.status,"GITHUB_"+response.status,messages[response.status] || "GitHub 请求未完成，请稍后重试。");
 }
 if(response.status===204) return schema.parse(null);
 try { return schema.parse(await response.json()); } catch { throw new AppError(502,"GITHUB_RESPONSE","GitHub 返回了无法识别的数据。"); }
}
export function toBase64(bytes: Uint8Array): string {
 let binary=""; for(let offset=0;offset<bytes.length;offset+=8192) binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
 return btoa(binary);
}
export function fromBase64(value: string): Uint8Array {
 const binary=atob(value.replace(/\s/g,"")); return Uint8Array.from(binary,character=>character.charCodeAt(0));
}


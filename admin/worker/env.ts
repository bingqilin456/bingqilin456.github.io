import type { SetupStatus } from "#shared/contracts";

export interface SessionStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
export interface WorkerEnv {
  ASSETS?: { fetch(request: Request): Promise<Response> }; SESSIONS?: SessionStore;
  GITHUB_OWNER?: string; GITHUB_REPO?: string; GITHUB_BRANCH?: string; BLOG_URL?: string; APP_ORIGIN?: string;
  GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string; SESSION_SECRET?: string; ALLOWED_GITHUB_USERS?: string;
}
export function getSetupStatus(env: WorkerEnv): SetupStatus {
  const required = ["GITHUB_OWNER", "GITHUB_REPO", "APP_ORIGIN", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SESSION_SECRET"];
  const values: Record<string, string | undefined> = { GITHUB_OWNER: env.GITHUB_OWNER, GITHUB_REPO: env.GITHUB_REPO, APP_ORIGIN: env.APP_ORIGIN, GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET, SESSION_SECRET: env.SESSION_SECRET };
  const missing = required.filter(key => !values[key]?.trim());
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET（至少 32 个字符）");
  if (!env.SESSIONS) missing.push("SESSIONS");
  if (env.APP_ORIGIN) {
    try {
      const origin = new URL(env.APP_ORIGIN);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
      if (origin.origin !== env.APP_ORIGIN || (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))) missing.push("APP_ORIGIN（HTTPS 或本机开发地址）");
    } catch { missing.push("APP_ORIGIN（有效地址）"); }
  }
  return { configured: missing.length === 0, missing, repository: env.GITHUB_OWNER && env.GITHUB_REPO ? `${env.GITHUB_OWNER}/${env.GITHUB_REPO}` : null, branch: env.GITHUB_BRANCH || "master", blogUrl: env.BLOG_URL || null };
}

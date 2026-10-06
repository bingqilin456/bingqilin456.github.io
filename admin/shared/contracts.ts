export interface PostFields {
  title: string; published: string; updated?: string; draft: boolean; description: string; image: string;
  tags: string[]; category: string | null; lang: string; pinned: boolean; author: string; sourceLink: string;
  licenseName: string; licenseUrl: string; comment: boolean; password: string; passwordHint: string; wikiExclude: boolean;
}
export interface PostDocument { path: string; sha: string; raw: string; fields: PostFields; body: string }
export interface PostSummary {
  path: string; sha: string; title: string; published: string; updated?: string;
  draft: boolean; pinned: boolean; tags: string[]; category: string | null; error?: string;
}
export interface FileMutation { path: string; expectedSha: string | null; content: string | Uint8Array | null }
export interface CommitReceipt { sha: string; url: string; committedAt: string }
export interface TaxonomyChange {
  kind: "tag" | "category"; action: "rename" | "merge" | "remove"; source: string; target?: string;
  expected: Array<{ path: string; sha: string }>;
}
export interface MediaItem { path: string; sha: string; name: string; size: number }
export interface RepositoryFile { path: string; sha: string; size: number; mode: string }
export interface WorkflowRun { id: number; headSha: string; status: string; conclusion: string | null; url: string; workflowPath: string }
export interface DeploymentRecord { commit: CommitReceipt; run: WorkflowRun | null }
export interface ConnectionCheck { repositoryExists: boolean; branchExists: boolean; workflowExists: boolean }
export interface SessionView { user: { login: string; avatarUrl: string }; csrfToken: string; expiresAt: number }
export interface SetupStatus { configured: boolean; missing: string[]; repository: string | null; branch: string; blogUrl: string | null }
export interface ApiFailure { error: { code: string; message: string; requestId: string; retryAt?: number } }
export interface Repository {
  listFiles(): Promise<RepositoryFile[]>;
  readFile(path: string): Promise<{ sha: string; raw: string }>;
  readBytes(path: string): Promise<Uint8Array>;
  commit(changes: readonly FileMutation[], message: string, expectedPosts?: readonly {path:string;sha:string}[]): Promise<CommitReceipt>;
  listCommits(limit: number): Promise<CommitReceipt[]>;
  listWorkflowRuns(sha: string): Promise<WorkflowRun[]>;
  checkConnection(): Promise<ConnectionCheck>;
}

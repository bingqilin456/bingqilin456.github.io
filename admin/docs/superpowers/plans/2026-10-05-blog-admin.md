# BQL Blog Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为 bingqilin456 的博客交付可在线登录、编辑 Markdown/MDX、管理标签分类和图片并跟踪 GitHub Pages 发布的后台源码。

**Architecture:** `BQL-Blog/admin/` 是独立 React/Vite 工程，Cloudflare Worker 同源承载界面与接口。GitHub 存储内容，KV 存储加密的登录会话；只有通过管理员身份验证的接口可以访问固定仓库。内容写入生成单个 Git commit，并采用非强制分支更新保护并发编辑。

**Tech Stack:** Node >=24、pnpm、React 19、Vite 8、TypeScript、Tailwind CSS 4、选用的 Shadcn Admin/Radix 组件、TanStack Table、React Router、yaml、Zod、dayjs、marked、DOMPurify、Cloudflare Workers/KV、Web Crypto、Node 内置测试运行器（原生 TypeScript）。后台依赖独立锁定，不升级博客依赖。

**Spec:** `BQL-Blog/admin/docs/2026-10-05-blog-admin-design.md`。状态：已批准执行。

## Global Constraints

- 新增文件限于 `admin/`；用户已授权必要依赖、工程配置和设计／实施计划。
- 不执行当前工作区的 Git 提交、推送、分支操作或创建线上资源；任务结束用核验结果代替技能示例中的 commit 步骤。
- GitHub 仓库尚未创建；owner、repo、branch、站点 URL 是部署配置，不推断已存在的仓库。
- 文章路径为 `src/content/posts/**/*.{md,mdx}`；保留正文、未知 YAML 字段和注释，不执行 MDX。
- 新文章默认为草稿，已发布文章保存明确提示重新部署，GitHub 提交成功与上线成功分别显示。
- 上传 PNG/JPEG/WebP/AVIF/GIF，每张不超过 5 MB，保存在 `src/content/posts/assets/`。
- OAuth state 有效期 10 分钟，会话有效期 8 小时并受 GitHub token 实际有效期约束。
- 每次写操作必须验证会话、管理员、Origin、CSRF 和固定路径；任何配置不足不得启用内容写入。
- 不引入 Playwright、E2E、视觉回归或新测试框架配置；高影响逻辑使用少量聚焦的 Node 测试，UI 使用类型检查、构建及人工交互核验。
- 所有界面使用中文，主题色相 165，默认深色，同时支持浅色、键盘操作与移动端导航。

## Review Focus

1. 含中文、多层目录、CRLF、YAML 注释和未知字段的 MDX：只修改用户指定字段，正文和未知字段保留，归任务 2。
2. 两台设备同时编辑或目录含符号链接：冲突不覆盖、不强制更新，链接不作为可写内容，归任务 3。
3. OAuth state 篡改、过期及非站长账号：不能登录或调用写接口，归任务 4。
4. 分类合并碰到坏 frontmatter、已修改文件，图片伪装扩展名：整个批量操作失败或拒绝上传，归任务 5。
5. Actions 只返回旧构建、分页漏项、读取被截断、未创建仓库：不虚报完整内容或上线成功，归任务 3、6、8。

## File Structure

全部路径均相对 `BQL-Blog/admin/`。

| 文件 | 职责 |
| --- | --- |
| `package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`vite.config.ts`、`wrangler.jsonc`、`index.html` | 独立工程、构建、静态资源和同源 API 代理 |
| `LICENSE.shadcn-admin`、`docs/DEPLOYMENT.md` | 上游版权和可操作的部署说明 |
| `shared/contracts.ts`、`shared/post-schema.ts` | 请求／响应类型和既有文章字段校验 |
| `shared/content.ts`、`shared/paths.ts`、`shared/taxonomy.ts` | YAML 往返编辑、路径与相对图片引用、分类标签操作 |
| `worker/env.ts`、`worker/errors.ts` | 配置检查及统一错误响应 |
| `worker/github.ts`、`worker/repository.ts` | GitHub HTTP、完整索引和原子提交 |
| `worker/crypto.ts`、`worker/auth.ts` | 签名、会话加密、OAuth 与身份验证 |
| `worker/content-service.ts`、`worker/media.ts`、`worker/publishing.ts`、`worker/index.ts` | 内容服务、上传、发布记录和路由 |
| `src/main.tsx`、`src/app.tsx`、`src/styles.css` | 启动、路由与主题变量 |
| `src/components/ui/`、`src/components/admin-layout.tsx` | 上游组件及专属侧栏布局 |
| `src/lib/api.ts`、`src/features/auth/session.tsx`、`src/lib/preview.ts` | 类型化请求、登录状态和清理后的预览 |
| `src/features/dashboard/page.tsx`、`src/features/posts/page.tsx` | 工作台与文章列表 |
| `src/features/editor/page.tsx`、`src/features/editor/fields.tsx` | 正文与属性编辑 |
| `src/features/taxonomy/page.tsx`、`src/features/media/page.tsx` | 标签分类及图片管理 |
| `src/features/publishing/page.tsx`、`src/features/settings/page.tsx` | 发布记录与连接信息 |
| `src/features/auth/page.tsx` | GitHub 登录和配置不足说明 |
| `checks/content.test.ts`、`checks/repository.test.ts`、`checks/auth.test.ts`、`checks/worker.test.ts` | 高影响逻辑的聚焦验证，模拟响应不进入产品 |

## Shared Interfaces

在 `shared/contracts.ts` 定义以下类型，后续任务不得另起名称或使用 `any`：

- `PostFields`：设计第 5 节的编辑字段；日期为字符串，标签为 `string[]`，分类为 `string | null`，默认值与博客一致。
- `PostDocument = { path: string; sha: string; raw: string; fields: PostFields; body: string }`。
- `PostSummary = { path: string; sha: string; title: string; published: string; updated?: string; draft: boolean; pinned: boolean; tags: string[]; category: string | null; error?: string }`，不包含文章密码。
- `FileMutation = { path: string; expectedSha: string | null; content: string | Uint8Array | null }`；null expectedSha 表示新建，null content 表示删除。
- `CommitReceipt = { sha: string; url: string; committedAt: string }`。
- `TaxonomyChange = { kind: 'tag' | 'category'; action: 'rename' | 'merge' | 'remove'; source: string; target?: string; expected: Array<{ path: string; sha: string }> }`。
- `MediaItem = { path: string; sha: string; name: string; size: number }`。
- `DeploymentRecord = { commit: CommitReceipt; run: { id: number; status: string; conclusion: string | null; url: string } | null }`。
- `SessionView = { user: { login: string; avatarUrl: string }; csrfToken: string; expiresAt: number }`；不包含 token。
- `SetupStatus = { configured: boolean; missing: string[]; repository: string | null; branch: string; blogUrl: string | null }`。
- `ApiFailure = { error: { code: string; message: string; requestId: string; retryAt?: number } }`。

## Task 1: 可构建的独立后台外壳

**Files:** 工程文件、上游许可、`src/main.tsx`、`src/app.tsx`、`src/styles.css`、`src/components/ui/`、`src/components/admin-layout.tsx`、`worker/env.ts`、`worker/errors.ts`、`worker/index.ts`、`shared/contracts.ts`。

**Interfaces:** 产出 `getSetupStatus(env: WorkerEnv): SetupStatus`、`handleRequest(request: Request, env: WorkerEnv): Promise<Response>`。`WorkerEnv` 声明 `ASSETS`、`SESSIONS`、`GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH`、`BLOG_URL`、`APP_ORIGIN`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`SESSION_SECRET`、`ALLOWED_GITHUB_USERS`。分支默认 `master`，站长默认 `bingqilin456`；`SESSIONS` 是 KV binding。

- [x] 下载选用的 Shadcn Admin UI 源文件及其依赖文件，记录来源，保留 MIT 许可；不整体复制演示工程和浏览器测试依赖。
- [x] 创建独立 package 和配置并运行 `pnpm install`，锁定实际使用的包；不修改博客的 package、lockfile 或配置。
- [x] 创建八个页面路由和品牌布局；未连接仓库时使用真实空状态，导航仍能访问连接说明。
- [x] 配置 Worker 静态资产 `binding: ASSETS`、`directory: ./dist`、SPA 回退和 `/api/*` Worker 优先；KV 配置使用明显的待配置标识，不创建线上 namespace。
- [x] 定义 `check: tsc --noEmit`、`build: tsc --noEmit && vite build`、`verify: node --test checks/content.test.ts checks/repository.test.ts checks/auth.test.ts checks/worker.test.ts`、`dev: vite`、`dev:api: wrangler dev --local --port 8787`；开发 UI 用 Vite，API 转发至本机 Wrangler。直接启动 Worker 使用构建后资产。
- [x] 运行 `pnpm check` 和 `pnpm build`，应退出 0；检查所有新文件均位于 `admin/`。

## Task 2: 与博客兼容的文章读写

**Files:** `shared/post-schema.ts`、`shared/content.ts`、`shared/paths.ts`、`shared/taxonomy.ts`、`checks/content.test.ts`。

**Interfaces:** 产出 `parsePost(path: string, sha: string, raw: string): PostDocument`、`serializePost(original: string | null, fields: PostFields, body: string): string`、`assertContentPath(path: string, kind: 'post' | 'image'): void`、`imageReference(postPath: string, imagePath: string): string`、`applyTaxonomy(fields: PostFields, change: TaxonomyChange): PostFields`。

- [x] 先写聚焦的内容验证：下列断言在对应实现缺失时失败。

```ts
assert.throws(() => assertContentPath('src/content/posts/../../config/siteConfig.ts', 'post'));
assert.throws(() => assertContentPath('src/content/posts/evil.svg', 'image'));
assert.equal(imageReference('src/content/posts/生活/记录.mdx', 'src/content/posts/assets/a.webp'), '../assets/a.webp');
const result = serializePost(originalWithCommentsAndCRLF, validFields, originalBody);
assert.equal(parsePost(path, 'sha', result).body, originalBody);
assert.equal(parseYamlFrontmatter(result).customKey, '原值');
assert.ok(result.includes('# 保留此注释'));
assert.deepEqual(applyTaxonomy(fieldsWithAAndB, mergeAToB).tags, ['B']);
```

`parseYamlFrontmatter`、样本正文和各输入为该测试文件内部 fixture/helper，不添加产品 API。

- [x] 执行 `node --test checks/content.test.ts`，确认上述行为尚未实现并失败。
- [x] 用 yaml 文档节点实现 frontmatter 编辑，保留 BOM、CRLF/LF 和正文；使用 schema 验证日期、可选属性及公开字段，不执行任何正文代码。
- [x] 校验解码后的路径，禁止空段、绝对路径、反斜杠、穿越、非允许扩展名；同名新建由仓库层拒绝。中文路径正常通过。
- [x] 执行同一验证，应通过；再运行 `pnpm check`。

## Task 3: 完整仓库索引与原子提交

**Files:** `worker/github.ts`、`worker/repository.ts`、`checks/repository.test.ts`。

**Interfaces:** 消费 `FileMutation`、`CommitReceipt` 和路径校验；产出 `createRepository(env: WorkerEnv, token: string, fetcher?: typeof fetch): Repository`。`Repository` 的方法为 `listFiles(): Promise<RepositoryFile[]>`、`readFile(path: string): Promise<{ sha: string; raw: string }>`、`readBytes(path: string): Promise<Uint8Array>`、`commit(changes: readonly FileMutation[], message: string): Promise<CommitReceipt>`；`RepositoryFile` 在 contracts 中定义 path、sha、size、mode。

- [x] 先写 GitHub mock 断言：旧 SHA 提交拒绝；新建重名拒绝；符号链接拒绝；tree 截断时继续遍历子树；两篇文章修改只更新一次 ref；ref 前进时返回 409，并且所有 ref 请求都包含 `force: false`。
- [x] 执行 `node --test checks/repository.test.ts`，确认失败。
- [x] 实现固定仓库的 fetch 封装、分页、超时及脱敏错误；对于截断 tree，逐目录获取完整树，不静默丢项。
- [x] 实现逐文件版本校验，以及 blob → tree → commit → 非强制 ref 更新。已检查的文件模式仅允许正常文件模式，不跟随 symlink。
- [x] 执行同一验证，应通过；网络 mock 必须完全隔离真实 GitHub 写入。

## Task 4: OAuth、会话和写接口保护

**Files:** `worker/crypto.ts`、`worker/auth.ts`、`checks/auth.test.ts`、`worker/index.ts`。

**Interfaces:** 产出 `beginLogin(request: Request, env: WorkerEnv): Promise<Response>`、`finishLogin(request: Request, env: WorkerEnv): Promise<Response>`、`requireSession(request: Request, env: WorkerEnv): Promise<AuthenticatedSession>`、`assertWriteRequest(request: Request, session: AuthenticatedSession, env: WorkerEnv): void`、`logout(request: Request, env: WorkerEnv): Promise<Response>`。内部 `AuthenticatedSession` 包含 user、csrfToken、expiresAt、服务端解密后的 token，禁止作为 API 响应返回。

- [x] 先写断言：篡改或过期 state 被拒绝；非白名单及无 push 权限用户得到 403；过期 session 得到 401；跨 Origin 或错误 CSRF 被拒绝；成功登录 cookie 含 HttpOnly/Secure/SameSite；KV 中不出现明文 token；退出删除会话；API JSON 不出现 token。
- [x] 执行 `node --test checks/auth.test.ts`，确认失败。
- [x] 实现 Web Crypto HMAC、AES-GCM 与随机标识；session secret 必须有足够长度，未配置时拒绝登录。
- [x] 实现带 600 秒 cookie 的 state/PKCE 流程、GitHub 身份重新验证及仓库权限检查；KV TTL 上限 28800 秒，实际 token 更短时同步缩短。
- [x] 接入 `/api/auth/login`、`/api/auth/callback`、`GET /api/session`、`POST /api/auth/logout`；所有内容接口先验证会话，每个写请求校验 Origin 与 CSRF。
- [x] 执行同一验证，应通过；cookie 的 HTTP 例外只能是回环地址的本机开发。

## Task 5: 文章、标签分类和图片接口

**Files:** `worker/content-service.ts`、`worker/media.ts`、`worker/index.ts`、`checks/worker.test.ts`。

**Interfaces:** 消费 Repository、内容函数及 AuthenticatedSession；产出 `listPosts(repo: Repository): Promise<PostSummary[]>`、`loadPost(repo: Repository, path: string): Promise<PostDocument>`、`savePost(repo: Repository, input: { path: string; expectedSha: string | null; fields: PostFields; body: string }): Promise<CommitReceipt>`、`deletePost(repo: Repository, path: string, expectedSha: string): Promise<CommitReceipt>`、`changeTaxonomy(repo: Repository, change: TaxonomyChange): Promise<CommitReceipt>`、`uploadImage(repo: Repository, file: File): Promise<{ item: MediaItem; commit: CommitReceipt }>`。

- [x] 先写请求断言：未登录不能读写；新建草稿结果含 `draft: true`；坏 frontmatter 只显示该篇错误且不能覆盖；分类批量操作遇到坏数据或 SHA 冲突时不提交；合并后的标签去重；图片超过 5 MB、文件头不符或 SVG 上传被拒绝。
- [x] 执行 `node --test checks/worker.test.ts`，确认失败。
- [x] 连接 `GET /api/posts`、`GET /api/post?path=`、`POST /api/post`、`DELETE /api/post`、`POST /api/taxonomy`、`GET /api/media`、`POST /api/media`、`GET /api/media/file?path=`；文件预览通过已鉴权的 Worker 读取，不暴露 GitHub token。
- [x] 文章保存验证全部公开字段，内部字段不允许通过表单覆盖。taxonomy 请求带完整受影响文章版本集合，与服务端当前集合比较；变化后要求用户重新确认。
- [x] 图片上传使用文件头检测和服务端唯一名称，保证 multipart 整体有明确大小上限；响应图片设置正确 MIME 和 nosniff。不提供图片删除接口。
- [x] 对 API 统一设置 no-store；保留中文错误、requestId 和限流恢复时间。执行同一验证及 `pnpm check`，应通过。

## Task 6: 提交对应的发布记录与连接检查

**Files:** `worker/publishing.ts`、`worker/index.ts`、`checks/repository.test.ts`、`checks/worker.test.ts`。

**Interfaces:** 产出 `listDeployments(repo: Repository, limit: number): Promise<DeploymentRecord[]>`、`checkConnection(repo: Repository): Promise<{ repositoryExists: boolean; branchExists: boolean; workflowExists: boolean }>`；扩展 Repository 类型为 `listCommits(limit: number): Promise<CommitReceipt[]>`、`listWorkflowRuns(sha: string): Promise<WorkflowRun[]>`、`checkConnection(): Promise<ConnectionCheck>`，在 contracts 定义对应类型。

- [x] 先补断言：只有其他 SHA 的成功运行时，目标提交 run 为 null；同一 SHA 多次重跑取最新一次；只认 `deploy-pages.yml`；Actions 分页能够找到目标 run；404 未创建仓库返回连接失败而不是空列表成功。
- [x] 执行 `node --test checks/repository.test.ts checks/worker.test.ts`，确认新增行为失败。
- [x] 实现 `GET /api/setup`（只展示公开配置完整性）、`GET /api/connection` 和 `GET /api/deployments`（需鉴权）。不提供修改 secrets、创建 repo 或手动重跑 workflow 的接口。
- [x] 运行相同验证，应通过；记录“等待运行／未触发”和“部署成功”的区分。

## Task 7: 完整的博客管理交互

**Files:** 前端 lib、auth、dashboard、posts、editor、taxonomy、media、publishing、settings 目录及必要的 UI 组件。

**Interfaces:** `apiRequest<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T>` 自动处理同源 cookie、CSRF 和 ApiFailure，使用共享响应 schema 对 JSON 的 unknown 值做运行时校验，不通过类型强转获得 T；响应 schema 与 contracts 同步定义。`useSession(): { session: SessionView | null; setup: SetupStatus | null; loading: boolean; refresh: () => Promise<void> }`；`renderPreview(markdown: string): string` 使用 marked 和 DOMPurify。页面全部使用此前约定的 API 类型，不复制仓库写入逻辑。

- [x] 实现登录、配置不足和错误状态，以及可切换的主题和移动端抽屉导航。
- [x] 实现工作台与列表：按真实内容计算统计，包含草稿，搜索、筛选、排序、分页和无内容提示；错误文章有单独的状态说明。
- [x] 实现编辑器：分组展示 18 个公开字段、Markdown/MDX 源码、清理后的基础预览、封面选择和图片插入；保留原路径，新增路径需用户确认。按钮区分草稿、发布及已发布更新，离开时保护未保存内容。
- [x] 实现 taxonomy 预览受影响文章、确认与批量修改，媒体上传进度和相对引用，发布记录及连接检查。使用日期工具显示客户端 Asia/Shanghai 日期，不伪造访问量统计。
- [x] 实现 401 重新登录、403、409 保留编辑内容、429 等待恢复和网络失败重试；请求未完成时禁止重复提交；预览不执行 MDX，未保存文章不生成已经上线的链接。
- [ ] `pnpm check`、`pnpm build` 已通过，无配置状态服务和所有页面入口已验证。响应式、主题切换和键盘焦点的浏览器人工验收待站长完成；未安装或启动 Playwright。

## Task 8: 最终验证与可部署交付

**Files:** `docs/DEPLOYMENT.md`，按验证结果修正之前任务的直接相关文件。

**Interfaces:** 部署文档准确描述此前确定的环境变量、KV binding、OAuth callback、公开仓库要求及命令。

- [x] 文档写明新建博客仓库、初次上传现有博客、目标 `master` 分支与已有 Pages workflow 的关系。解释后台提交发布与当前代理未执行真实线上写入的区别。
- [x] 写明 Cloudflare Worker/KV 创建、OAuth `/api/auth/callback` 配置和 secrets 填写方法，示例仅使用占位值；OAuth 的 `public_repo` 并非 GitHub 授权级别的单仓库限制。
- [x] 文档提供 `pnpm install`、`pnpm dev`、`pnpm dev:api`、`pnpm check`、`pnpm build`、`pnpm verify` 的用途。实际部署命令单独列出，由用户明确授权后才能执行。
- [x] 在 `admin/` 执行 `pnpm verify`、`pnpm check`、`pnpm build`，全部应退出 0；对博客执行既有 `pnpm check`，验证后台隔离。只有发生实际兼容性修改时再做博客完整构建。
- [x] 检查上游许可、新增文件范围、构建内没有明文 secrets、匿名接口不能返回文章正文和密码，所有异常路径有明确反馈。
- [x] 交付入口文件、运行方式、验证结果及未验证事项。没有仓库／OAuth 配置时明确真实登录、提交和部署尚未验证，不宣称线上系统已完成。

## Execution Handoff

用户已批准原生逐项执行；源码、部署文档和独立审查修复已完成。验证和取舍见 execution.md。真实线上资源与浏览器交互仍需配置后验收。

用户已添加并明确要求使用 `executing-plans`，本次已遵照其原生执行与一次独立最终审查流程；没有执行 Git 写操作或线上部署。

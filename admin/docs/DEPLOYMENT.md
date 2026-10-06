# BQL 博客后台部署与使用

实现源码已完成，线上仓库、OAuth App 和 Cloudflare 资源需由站长配置。当前代理没有创建线上资源、推送 GitHub 或执行部署。后台与博客是两个独立工程：博客保持原有 Astro/Svelte 构建，后台使用 Node 24、React/Vite 与 Worker。

## 1. 先让博客仓库与 Pages 可用

1. 在 GitHub 创建公开仓库。当前博客配置的地址是 https://bingqilin456.github.io/，与之匹配的用户站点仓库名为 **bingqilin456.github.io**。如果使用其他仓库名或自定义域名，先检查博客自身的 site/base 配置和实际访问地址。
2. 将现有 BQL-Blog 的源码放到仓库根目录，目标分支 **master**。不要上传 node_modules、dist、.astro、admin/.pnpm-store、admin/.wrangler、日志、.dev.vars 或任何 .env / 密钥文件。现有 .gitignore 不由本次工作修改，首次上传前请检查跟踪文件。
3. 保留已有 .github/workflows/deploy-pages.yml；在仓库 Settings → Pages 中选择 GitHub Actions 发布。首次推送后检查工作流成功，再记录实际博客地址。
4. 后台保存直接在 master 创建提交；push 会触发现有工作流。保存草稿也会触发构建，但 draft: true 的文章由博客过滤，不公开展示。发布记录仅匹配该提交 SHA 的 Pages 工作流；等待、运行中、失败和成功分别展示。

后台 OAuth 使用 **public_repo**。它是 GitHub 的公开仓库授权范围，并非 GitHub 授权层面的单仓库限制。Worker 仅访问配置的一个仓库，只写入 src/content/posts/。后台不修改博客工程配置、Pages 配置或其他目录。

## 2. 本地运行

后台要求 Node >= 24，使用其原生 TypeScript 检查运行器；博客仍遵循它原有的 Node/pnpm 要求。进入 BQL-Blog/admin 后：

~~~powershell
pnpm install
pnpm build
pnpm dev:api
~~~

再开一个终端，同样在 admin 中运行：

~~~powershell
pnpm dev
~~~

打开 http://127.0.0.1:5173/ 。API 由 Vite 转发到本地 8787 端口。未配置时可查看完整界面和连接说明，内容管理需要实际登录。不要使用 localhost 和 127.0.0.1 混合登录，cookie 与 Origin 必须一致。

当前受限开发环境中 Wrangler 默认全局日志目录不可写，可在 API 所在终端先执行下面的临时设置。这些设置只把开发缓存放到 admin 内：

~~~powershell
$env:XDG_CONFIG_HOME = Join-Path (Get-Location) '.wrangler/config'
$env:WRANGLER_LOG_PATH = Join-Path (Get-Location) '.wrangler/logs'
$env:WRANGLER_SEND_METRICS = 'false'
pnpm dev:api
~~~

本地真实登录需要单独 OAuth App：Homepage 为 http://127.0.0.1:5173，Callback 为 http://127.0.0.1:5173/api/auth/callback。通过你自己的安全方式将开发 secrets 提供给 Wrangler；不要提交 .dev.vars，且不要在聊天中发送密钥。服务端公开配置仍填在 wrangler.jsonc。

## 3. Cloudflare Worker 与 KV

后台部署目标是 **Cloudflare Workers + Static Assets**，不依赖博客的 GitHub Pages 服务器执行 API。

先使用 Cloudflare 控制台创建 KV namespace。把 namespace ID 替换到 admin/wrangler.jsonc 中的 REPLACE_WITH_KV_NAMESPACE_ID，binding 保持 SESSIONS。这个占位值只用于未配置的本机展示，不能用于线上部署。

部署前填写公开 vars：

| 配置 | 内容 |
| --- | --- |
| GITHUB_OWNER | bingqilin456，或实际仓库所有者 |
| GITHUB_REPO | 实际仓库名，不含 owner/ |
| GITHUB_BRANCH | master |
| BLOG_URL | 实际博客 HTTPS 地址 |
| APP_ORIGIN | 后台的 HTTPS origin，不带尾部斜杠或子路径 |
| GITHUB_CLIENT_ID | OAuth App 的 Client ID |
| ALLOWED_GITHUB_USERS | 管理员 GitHub 登录名，默认 bingqilin456；多个用英文逗号分隔 |

部署在域名根目录。assets.directory 为 ./dist，ASSETS 提供静态资源，SPA 回退负责前端路由，/api/* 先进入 Worker。请保留此路由规则，避免 API 落入静态页面回退。

## 4. GitHub OAuth App 与密钥

在 GitHub Settings → Developer settings → OAuth Apps 创建应用：

- Homepage URL：实际后台地址，例如 https://bql-blog-admin.YOUR-SUBDOMAIN.workers.dev
- Authorization callback URL：同一 origin 加 /api/auth/callback

将 Client ID 填到 wrangler.jsonc。通过 Cloudflare Dashboard Worker settings → Variables and Secrets 填写：

- GITHUB_CLIENT_SECRET：OAuth App 的 Client Secret
- SESSION_SECRET：至少 32 字符的独立随机密钥；推荐使用密码管理器生成高熵随机值。更换此值会使所有旧会话失效。

密钥不能放入公开 vars、前端 VITE_* 变量、源代码或 GitHub 仓库。后台只显示缺少的配置名，不返回密钥值。OAuth 的 state/PKCE 有效期为 10 分钟；登录后重新验证 GitHub 身份、白名单与公开仓库的 push 权限。Token 加密存入 KV，浏览器仅持有 HttpOnly/SameSite cookie；线上 cookie 必须 Secure。会话最多 8 小时，token 更短时同步缩短。写接口校验 Origin 与 CSRF。

## 5. 发布命令（由站长明确执行）

以下命令会创建或修改线上资源，本次实现没有运行。先完成 KV 与配置准备，确认目标账号与 Worker 名称，再由站长执行：

~~~powershell
pnpm exec wrangler login
pnpm build
pnpm exec wrangler deploy
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm exec wrangler secret put SESSION_SECRET
~~~

secret put 是交互输入，不要把值直接写到命令行或记录中。根据首次部署获得的域名检查 APP_ORIGIN 与 OAuth callback，修改公开配置后再次 deploy。生产登录必须从实际 HTTPS 域名进入，不使用本地例外。

Cloudflare KV 有跨区域传播延迟，登录或退出后跨设备访问可能短暂等待；到期校验仍由 Worker 的时间戳执行。需要立即使全部会话失效时，可轮换 SESSION_SECRET。

## 6. 管理内容

- 文章列表包含草稿，可搜索、筛选、排序与分页。格式异常单独标记，避免覆盖；先在仓库修复后刷新。
- 新建文章默认草稿；首次保存确认文件路径。已有文章保持路径，18 个公开字段可编辑；内部 prev*/next* 字段、未知字段与 YAML 注释保留。正文保持原始 Markdown/MDX，不执行 MDX。
- 发布或保存已发布文章会立即提交。将已发布文章保存为草稿需要再次确认；删除文章会触发重新构建与下线。未保存时，站内导航和关闭页面会提醒。
- 内容 SHA 或分支有冲突时，后台返回 409，不强制覆盖。保留并复制当前编辑内容，重新打开文章比对后保存。401 可在新窗口登录，再点重试/刷新会话。
- 提交成功但版本读取失败时，点击“重新读取保存版本”恢复，不会重复提交。确认版本期间继续输入的内容会保留；如果仓库又出现新修改，需要先复制内容再重新打开比对。
- 标签与分类来自全部文章的引用，包括草稿。重命名、合并、移除只改引用，作为单个提交保存；任何异常文章或文章集合变化都会阻断批量操作。
- 图片每张不超过 5 MB，支持 PNG/JPEG/WebP/AVIF/GIF；验证扩展名、MIME 与文件头，不支持 SVG。服务端生成唯一文件名。图库图片与文章使用相对路径进入现有博客图片管线，不提供删除。
- 基础 Markdown 预览经过 DOMPurify 清理。Mermaid、自定义卡片、MDX 组件等以博客实际构建为准。
- 草稿和文章密码依然位于公开 GitHub 仓库；博客的客户端加密不把仓库变成私密存储。

## 7. 检查与边界

~~~powershell
pnpm verify
pnpm check
pnpm build
~~~

verify 使用 Node 内置运行器与 GitHub mock，验证内容保留、路径、原子提交、OAuth/CSRF、异常数据、图片和发布匹配；不写入真实仓库。check 检查后台类型，build 产生 dist 静态界面。

本地验证涵盖未连接配置、匿名 API、SPA 入口及构建。没有真实仓库、OAuth 配置和线上资源时，真实 GitHub 登录、提交、Pages 发布与跨设备浏览器交互仍需部署后验收。未引入 Playwright 或浏览器截图测试。

UI 组件来自 [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin)，保留 LICENSE.shadcn-admin 与每个复制组件的来源 blob 注释；博客专属布局和业务交互由本工程实现。

参考官方文档：[GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)、[Git trees](https://docs.github.com/en/rest/git/trees)、[Cloudflare 静态资源配置](https://developers.cloudflare.com/workers/static-assets/binding/)。

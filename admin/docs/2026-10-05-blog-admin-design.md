# BQL 博客后台管理系统设计

日期：2026-10-05。状态：用户已批准并执行；实现与验证记录见 execution.md，线上配置见 DEPLOYMENT.md。

## 1. 目标与已确认条件

为 `BQL-Blog` 提供可以在不同设备登录的专属管理后台，采用 Shadcn Admin 的布局与组件，管理现有 Markdown/MDX 内容，通过 GitHub 保存并触发博客构建。

用户已确认线上使用方式，授权在 `BQL-Blog/admin/` 新建工程、安装必要依赖及编写设计和实施计划。此授权不包含创建 GitHub 仓库、提交或推送当前工作区、创建线上资源或实际部署。

已读取的项目依据：

- `src/content.config.ts`：文章目录为 `src/content/posts/**/*.{md,mdx}`，文章字段见第 5 节。
- `src/config/siteConfig.ts`：名称为“bingqilin456 的博客”，默认深色，主题色相为 165；GitHub Pages 地址目前是计划地址。
- `.github/workflows/deploy-pages.yml`：向 `master` 推送触发检查、构建及 GitHub Pages 部署。
- 本地文章目录为空，项目目录没有 `.git` 信息；用户确认 GitHub 仓库尚未创建。

成功标准：后台连接配置好的仓库后，管理员能够新增、编辑、删除文章，上传图片，管理标签和分类，并看到对应提交的构建结果。文章仍由现有 Astro 管线生成。

## 2. 已选择的架构与边界

独立 React/Vite 前端与 Cloudflare Worker 接口放在 `admin/`。Worker 同源提供静态界面和 `/api/`，GitHub 是文章及图片的唯一持久内容来源；Cloudflare KV 只保存登录会话。

选择独立工程是为了复用已经选定的 React 版 Shadcn Admin，同时保持博客的 Astro/Svelte 渲染和构建流程。集成到博客自身会引入 React 集成并调整原有工程；采用通用 CMS 会改变已经选择的界面及交互，两者不作为本次实施路径。

工程按职责分为前端页面、共享内容模型、登录会话、GitHub 访问、内容编辑和发布状态查询。前端通过接口调用 Worker，Worker 的身份验证与路径检查先于任何仓库操作。

只复用 Shadcn Admin 的布局、主题、表格、表单和弹窗组件。保留其 MIT 版权及许可；产品中使用真实博客数据，不复用销售统计、聊天、团队等演示模块。

## 3. 页面与交互

| 页面 | 行为 |
| --- | --- |
| 登录 | 展示博客品牌，GitHub 授权登录；配置不足时说明尚未接通登录 |
| 工作台 | 文章总数、已发布数、草稿数、标签数、最近修改及最近构建 |
| 文章列表 | 搜索标题与路径，按草稿、分类、标签筛选，排序、分页、新建、编辑、删除 |
| 文章编辑 | 标题和路径、正文源码与基础 Markdown 预览、文章属性、封面及图片插入 |
| 标签与分类 | 使用数、关联文章、更名、合并、从文章移除；显示操作影响数量 |
| 图片管理 | 仓库图片列表、上传、预览、复制引用、选作封面或插入编辑器 |
| 发布记录 | 显示提交时间及关联构建的等待、运行、成功、失败状态，链接日志和文章 |
| 连接信息 | 展示仓库、分支、站点地址及连接检查；不在浏览器中编辑服务端密钥 |

界面采用中文、青绿色强调色、清晰的侧栏层级、可切换深浅色和移动端抽屉导航。表格状态同时使用文字和颜色，所有输入有标签，弹窗支持键盘操作，网络操作有进行中反馈和失败重试入口。

## 4. 内容保存与发布语义

新增文章默认是草稿。保存草稿写入 `draft: true`；发布写入 `draft: false`。编辑已发布文章时按钮为“保存并更新”，明确该操作会提交内容并触发重新部署。将已发布文章转为草稿或删除会提示文章下线的影响。

保存成功表示 GitHub 提交成功；界面随后查询构建状态，只有相应部署成功才显示上线成功。构建失败保留提交信息并链接日志。保存失败不清空编辑内容。

未保存正文发生离开页面操作时提示。第一版不引入自动保存至独立草稿分支，也不将敏感文章内容长期缓存到浏览器存储。

基础预览使用 Markdown 渲染和 HTML 清理，不执行 MDX、脚本或任意组件。Mermaid、PlantUML、wiki 链接及博客专用语法保留原文，最终效果由博客构建确认；预览界面说明其范围。

## 5. 文章模型与兼容性

表单覆盖既有公开编辑字段：`title`、`published`、`updated`、`description`、`image`、`tags`、`category`、`draft`、`lang`、`pinned`、`author`、`sourceLink`、`licenseName`、`licenseUrl`、`comment`、`password`、`passwordHint`、`wikiExclude`。

`prevTitle`、`prevSlug`、`nextTitle`、`nextSlug` 是内部生成字段，不提供表单编辑。已有字段保留；不为新增文章写入内部字段。

解析文章时分离 YAML frontmatter 和正文。YAML 编辑采用文档节点修改，保留未编辑字段和未知字段、注释及原有换行风格；正文保存原始字符，不经过富文本转换。无法解析的 frontmatter 逐篇显示错误，并阻止覆盖该篇文章。

必填标题和发布日期，日期使用 `YYYY-MM-DD`；其他属性按现有 schema 校验。更新操作写入明确的更新日期，保留发布日期。空分类、空标签及可选字段采用现有模型允许的值。

新文章路径默认来自用户确认的 slug，允许合法的中文和目录层级；创建前检查重名。已有文章第一版不更改文件路径，避免破坏文章链接、评论映射及相对图片引用。

标签和分类从所有文章，包括草稿，统计；新名称在文章保存时实际建立。没有独立的空标签库。更名或合并修改文章的相应字段，标签合并后去重。删除标签或分类只移除文章中的引用，不删除文章。

## 6. GitHub 读写与冲突处理

仓库 owner、名称、目标分支、站点 URL 为部署配置。默认分支建议 `master`，以匹配现有工作流；连接检查会检测分支及工作流是否存在，不擅自创建仓库或调整分支。

读取 Git tree 建立文章与图片索引，再按需读取 blob。处理 GitHub 分页和 tree 截断，不能把不完整结果显示为完整内容列表。

每次编辑携带读取到的 blob SHA。保存前获取最新分支及文件版本；该文件变化则返回 409，提示重新载入，不自动覆盖。其他文件变化允许以最新 tree 为基础保存。

写入使用 Git Data API 创建 blob、tree 和单个 commit，再非强制更新分支引用。引用已前进造成更新失败时，返回冲突，禁止强制推送。标签和分类批量更名的所有文件组成一次提交，避免部分更新。

允许写入的路径固定为 `src/content/posts/` 下的 `.md`、`.mdx` 和许可图片扩展名。禁止路径穿越、绝对路径、符号链接、站点配置、工作流、验证文件及模型资源写入。请求不能自行指定其他仓库或分支。

## 7. 图片处理

新上传图片放在 `src/content/posts/assets/`，使用经过验证的唯一文件名；上传接口校验大小、扩展名及文件头，第一版接受 PNG、JPEG、WebP、AVIF 和 GIF，单文件上限 5 MB，不接收 SVG 或可执行文件。

封面和正文引用根据文章目录计算相对路径，使图片继续进入现有 Astro 图片优化管线。已有 `public/` 路径或远程图片引用原样保留。

第一版允许上传和引用，不提供永久删除图片功能，避免未识别的 MDX 或专用语法引用被破坏。图片上传后的 GitHub 提交会触发现有构建，界面显示操作结果。

## 8. 登录、会话与接口保护

使用 GitHub OAuth Web flow，带随机 state 和 PKCE。state 和 verifier 绑定到短期的签名 HttpOnly cookie，有效期为 10 分钟；回调验证绑定信息并清除该 cookie。回调交换 token 后由 Worker 读取 GitHub 用户身份，验证管理员白名单和目标仓库写权限。默认管理员为 `bingqilin456`，部署时以明确配置为准。

第一版面向公开博客仓库，请求 `public_repo` 权限。它不是限定单仓库的 OAuth 权限；服务端所有操作额外固定目标仓库。若未来使用私有仓库或要求 GitHub 授权本身限定单仓库，需要另行设计 GitHub App 权限接入。

OAuth secret 和会话密钥仅存放在 Worker secrets。GitHub token 使用会话密钥加密后保存在服务端 KV 会话中，浏览器仅持有随机会话标识的 HttpOnly、Secure、SameSite cookie。会话有效期为 8 小时，受 GitHub token 的实际有效期约束。退出清除 cookie 并删除会话；KV 的传播延迟不被表述为即时全局撤销保证。仅本机 HTTP 开发允许非 Secure cookie，线上必须使用 HTTPS。

未登录请求返回 401，非管理员返回 403。每个写操作验证同源 Origin、会话和 CSRF token。拒绝不支持的 Content-Type、超限请求和跨域写入。所有仓库内容接口返回 `Cache-Control: no-store`。

预览 HTML 经过清理，禁止运行上传内容和 MDX。前端和日志不回显服务端密钥或 GitHub token。文章密码只在已鉴权编辑界面显示；不改变博客既有客户端加密方案的保护能力。

## 9. 配置不足和错误状态

仓库未创建或 OAuth/KV 未配置时，后台展示清晰的连接说明，内容操作被禁用，不能伪造文章或发布成功。静态界面和本地构建仍可验证。

接口统一返回错误码、中文说明及必要的请求标识，不透传包含凭据的上游错误。401 提示重新登录；403 提示权限不足；404 区分仓库、分支和文章不存在；409 保留编辑内容并提示冲突；429 展示限流恢复时间；网络或 5xx 提供用户触发的重试。

批量修改前显示受影响文章及数量，删除文章使用明确确认。发布状态只查询指定 commit 的指定工作流；未找到运行时显示等待或未触发，不以旧构建代替。

## 10. 工程及验证范围

新增文件限于 `admin/`，包含独立 package、lockfile、Vite/TypeScript/Worker 配置、前端、接口、共享模型、许可和部署说明。只安装后台实际使用的依赖，不引入上游演示模块及浏览器测试体系。

验证内容包括后台类型检查和生产构建；对路径校验、内容往返保存、权限拒绝、版本冲突、批量提交原子性使用聚焦的验证，不新增测试框架配置。涉及博客输出兼容性的验证使用既有 `pnpm check` 和必要的 `pnpm build`。

本地可以使用隔离的模拟 GitHub 响应验证错误及保存流程，但产品中不提供跳过鉴权的演示入口。没有实际仓库和 OAuth 配置时，登录、真实提交及线上部署必须标注未验证。

当前阶段不执行 Git 提交、推送、创建仓库、注册 OAuth 应用、创建 KV、配置线上 secrets 或部署。代码完成后交付可运行源码和配置步骤；需要真实外部操作时以具体可审阅结果另行处理。

## 11. 实施衔接

设计批准后细化文件级实施计划，顺序为工程与模板复用、内容模型、鉴权、GitHub 读写、后台页面、发布记录、验证与交付。执行方式为当前对话单代理顺序实施。

用户已添加 `writing-plans` 技能，实施计划依据该技能编写。设计与实施计划均在实现前交由用户审核；依赖和工程创建的既有授权继续有效。

## 12. 参考来源

- [Shadcn Admin 源码](https://github.com/satnaing/shadcn-admin)
- [Shadcn Admin MIT 许可](https://github.com/satnaing/shadcn-admin/blob/main/LICENSE)
- [GitHub OAuth Web flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub Git tree API](https://docs.github.com/en/rest/git/trees)
- [GitHub Git reference API](https://docs.github.com/en/rest/git/refs)
- [Cloudflare Worker 静态资源](https://developers.cloudflare.com/workers/static-assets/)

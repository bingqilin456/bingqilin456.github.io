import { commentConfig } from "@/config";
import type { CommentConfig } from "@/types/config";

/**
 * giscus 客户端控制器。
 *
 * 为什么放在 src/utils/：项目约定客户端行为写在纯 TS 模块里、由组件的 <script>
 * 导入，不把逻辑内联进组件；这样同一段逻辑既能在浏览器里跑，也能在 node 的
 * 最小 DOM 替身下直接跑，用行为断言而不是文本匹配来验证。
 *
 * 生命周期：组件通过 definePageIsland 注册 mount/unmount，
 * mount 时调用 mountGiscus()，unmount 时把返回的 cleanup 调掉。
 * 这里再兜一层：mountGiscus() 会先执行上一次挂载遗留的 cleanup，
 * 即使调用方漏了 unmount，也不会累积 iframe 或 theme-change 监听。
 *
 * 4 个仓库参数不齐全时（承载评论的仓库尚未创建）不追加任何外部脚本、
 * 不注册监听，页面只显示组件层的"评论暂未开放"。
 */

const GISCUS_ORIGIN = "https://giscus.app";
const GISCUS_CLIENT = "https://giscus.app/client.js";

type GiscusConfig = NonNullable<CommentConfig["giscus"]>;

/** 上一次挂载的清理函数；重复挂载前必须先执行它。 */
let activeCleanup: (() => void) | null = null;

/** 仓库参数齐全才认为可挂载；缺任一项都只显示未开放提示。 */
export function isGiscusConfigured(
	config?: GiscusConfig,
): config is GiscusConfig &
	Required<Pick<GiscusConfig, "repo" | "repoId" | "category" | "categoryId">> {
	if (!config) return false;
	return Boolean(
		config.repo && config.repoId && config.category && config.categoryId,
	);
}

/** 当前主题映射到 giscus 的 theme 值。 */
export function getGiscusTheme(): string {
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** 给已挂载的 iframe 发送主题变更；没有 iframe 时静默返回。 */
export function syncGiscusTheme(config?: GiscusConfig): void {
	const resolved = config ?? commentConfig.giscus;
	if (!isGiscusConfigured(resolved)) return;
	const frame = document.querySelector<HTMLIFrameElement>(
		"iframe.giscus-frame",
	);
	if (!frame?.contentWindow) return;
	frame.contentWindow.postMessage(
		{ giscus: { setConfig: { theme: getGiscusTheme() } } },
		GISCUS_ORIGIN,
	);
}

/**
 * 挂载 giscus 客户端。
 *
 * @returns 清理函数：解绑本轮监听并移除已注入的 iframe/script。
 *          未配置或找不到容器时返回空清理函数，且不产生任何副作用。
 */
export function mountGiscus(config?: GiscusConfig): () => void {
	// 先清掉上一次挂载（正常路径由 unmount 调用，这里兜底）
	unmountGiscus();

	const resolved = config ?? commentConfig.giscus;
	if (!isGiscusConfigured(resolved)) return () => {};

	const container = document.querySelector<HTMLElement>(".giscus");
	if (!container) return () => {};

	container.innerHTML = "";

	const controller = new AbortController();
	const script = document.createElement("script");
	script.src = GISCUS_CLIENT;
	const attributes: Array<[string, string | undefined]> = [
		["data-repo", resolved.repo],
		["data-repo-id", resolved.repoId],
		["data-category", resolved.category],
		["data-category-id", resolved.categoryId],
		["data-mapping", resolved.mapping],
		["data-strict", resolved.strict],
		["data-reactions-enabled", resolved.reactionsEnabled],
		["data-emit-metadata", resolved.emitMetadata],
		["data-input-position", resolved.inputPosition],
		["data-theme", getGiscusTheme()],
		["data-lang", resolved.lang],
		["data-loading", resolved.loading],
	];
	for (const [name, value] of attributes) {
		if (value !== undefined) script.setAttribute(name, value);
	}
	script.setAttribute("crossorigin", "anonymous");
	script.setAttribute("async", "");
	container.appendChild(script);

	window.addEventListener("theme-change", () => syncGiscusTheme(resolved), {
		signal: controller.signal,
	});

	const cleanup = () => {
		controller.abort();
		container.innerHTML = "";
		if (activeCleanup === cleanup) activeCleanup = null;
	};
	activeCleanup = cleanup;
	return cleanup;
}

/** 解除当前挂载（幂等；没有挂载时什么都不做）。 */
export function unmountGiscus(): void {
	const cleanup = activeCleanup;
	activeCleanup = null;
	if (cleanup) cleanup();
}

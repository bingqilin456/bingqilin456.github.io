import type { CommentConfig } from "../types/config";

export const commentConfig: CommentConfig = {
	// 评论系统类型: none, twikoo, waline, giscus, disqus, artalk，默认为none，即不启用评论系统
	// 第一版改用 giscus（GitHub Discussions 承载），不再依赖自建服务端；
	// 评论者必须登录 GitHub。
	type: "giscus",

	//twikoo评论系统配置，版本1.7.4
	twikoo: {
		envId: "",
		// 设置 Twikoo 评论系统语言
		lang: "zh-CN",
		// 是否启用文章访问量统计功能
		visitorCount: false,
	},

	//waline评论系统配置
	waline: {
		// waline 后端服务地址
		// 未配置：留空时前端不挂载联网客户端，也不会把请求落到当前站点域名
		serverURL: "",
		// 设置 Waline 评论系统语言
		lang: "zh-CN",
		// 设置 Waline 评论系统表情地址
		emoji: [],
		// 可配置兼容的自建图片接口；留空时使用 Waline 原生内嵌图片
		// 评论登录模式。可选值如下：
		//   'enable'   —— 默认，允许访客匿名评论和用第三方 OAuth 登录评论，兼容性最佳。
		//   'force'    —— 强制必须登录后才能评论，适合严格社区，关闭匿名评论。
		//   'disable'  —— 禁止所有登录和 OAuth，仅允许匿名评论（填写昵称/邮箱），适用于极简留言。
		login: "enable",
		// 是否启用文章访问量统计功能
		visitorCount: false,
	},

	// artalk评论系统配置
	artalk: {
		// artalk后端程序 API 地址
		server: "",
		// 设置 Artalk 语言
		locale: "zh-CN",
		// 是否启用文章访问量统计功能
		visitorCount: false,
	},

	//giscus评论系统配置
	// 仓库与分类参数来自 https://giscus.app/ 生成的配置。
	giscus: {
		// 设置 Giscus 评论系统仓库
		repo: "bingqilin456/bql_blog_comments",
		// 设置 Giscus 评论系统仓库ID
		repoId: "R_kgDOU8UwBQ",
		// 设置 Giscus 评论系统分类
		category: "Announcements",
		// 获取 Giscus 评论系统分类ID
		categoryId: "DIC_kwDOU8UwBc4DHEtC",
		// 获取 Giscus 评论系统映射方式
		mapping: "pathname",
		// 获取 Giscus 评论系统严格模式
		strict: "1",
		// 获取 Giscus 评论系统反应功能
		reactionsEnabled: "1",
		// 获取 Giscus 评论系统元数据功能
		emitMetadata: "0",
		// 获取 Giscus 评论系统输入位置
		inputPosition: "top",
		// 获取 Giscus 评论系统语言
		lang: "zh-CN",
		// 获取 Giscus 评论系统加载方式
		loading: "lazy",
	},

	//disqus评论系统配置
	disqus: {
		// 获取 Disqus 评论系统
		shortname: "",
	},
};

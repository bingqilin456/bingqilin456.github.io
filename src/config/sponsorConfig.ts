import type { SponsorConfig } from "../types/config";

export const sponsorConfig: SponsorConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "打赏",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 赞助用途说明
	usage: "",

	// 是否显示赞助者列表
	showSponsorsList: false,

	// 赞助方式列表
	// 第一版不公开打赏页，也不沿用原作者收款信息；以后用户确认后再补
	methods: [],

	// 赞助者列表（可选）
	sponsors: [],
};

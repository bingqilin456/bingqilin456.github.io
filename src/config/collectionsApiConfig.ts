import type { CollectionsApiConfig } from "../types/config";

export const collectionsApiConfig: CollectionsApiConfig = {
	// 页面标题，留空则使用 i18n 翻译
	title: "",
	// 页面描述，留空则使用 i18n 翻译
	description: "",

	// API 收藏列表（按 category 分组）
	// 第一版为空：不沿用原作者的收藏清单，页面复用已有空状态；以后由用户补充
	apis: [],
};

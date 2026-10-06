import type { AnnouncementConfig } from "../types/config";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题
	title: "公告",

	// 公告列表（sort 越大越靠前）
	// 第一版先无内容：不制造"本站上线日期""管理员已开启审核"等尚未发生的事实，
	// 首页公告条在空数组下不渲染（HomeTicker 已有长度判断）
	items: [],

	// 是否允许用户关闭公告
	closable: true,
};

import type { FooterConfig } from "../types/config";

export const footerConfig: FooterConfig = {
	// 社交链接（mailto:/tel: 开头的链接不会在新标签打开）
	// 第一版只保留用户已确认的入口，未确认的邮箱 / QQ / B站 等不放进来
	socialLinks: [
		{
			label: "GitHub",
			href: "https://github.com/bingqilin456",
			icon: "fa7-brands:github",
		},
		{
			label: "RSS",
			href: "/rss/",
			icon: "fa7-solid:rss",
		},
	],

	// 备案信息（icp/police 留空则不显示对应条目）
	// 新站未备案，留空即不渲染；原站的公安备案图标文件也未随项目复制
	beian: {
		icp: "",
		police: "",
		policeIcon: "",
		icpUrl: "",
		policeUrl: "",
	},

	// Powered by 信息
	poweredBy: [
		{ label: "框架", name: "Astro", href: "https://astro.build" },
		{
			label: "主题",
			name: "Firefly",
			href: "https://github.com/CuteLeaf/Firefly",
		},
	],
};

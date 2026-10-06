import type { HomeConfig } from "../types/config";

export const homeConfig: HomeConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/" 开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	// 注意：当前仍是原站头像，属"原站预览素材，待用户选定后替换"
	avatar: "assets/images/avatar.webp",

	// 名字
	name: "bingqilin456",

	// 首页展示名字（留空则使用 name）
	displayName: "bingqilin456",

	// 职业/身份标签
	// 第一版不展示求职方向或职业称号，留空即不渲染该行
	occupation: "",

	// 个人签名（支持多条，会循环打字+删除效果）
	// 可替换的默认文案
	bio: ["记录学习与生活。"],

	hero: {
		backgroundImage: "/assets/images/home/home.avif",
		mosaic: {
			rows: 4,
			columns: 6,
			idleVisible: 6,
			idleInterval: 900,
			seed: 20260814,
			// 首屏六块碎片按 reveal rank 放置；滚动或轮换后的随机布局不受影响。
			initialLayout: [
				{ x: 0.14, y: 0.305, width: 0.104, height: 0.205 },
				{ x: 0.435, y: 0.18, width: 0.068, height: 0.13, blur: 5.5 },
				{ x: 0.642, y: 0.368, width: 0.047, height: 0.092, blur: 5 },
				{ x: 0.863, y: 0.402, width: 0.097, height: 0.19 },
				{ x: 0.337, y: 0.653, width: 0.159, height: 0.313 },
				{ x: 0.639, y: 0.751, width: 0.116, height: 0.228 },
			],
			scrub: 0.45,
			// 滑动距离整体砍半，同样的滚动量推进更快
			desktopScrollDistance: 3250,
			mobileScrollDistance: 2300,
			desktopDialogueTailDistance: 240,
			mobileDialogueTailDistance: 180,
			desktopMinViewports: 4.05,
			mobileMinViewports: 3.05,
			interactionHold: 0.06,
		},
		// 第一版不展示外部联系方式（原站此处为作者 B 站账号），留空即不渲染该卡片
		sticker: {
			image: "/assets/images/home/character.avif",
			alt: "黑猫角色贴纸",
			eye: {
				xPercent: 41.1,
				yPercent: 48.2,
				travelXPercent: 1.4,
				travelYPercent: 1,
			},
			rightEye: {
				xPercent: 64.1,
				yPercent: 44.7,
			},
			mouth: {
				xPercent: 53.4,
				yPercent: 50.7,
				widthPercent: 7.2,
				heightPercent: 1.9,
				rotation: -6,
				travelScale: 0.45,
			},
		},
		// galgame 对话框（写死暗黑主题）。内容全部由此驱动，可自由增删
		dialogue: {
			enabled: true,
			speakers: {
				host: "站长",
				visitor: "访客",
			},
			menuTitle: "想聊点什么？",
			typingSpeed: 45,
			autoDelay: 1600,
			// 默认逐句播放的简介，末句后弹出话题菜单
			intro: [
				{ speaker: "host", text: "欸——来客人了，随便坐，别客气。" },
				{ speaker: "host", text: "这儿归我管了，慢慢逛～" },
				{
					speaker: "host",
					text: "对了，得搬上简介了~找找：记录学习与生活。",
				},
				{ speaker: "host", text: "想打听啥？戳戳下面的话题，我跟你慢慢唠～" },
			],
			// 话题菜单：点击进入逐句对话，末句后返回菜单
			topics: [
				{
					title: "关于我",
					lines: [
						{ speaker: "visitor", text: "这个博客是谁在写呀？" },
						{
							speaker: "host",
							text: "站长自己～他还在一路学习中，写点东西记录下来。",
						},
						{ speaker: "visitor", text: "都写些什么呢？" },
						{
							speaker: "host",
							text: "学习和生活都会写，现在还没动笔，慢慢来～",
						},
					],
				},
				{
					title: "转一圈",
					lines: [
						{ speaker: "visitor", text: "这里都有什么呀？" },
						{
							speaker: "host",
							text: "有文章、相册、音乐和留言板，导航栏上都能找到～",
						},
						{ speaker: "visitor", text: "现在有内容看吗？" },
						{
							speaker: "host",
							text: "文章和相册都还空着，等站长慢慢填，你以后再来看看～",
						},
						{ speaker: "host", text: "想说话就去留言板，慢慢逛～" },
					],
				},
			],
		},
		// 玻璃雨珠 + 撞击水花（移动端自动降低密度，尊重 prefers-reduced-motion）
		rain: {
			enabled: true,
			intensity: 0.6,
			// 留空则随主题自动取色（暗色→白 / 浅色→深灰）；也可填 "#7fb0ff" 或 "127,176,255"
			color: "#ffffff",
		},
	},

	dataLayer: {
		visitImage: "/assets/images/home/home-data-1.avif",
		archiveImage: "/assets/images/home/home-data-2.avif",
		contactImage: "/assets/images/home/home-data-3.avif",
	},

	// 桌面端双层影像交互：固定背景揭示 → 五幕画面横向叙事
	homeBlinds: {
		enabled: true,
		reveal: {
			backgroundImage: "/assets/images/home-blinds/act2/1.webp",
			foregroundImage: "/assets/images/home-blinds/act1/1.webp",
			foregroundAlt: "奔跑人物剪影",
			foregroundOpacity: 0.5,
			pointerTravel: 28,
			// 长条横移揭示的入场标题：标题单行显示（版式按 4 字排），
			// 祝福语单行显示（版式按 5 字排），可自由增减条数
			headline: {
				title: "祝愿各位",
				messages: ["夜路有星光", "岁岁皆欢愉", "所念皆星河", "版本无回滚"],
				enterDuration: 0.6,
				messageHold: 2.6,
				messageFlipDuration: 0.75,
			},
		},
		scenes: {
			scrollDistance: 3400,
			// 背景跑马灯：列表从右往左无缝循环，只有一张也会自动复制到铺满
			cycleImages: ["/assets/images/home-blinds/act-cycle/1.webp"],
			cycleDuration: 26,
			composite: {
				eyebrow: "PROLOGUE / RUN",
				title: "筑一间小屋",
				description: "以代码为梁、热爱为瓦，荒原上筑起一间自己的小屋。",
				alt: "第一幕插画",
				// 明信片右下角的落款日期，按每张图的实际日期改；删掉即不显示。
				// 第一版不沿用原站时间线，先留空
				date: "",
			},
			items: [
				{
					eyebrow: "SCENE 02 / LIGHT",
					title: "点亮灯火",
					description: "点亮灯火的这一刻，小屋有了能被人找到的样子。",
					image: "/assets/images/home-blinds/act3/1.webp",
					alt: "第二幕插画",
					date: "",
				},
				{
					eyebrow: "SCENE 03 / WIND",
					title: "尘满窗台",
					description: "人往学海拾新，倦意悄悄落了窗，小屋静候，蒙上薄尘。",
					image: "/assets/images/home-blinds/act3/2.webp",
					alt: "第三幕插画",
					date: "",
				},
				{
					eyebrow: "SCENE 04 / PAGE",
					title: "重燃灯火",
					description: "拂去薄尘，重燃灯火，一砖一瓦再把小屋细细打磨。",
					image: "/assets/images/home-blinds/act3/3.webp",
					alt: "第四幕插画",
					date: "",
				},
				{
					eyebrow: "FINALE / ARRIVE",
					title: "抵达之前",
					description: "笔墨暂歇，来日方长；下一程山水，且歌且行。",
					image: "/assets/images/home-blinds/act3/4.webp",
					alt: "第五幕插画",
					date: "",
				},
			],
			standImages: ["/assets/images/home-blinds/act4/1.webp"],
		},
	},

	// 链接配置
	// 已经预装的图标集：fa7-brands，fa7-regular，fa7-solid，material-symbols，simple-icons
	// 访问https://icones.js.org/ 获取图标代码，
	// 如果想使用尚未包含相应的图标集，则需要安装它
	// `pnpm add @iconify-json/<icon-set-name>`
	// showName: true 时显示图标和名称，false 时只显示图标
	// 第一版只保留用户已确认的入口：GitHub、站内留言、RSS
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/bingqilin456",
			showName: false,
		},
		{
			name: "站内留言",
			icon: "material-symbols:chat-rounded",
			url: "/guestbook/",
			showName: false,
		},
		{
			name: "RSS",
			icon: "fa7-solid:rss",
			url: "/rss/",
			showName: false,
		},
	],
};

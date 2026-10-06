import type { MusicPlayerConfig } from "../types/config";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 禁用音乐播放器方法：
	// 在本配置文件把showInNavbar设为false即可关闭导航栏入口

	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	// 第一版用户歌单待提供：用 local 空歌单，避免向原站 Meting 服务发起请求
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.6,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "list",

	// 是否显启用歌词
	showLyrics: true,

	// Meting API 配置
	// 第一版未使用 Meting（mode 为 local），这里保留结构但清空第三方地址，
	// 以后确认可用的服务再填，不沿用原作者歌单
	meting: {
		// Meting API 地址
		api: "",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: "netease",
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [],
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/使一颗心免于哀伤-哼唱.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	// 第一版歌单待用户提供：空数组时播放器显示"暂无歌曲"且不可播放
	local: {
		playlist: [],
	},

	// 可视化器配置
	visualizer: {
		background: {
			dark: "#000000",
			light: "#000000",
		},
		camera: {
			position: {
				x: 0,
				y: 32,
				z: 52,
			},
		},
		autoRotate: true,
		autoRotateSpeed: 0.3,
		height: {
			// 静态地形起伏高度，不播放时也会有轻微波动
			idle: 0.6,
			// 超低频高度，主要影响中央区域的大起伏
			subBass: 4.0,
			// 低频高度，主要跟随鼓点和低音起伏
			bass: 3.0,
			// 中低频高度，补充地形整体层次
			lowMid: 2.0,
			// 中频高度，影响流动感较强的区域
			mid: 2.5,
			// 中高频高度，影响外围零散跳动
			highMid: 2.0,
			// 高能量瞬间的随机尖峰高度
			energy: 4.0,
			// 普通点击/音频涟漪高度
			ripple: 3.0,
			// 白色强调涟漪高度
			rippleAccent: 1.0,
		},
		// 想要红色：用 #ff4444
		// 想要透明度：别塞进 rippleColor，单独加一个 rippleOpacity 或 rippleAlpha
		theme: {
			base1: "#000000",
			base2: "#000000",
			coolCore: "#16b8c9",
			coolEdge: "#69dce7",
			warmCore: "#8be8ee",
			warmEdge: "#d9ffff",
			rippleColor: "#3bcbd9",
			// 波纹冷暖锚点：安静/低频偏冷、明亮/高频偏暖，与地形冷暖同步联动
			rippleCool: "#3bcbd9",
			rippleWarm: "#d9ffff",
			fogColor: "#050810",
			glowIntensity: 0.86,
		},
	},
};

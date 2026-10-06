import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { LinkPreset, type NavBarLink } from "../types/config";

export const LinkPresets: { [key in LinkPreset]: NavBarLink } = {
	[LinkPreset.Home]: {
		name: i18n(I18nKey.home),
		url: "/",
		icon: "material-symbols:home",
	},
	[LinkPreset.About]: {
		name: i18n(I18nKey.about),
		url: "/about/",
		icon: "material-symbols:person",
	},
	[LinkPreset.Archive]: {
		name: i18n(I18nKey.archive),
		url: "/archive/",
		icon: "material-symbols:inventory-2",
	},
	[LinkPreset.PostList]: {
		name: i18n(I18nKey.postList),
		url: "/list/",
		icon: "material-symbols:list-alt-outline-rounded",
	},
	[LinkPreset.Friends]: {
		name: i18n(I18nKey.friends),
		url: "/friends/",
		icon: "material-symbols:group",
	},
	[LinkPreset.Sponsor]: {
		name: i18n(I18nKey.sponsor),
		url: "/sponsor/",
		icon: "material-symbols:favorite",
	},
	[LinkPreset.Guestbook]: {
		name: i18n(I18nKey.guestbook),
		url: "/guestbook/",
		icon: "material-symbols:chat",
	},
	[LinkPreset.Bangumi]: {
		name: i18n(I18nKey.bangumi),
		url: "/bangumi/",
		icon: "material-symbols:movie",
	},
	[LinkPreset.Gallery]: {
		name: i18n(I18nKey.gallery),
		url: "/gallery/",
		icon: "material-symbols:photo-library",
	},
	[LinkPreset.Collections]: {
		name: i18n(I18nKey.collections),
		url: "/collections/",
		icon: "material-symbols:bookmark",
	},
	[LinkPreset.Stats]: {
		name: i18n(I18nKey.stats),
		url: "/stats/",
		icon: "material-symbols:bar-chart",
	},
	[LinkPreset.Categories]: {
		name: "图谱",
		url: "/categories/",
		icon: "material-symbols:hub-outline",
	},
	[LinkPreset.Tags]: {
		name: i18n(I18nKey.tags),
		url: "/tags/",
		icon: "material-symbols:label",
	},
	[LinkPreset.ContactMe]: {
		name: i18n(I18nKey.contactMe),
		url: "/contact/",
		icon: "material-symbols:mail",
	},
	// 原 LinkPreset.QQGroup（指向作者 QQ 群）已连同枚举成员与 i18n 键一并移除：
	// 它没有任何引用，却因 LinkPresets 会被打进客户端 chunk 而把该外链带到线上。
	// 以后用户有自己的群时，重新加枚举成员、i18n 键和这里的一项即可。
	[LinkPreset.NavPosts]: {
		name: i18n(I18nKey.navPosts),
		url: "/list/",
		icon: "material-symbols:article",
	},
	[LinkPreset.NavMy]: {
		name: i18n(I18nKey.navMy),
		// 父项有子菜单时渲染为按钮，不使用该 url；原值 /my/ 没有对应页面，
		// 这里与子项中的关于页保持一致，避免留下不存在的路由
		url: "/about/",
		icon: "material-symbols:person",
	},
	[LinkPreset.Music]: {
		name: i18n(I18nKey.music),
		url: "/music/",
		icon: "material-symbols:graphic-eq-rounded",
	},
	[LinkPreset.NavLinks]: {
		name: i18n(I18nKey.navLinks),
		// 父项有子菜单时渲染为按钮，不使用该 url；此处保持与主要子项一致
		url: "/collections/",
		icon: "material-symbols:explore",
	},
};

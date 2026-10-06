export const PAGE_SIZE = 8;

export const LIGHT_MODE = "light",
	DARK_MODE = "dark",
	SYSTEM_MODE = "system";
export type LIGHT_DARK_MODE = typeof LIGHT_MODE | typeof DARK_MODE;
export const DEFAULT_THEME: LIGHT_DARK_MODE = LIGHT_MODE; // 仅作为向后兼容的默认值，实际使用 siteConfig.themeColor.defaultMode

// Page width: rem
export const PAGE_WIDTH = 100;

// Category constants
export const UNCATEGORIZED = "uncategorized";

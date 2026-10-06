// 检查是否为首页
export const isHomePage = (pathname: string): boolean => {
	const baseUrl = import.meta.env.BASE_URL || "/";
	const baseUrlNoSlash = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

	if (pathname === baseUrl) return true;
	if (pathname === baseUrlNoSlash) return true;
	if (pathname === "/") return true;

	return false;
};

export const isPostPage = (pathname: string): boolean => {
	const baseUrl = import.meta.env.BASE_URL || "/";
	const postsPath = baseUrl === "/" ? "/posts/" : `${baseUrl}/posts/`;
	return pathname.startsWith(postsPath) || pathname.includes("/posts/");
};

import { z } from "zod";
import { commitSchema } from "#shared/api-schema";

export const GALLERY_PATH = "src/content/gallery.json";
export const TOOLS_PATH = "src/content/tools.json";
export const TOOL_ICONS = [
	"",
	"material-symbols:code",
	"material-symbols:search",
	"material-symbols:smart-toy",
	"material-symbols:palette",
	"material-symbols:description",
	"material-symbols:build",
	"material-symbols:language",
	"material-symbols:school",
] as const;
const webUrl = z
	.string()
	.max(2000)
	.url()
	.refine((value) => {
		try {
			const url = new URL(value);
			return (
				["http:", "https:"].includes(url.protocol) &&
				!url.username &&
				!url.password
			);
		} catch {
			return false;
		}
	}, "请填写有效的 HTTP 或 HTTPS 地址");
const imageUrl = webUrl.refine(
	(value) => value.startsWith("https://"),
	"图片外链需使用 HTTPS",
);
const identity = z
	.string()
	.min(1)
	.max(80)
	.regex(/^[a-zA-Z0-9_-]+$/);
export const albumIdSchema = z
	.string()
	.min(1)
	.max(80)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "相册标识使用小写字母、数字和连字符");
const photoSchema = z.strictObject({
	id: identity,
	src: z.union([
		imageUrl,
		z
			.string()
			.regex(
				/^\/gallery\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|avif|gif)$/i,
			),
	]),
	width: z.number().int().positive().max(30000),
	height: z.number().int().positive().max(30000),
	description: z.string().max(2000),
});
export const albumSchema = z
	.strictObject({
		id: albumIdSchema,
		name: z.string().trim().min(1).max(200),
		description: z.string().max(5000),
		date: z.union([z.literal(""), z.iso.date()]),
		location: z.string().max(200),
		tags: z.array(z.string().trim().min(1).max(80)).max(30),
		enabled: z.boolean(),
		coverPhotoId: z.string().max(80),
		photos: z.array(photoSchema).max(2000),
	})
	.superRefine((album, ctx) => {
		if (
			new Set(album.photos.map((photo) => photo.id)).size !==
			album.photos.length
		)
			ctx.addIssue({
				code: "custom",
				message: "照片标识不能重复",
				path: ["photos"],
			});
		for (const [index, photo] of album.photos.entries()) {
			if (
				photo.src.startsWith("/") &&
				!photo.src.startsWith("/gallery/" + album.id + "/")
			)
				ctx.addIssue({
					code: "custom",
					message: "图片需位于当前相册目录",
					path: ["photos", index, "src"],
				});
		}
	});
export const galleryContentSchema = z
	.strictObject({ albums: z.array(albumSchema).max(200) })
	.superRefine((data, ctx) => {
		if (
			new Set(data.albums.map((album) => album.id)).size !== data.albums.length
		)
			ctx.addIssue({
				code: "custom",
				message: "相册标识不能重复",
				path: ["albums"],
			});
	});
export const toolSchema = z.strictObject({
	id: identity,
	name: z.string().trim().min(1).max(200),
	url: webUrl,
	description: z.string().max(2000),
	icon: z.union([z.enum(TOOL_ICONS), imageUrl]),
	enabled: z.boolean(),
});
export const toolGroupSchema = z.strictObject({
	id: identity,
	category: z.string().trim().min(1).max(200),
	description: z.string().max(2000),
	items: z.array(toolSchema).max(1000),
});
export const toolsContentSchema = z
	.strictObject({
		title: z.string().max(200),
		description: z.string().max(2000),
		apis: z.array(toolGroupSchema).max(200),
	})
	.superRefine((data, ctx) => {
		if (new Set(data.apis.map((group) => group.id)).size !== data.apis.length)
			ctx.addIssue({
				code: "custom",
				message: "分类标识不能重复",
				path: ["apis"],
			});
		if (
			new Set(data.apis.map((group) => group.category)).size !==
			data.apis.length
		)
			ctx.addIssue({
				code: "custom",
				message: "分类名称不能重复",
				path: ["apis"],
			});
		const ids = data.apis.flatMap((group) =>
			group.items.map((tool) => tool.id),
		);
		if (new Set(ids).size !== ids.length)
			ctx.addIssue({
				code: "custom",
				message: "工具标识不能重复",
				path: ["apis"],
			});
	});
export const galleryDocumentSchema = z.object({
	sha: z.string().nullable(),
	data: galleryContentSchema,
});
export const toolsDocumentSchema = z.object({
	sha: z.string().nullable(),
	data: toolsContentSchema,
});
export const saveGallerySchema = z.strictObject({
	expectedSha: z.string().min(1).nullable(),
	data: galleryContentSchema,
});
export const saveToolsSchema = z.strictObject({
	expectedSha: z.string().min(1).nullable(),
	data: toolsContentSchema,
});
export const gallerySaveResultSchema = galleryDocumentSchema.extend({
	sha: z.string(),
	commit: commitSchema,
});
export const toolsSaveResultSchema = toolsDocumentSchema.extend({
	sha: z.string(),
	commit: commitSchema,
});
export const galleryUploadSchema = z.object({
	src: z.string(),
	commit: commitSchema,
});
export type Album = z.infer<typeof albumSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type GalleryContent = z.infer<typeof galleryContentSchema>;
export type ToolsContent = z.infer<typeof toolsContentSchema>;
export type ToolGroup = z.infer<typeof toolGroupSchema>;
export type Tool = z.infer<typeof toolSchema>;

import { z } from "zod";
import type { Repository, CommitReceipt } from "#shared/contracts";
import { AppError } from "#worker/errors";
import {
	GALLERY_PATH,
	TOOLS_PATH,
	galleryContentSchema,
	toolsContentSchema,
	saveGallerySchema,
	saveToolsSchema,
} from "#shared/managed-schema";
import type { GalleryContent, ToolsContent } from "#shared/managed-schema";

async function load<T>(
	repo: Repository,
	path: string,
	schema: z.ZodType<T>,
	empty: T,
): Promise<{ sha: string | null; data: T }> {
	if (!(await repo.listFiles()).some((file) => file.path === path))
		return { sha: null, data: empty };
	const file = await repo.readFile(path);
	try {
		return {
			sha: file.sha,
			data: schema.parse(JSON.parse(file.raw.replace(/^\uFEFF/, ""))),
		};
	} catch {
		throw new AppError(
			422,
			"INVALID_CATALOG",
			"内容清单格式异常，请先在仓库中修复；后台不会覆盖它。",
		);
	}
}
export async function loadGallery(
	repo: Repository,
): Promise<{ sha: string | null; data: GalleryContent }> {
	return load(repo, GALLERY_PATH, galleryContentSchema, { albums: [] });
}
export async function loadTools(
	repo: Repository,
): Promise<{ sha: string | null; data: ToolsContent }> {
	return load(repo, TOOLS_PATH, toolsContentSchema, {
		title: "",
		description: "",
		apis: [],
	});
}
async function save<T>(
	repo: Repository,
	path: string,
	expectedSha: string | null,
	current: { sha: string | null; data: T },
	data: T,
	message: string,
): Promise<{ sha: string; data: T; commit: CommitReceipt }> {
	if (current.sha !== expectedSha)
		throw new AppError(
			409,
			"VERSION_CONFLICT",
			"内容已被其他设备修改；当前编辑内容仍保留，请重新读取版本后比对。",
		);
	// 清单会进入 Pages 的 Biome 检查：制表符缩进，短标签数组保持一行。
	const raw =
		JSON.stringify(data, null, "\t").replace(
			/^(\t*)"tags": \[\n((?:\t+[^\n]+\n)+?)\1\](,?)$/gm,
			(original: string, indent: string, lines: string, comma: string) => {
				const values = lines
					.trim()
					.split("\n")
					.map((line) => line.trim().replace(/,$/, ""));
				const inline = indent + '"tags": [' + values.join(", ") + "]" + comma;
				const width = Array.from(
					new Intl.Segmenter().segment(inline.replaceAll("\t", "  ")),
					({ segment }) =>
						/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Hangul}\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3\u3000-\u303f\u30a0-\u30ff\uff01-\uff60\uffe0-\uffe6]/u.test(
							segment,
						)
							? 2
							: 1,
				).reduce((total, size) => total + size, 0);
				return width <= 80 ? inline : original;
			},
		) + "\n";
	const commit = await repo.commit(
		[{ path, expectedSha, content: raw }],
		message,
	);
	// Git blob SHA 来自精确保存文本，避免提交后读取到其他设备的新版本。
	const bytes = new TextEncoder().encode(raw),
		header = new TextEncoder().encode("blob " + bytes.length + "\0");
	const blob = new Uint8Array(header.length + bytes.length);
	blob.set(header);
	blob.set(bytes, header.length);
	const digest = await crypto.subtle.digest("SHA-1", blob);
	const sha = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return { sha, data, commit };
}
export async function saveGallery(
	repo: Repository,
	input: z.input<typeof saveGallerySchema>,
): Promise<{ sha: string; data: GalleryContent; commit: CommitReceipt }> {
	const valid = saveGallerySchema.parse(input),
		current = await loadGallery(repo);
	const files = await repo.listFiles();
	for (const album of valid.data.albums)
		for (const photo of album.photos) {
			if (photo.src.startsWith("/")) {
				const file = files.find((row) => row.path === "public" + photo.src);
				if (!file || !["100644", "100755"].includes(file.mode))
					throw new AppError(
						400,
						"MISSING_IMAGE",
						"相册引用的图片不存在，请重新上传。",
					);
			}
		}
	const data = {
		albums: valid.data.albums.map((album) => ({
			...album,
			coverPhotoId: album.photos.some(
				(photo) => photo.id === album.coverPhotoId,
			)
				? album.coverPhotoId
				: "",
		})),
	};
	return save(repo, GALLERY_PATH, valid.expectedSha, current, data, "更新相册");
}
export async function saveTools(
	repo: Repository,
	input: z.input<typeof saveToolsSchema>,
): Promise<{ sha: string; data: ToolsContent; commit: CommitReceipt }> {
	const valid = saveToolsSchema.parse(input);
	return save(
		repo,
		TOOLS_PATH,
		valid.expectedSha,
		await loadTools(repo),
		valid.data,
		"更新工具导航",
	);
}

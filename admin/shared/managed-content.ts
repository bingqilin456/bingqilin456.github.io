import type { Album, ToolsContent } from "#shared/managed-schema";

export function toolIconMode(
	icon: string,
	chosen: "builtin" | "external" | undefined,
): "builtin" | "external" {
	return chosen ?? (icon.startsWith("https://") ? "external" : "builtin");
}

export function moveItem<T>(items: T[], index: number, offset: number): T[] {
	const target = index + offset;
	if (target < 0 || target >= items.length) return items;
	const result = [...items];
	const [item] = result.splice(index, 1);
	result.splice(target, 0, item);
	return result;
}
export function removeAlbumPhoto(album: Album, id: string): Album {
	return {
		...album,
		photos: album.photos.filter((photo) => photo.id !== id),
		coverPhotoId: album.coverPhotoId === id ? "" : album.coverPhotoId,
	};
}
export function moveTool(
	data: ToolsContent,
	sourceId: string,
	toolId: string,
	targetId: string,
): ToolsContent {
	const source = data.apis.find((group) => group.id === sourceId),
		target = data.apis.find((group) => group.id === targetId),
		tool = source?.items.find((item) => item.id === toolId);
	if (!tool || !target || sourceId === targetId) return data;
	return {
		...data,
		apis: data.apis.map((group) =>
			group.id === sourceId
				? { ...group, items: group.items.filter((item) => item.id !== toolId) }
				: group.id === targetId
					? { ...group, items: [...group.items, tool] }
					: group,
		),
	};
}

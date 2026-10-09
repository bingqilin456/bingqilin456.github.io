import type { GalleryAlbum, GalleryPhotoEntry } from "../types/config";

/** 隐藏相册同时退出列表与静态路由生成。 */
export function getVisibleAlbums(albums: GalleryAlbum[]): GalleryAlbum[] {
	return albums.filter((album) => album.enabled);
}

/** 数组顺序即展示顺序；留在磁盘上的未引用图片不会重新进入相册。 */
export function albumPhotoList(album: GalleryAlbum): GalleryPhotoEntry[] {
	return album.photos;
}

export function albumCoverSource(album: GalleryAlbum): string {
	return (
		album.photos.find((photo) => photo.id === album.coverPhotoId)?.src ||
		album.photos[0]?.src ||
		""
	);
}

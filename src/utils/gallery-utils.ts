import type { GalleryAlbum, GalleryPhotoEntry } from "@/types/config";
import { albumCoverSource, albumPhotoList } from "@/utils/gallery-content";
import { url } from "@/utils/url-utils";

export type GalleryPhoto = GalleryPhotoEntry;

function withBase(assetPath: string): string {
	if (!assetPath || /^https:\/\//i.test(assetPath)) return assetPath;
	return url(assetPath);
}

export function getAlbumPhotos(album: GalleryAlbum): GalleryPhoto[] {
	return albumPhotoList(album).map((photo) => ({
		...photo,
		src: withBase(photo.src),
	}));
}

export function getAlbumCover(album: GalleryAlbum): string {
	return withBase(albumCoverSource(album));
}

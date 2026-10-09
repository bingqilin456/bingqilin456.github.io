import content from "@/content/gallery.json";
import type { GalleryConfig } from "@/types/config";
import { getVisibleAlbums } from "@/utils/gallery-content";

export const galleryConfig: GalleryConfig = {
	// 同一份公开清单用于列表与 getStaticPaths，隐藏相册不产出详情页。
	albums: getVisibleAlbums(content.albums),
	columnWidth: 240,
};

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, ImageOff, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeLink } from "@/lib/api";

export function OrderButtons({
	index,
	length,
	onMove,
	label,
}: {
	index: number;
	length: number;
	onMove: (offset: number) => void;
	label: string;
}): React.JSX.Element {
	return (
		<span className="catalog-order">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={"上移" + label}
				disabled={index === 0}
				onClick={() => onMove(-1)}
			>
				<ArrowUp size={16} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={"下移" + label}
				disabled={index === length - 1}
				onClick={() => onMove(1)}
			>
				<ArrowDown size={16} />
			</Button>
		</span>
	);
}
export function ImagePreview({
	src,
	alt,
}: {
	src: string;
	alt: string;
}): React.JSX.Element {
	const [failed, setFailed] = useState(false);
	useEffect(() => setFailed(false), [src]);
	const source = src.startsWith("/gallery/")
		? "/api/gallery/image?path=" + encodeURIComponent("public" + src)
		: src.startsWith("https://")
			? safeLink(src)
			: undefined;
	return (
		<div className="catalog-image">
			{source && !failed ? (
				<img
					src={source}
					alt={alt}
					loading="lazy"
					onError={() => setFailed(true)}
				/>
			) : (
				<span>
					<ImageOff size={25} />
					{src ? "图片无法加载" : "未设置封面"}
				</span>
			)}
		</div>
	);
}
export function CatalogActions({
	dirty,
	busy,
	onSave,
	onReload,
	canSave,
}: {
	dirty: boolean;
	busy: boolean;
	onSave: () => void;
	onReload: () => void;
	canSave: boolean;
}): React.JSX.Element {
	return (
		<div className="editor-actions">
			<span role="status">
				{busy ? "正在处理…" : dirty ? "有未保存的修改" : "内容已同步"}
			</span>
			<div>
				<Button variant="outline" disabled={busy} onClick={onReload}>
					<RefreshCw size={16} />
					重新读取
				</Button>
				<Button disabled={busy || !dirty || !canSave} onClick={onSave}>
					<Save size={16} />
					{busy ? "处理中…" : "保存并更新"}
				</Button>
			</div>
		</div>
	);
}
export function readImageSize(
	src: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new window.Image(),
			timer = window.setTimeout(
				() => finish(new Error("图片读取超时，请检查链接或手动填写尺寸。")),
				20000,
			);
		function finish(error?: Error): void {
			window.clearTimeout(timer);
			image.onload = null;
			image.onerror = null;
			if (error) reject(error);
			else resolve({ width: image.naturalWidth, height: image.naturalHeight });
		}
		image.onload = () => finish();
		image.onerror = () =>
			finish(new Error("图片无法加载，请检查链接或手动填写尺寸。"));
		image.src = src;
	});
}

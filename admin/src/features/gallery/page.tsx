import { useEffect, useState } from "react";
import { Plus, Images, Upload, Link2, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	PageHeader,
	ConnectionGate,
	Loading,
	ErrorNotice,
	Empty,
	CommitNotice,
} from "@/components/page";
import { useCatalog, UnsavedGuard } from "@/features/managed/use-catalog";
import { CatalogSessionRecovery } from "@/features/managed/session-recovery";
import {
	CatalogActions,
	OrderButtons,
	ImagePreview,
	readImageSize,
} from "@/features/managed/components";
import { apiRequest } from "@/lib/api";
import {
	albumSchema,
	galleryDocumentSchema,
	galleryContentSchema,
	gallerySaveResultSchema,
	galleryUploadSchema,
} from "@shared/managed-schema";
import type { Album, GalleryContent, Photo } from "@shared/managed-schema";
import { moveItem, removeAlbumPhoto } from "@shared/managed-content";

export function GalleryPage(): React.JSX.Element {
	const catalog = useCatalog<GalleryContent>(
		"/api/gallery",
		galleryDocumentSchema,
		galleryContentSchema,
		gallerySaveResultSchema,
	);
	const [selected, setSelected] = useState(""),
		[createOpen, setCreateOpen] = useState(false),
		[name, setName] = useState(""),
		[slug, setSlug] = useState("");
	const [externalOpen, setExternalOpen] = useState(false),
		[external, setExternal] = useState(""),
		[width, setWidth] = useState(""),
		[height, setHeight] = useState(""),
		[description, setDescription] = useState("");
	const [uploading, setUploading] = useState(false),
		[progress, setProgress] = useState(""),
		[error, setError] = useState<Error | null>(null),
		[deleteId, setDeleteId] = useState<string | null>(null);
	const albums = catalog.data?.albums || [],
		album = albums.find((item) => item.id === selected),
		busy = catalog.busy || uploading;
	useEffect(() => {
		if (albums.length && !albums.some((item) => item.id === selected))
			setSelected(albums[0].id);
	}, [albums, selected]);
	function updateAlbum(update: (value: Album) => Album): void {
		catalog.setData((value) =>
			value
				? {
						...value,
						albums: value.albums.map((item) =>
							item.id === selected ? update(item) : item,
						),
					}
				: value,
		);
	}
	function create(): void {
		const draft = {
			id: slug.trim(),
			name: name.trim(),
			description: "",
			date: "",
			location: "",
			tags: [],
			enabled: false,
			coverPhotoId: "",
			photos: [],
		};
		const parsed = albumSchema.safeParse(draft);
		if (!parsed.success) {
			setError(new Error(parsed.error.issues[0].message));
			return;
		}
		if (albums.some((item) => item.id === draft.id)) {
			setError(new Error("这个相册标识已存在，请换一个。"));
			return;
		}
		catalog.setData((value) =>
			value ? { ...value, albums: [...value.albums, parsed.data] } : value,
		);
		setSelected(draft.id);
		setCreateOpen(false);
		setError(null);
	}
	async function upload(files: File[]): Promise<void> {
		if (!files.length || !album) return;
		const targetId = album.id;
		setUploading(true);
		setError(null);
		let added = 0;
		try {
			for (const file of files) {
				setProgress("正在上传 " + (added + 1) + " / " + files.length);
				if (!file.size || file.size > 5 * 1024 * 1024)
					throw new Error(file.name + "：图片需大于 0 且不超过 5 MB。");
				const size = await readImageSize(file);
				if (size.width > 30000 || size.height > 30000)
					throw new Error("图片边长不能超过 30000 像素。");
				const form = new FormData();
				form.set("file", file);
				const result = await apiRequest(
					"/api/gallery/image?album=" + encodeURIComponent(targetId),
					galleryUploadSchema,
					{ method: "POST", body: form },
				);
				const photo: Photo = {
					id: crypto.randomUUID(),
					src: result.src,
					...size,
					description: file.name,
				};
				catalog.setData((value) =>
					value
						? {
								...value,
								albums: value.albums.map((item) =>
									item.id === targetId
										? { ...item, photos: [...item.photos, photo] }
										: item,
								),
							}
						: value,
				);
				added++;
			}
			setProgress("已添加 " + added + " 张照片，保存相册后生效。");
		} catch (reason) {
			setError(
				new Error(
					"已添加 " +
						added +
						" 张照片；" +
						(reason instanceof Error ? reason.message : "上传失败") +
						" 已添加的照片仍保留，可继续上传剩余文件。",
				),
			);
		} finally {
			setUploading(false);
		}
	}
	async function measureExternal(): Promise<void> {
		if (!/^https:\/\//.test(external)) {
			setError(new Error("请填写 HTTPS 图片地址。"));
			return;
		}
		setUploading(true);
		setError(null);
		try {
			const size = await readImageSize(external);
			setWidth(String(size.width));
			setHeight(String(size.height));
		} catch (reason) {
			setError(reason instanceof Error ? reason : new Error("读取尺寸失败"));
		} finally {
			setUploading(false);
		}
	}
	function addExternal(): void {
		if (!album) return;
		const photo = {
			id: crypto.randomUUID(),
			src: external.trim(),
			width: Number(width),
			height: Number(height),
			description,
		};
		const parsed = albumSchema.safeParse({
			...album,
			photos: [...album.photos, photo],
		});
		if (!parsed.success) {
			setError(new Error(parsed.error.issues[0].message));
			return;
		}
		updateAlbum(() => parsed.data);
		setExternalOpen(false);
		setError(null);
	}
	const header = (
		<PageHeader
			eyebrow="MOMENTS & MEMORIES"
			title="相册管理"
			description="整理照片、挑选封面，把值得记住的瞬间放进相册。"
		/>
	);
	if (!catalog.data)
		return (
			<>
				{header}
				<ConnectionGate>
					<ErrorNotice error={catalog.error} retry={catalog.reload} />
					{catalog.loading ? <Loading /> : null}
				</ConnectionGate>
			</>
		);
	return (
		<>
			{header}
			{catalog.receipt && <CommitNotice {...catalog.receipt} />}
			<CatalogActions
				dirty={catalog.dirty}
				busy={busy}
				onSave={() => void catalog.save()}
				onReload={catalog.reload}
				canSave={catalog.canSave}
			/>
			{!catalog.canSave && (
				<CatalogSessionRecovery
					busy={busy || catalog.recovering}
					onRecover={catalog.recoverSession}
				/>
			)}
			<ErrorNotice error={catalog.error} />
			<fieldset className="editor-fieldset" disabled={busy}>
				<div className="catalog-layout">
					<section className="panel catalog-sidebar">
						<div className="panel-heading">
							<div>
								<h2>我的相册</h2>
								<p>{albums.length} 个相册</p>
							</div>
							<Button
								type="button"
								size="icon"
								aria-label="新建相册"
								onClick={() => {
									setName("");
									setSlug("");
									setError(null);
									setCreateOpen(true);
								}}
							>
								<Plus size={18} />
							</Button>
						</div>
						{albums.length ? (
							albums.map((item, index) => (
								<div
									className={
										"catalog-list-row " +
										(selected === item.id ? "selected" : "")
									}
									key={item.id}
								>
									<button
										type="button"
										className="catalog-select"
										onClick={() => setSelected(item.id)}
									>
										<Images size={19} />
										<span>
											<strong>{item.name}</strong>
											<small>
												{item.photos.length} 张 ·{" "}
												{item.enabled ? "显示" : "隐藏"}
											</small>
										</span>
									</button>
									<OrderButtons
										index={index}
										length={albums.length}
										label={item.name}
										onMove={(offset) =>
											catalog.setData((value) =>
												value
													? {
															...value,
															albums: moveItem(value.albums, index, offset),
														}
													: value,
											)
										}
									/>
								</div>
							))
						) : (
							<Empty
								title="还没有相册"
								description="新建相册后，支持上传照片和添加图片外链。"
								action={
									<Button
										type="button"
										onClick={() => {
											setName("");
											setSlug("");
											setError(null);
											setCreateOpen(true);
										}}
									>
										<Plus size={16} />
										新建相册
									</Button>
								}
							/>
						)}
					</section>
					{album ? (
						<section className="catalog-workspace">
							<div className="panel catalog-form">
								<div className="catalog-heading">
									<div>
										<h2>{album.name}</h2>
										<small>/gallery/{album.id}/ · 标识固定</small>
									</div>
									<Badge variant={album.enabled ? "default" : "secondary"}>
										{album.enabled ? "公开显示" : "已隐藏"}
									</Badge>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={"删除相册" + album.name}
										onClick={() => setDeleteId(album.id)}
									>
										<Trash2 size={17} />
									</Button>
								</div>
								<div className="catalog-form-grid">
									<label className="field-label">
										相册名称
										<Input
											value={album.name}
											onChange={(event) =>
												updateAlbum((item) => ({
													...item,
													name: event.target.value,
												}))
											}
											maxLength={200}
										/>
									</label>
									<label className="field-label">
										日期
										<Input
											type="date"
											value={album.date}
											onChange={(event) =>
												updateAlbum((item) => ({
													...item,
													date: event.target.value,
												}))
											}
										/>
									</label>
									<label className="field-label">
										拍摄地点
										<Input
											value={album.location}
											onChange={(event) =>
												updateAlbum((item) => ({
													...item,
													location: event.target.value,
												}))
											}
										/>
									</label>
									<label className="field-label">
										标签（逗号分隔）
										<Input
											key={album.id}
											defaultValue={album.tags.join(", ")}
											onChange={(event) =>
												updateAlbum((item) => ({
													...item,
													tags: event.target.value
														.split(/[,，]/)
														.map((tag) => tag.trim())
														.filter(Boolean),
												}))
											}
										/>
									</label>
								</div>
								<label className="field-label">
									相册描述
									<textarea
										rows={3}
										value={album.description}
										onChange={(event) =>
											updateAlbum((item) => ({
												...item,
												description: event.target.value,
											}))
										}
									/>
								</label>
								<label className="check-field">
									<input
										type="checkbox"
										checked={album.enabled}
										onChange={(event) =>
											updateAlbum((item) => ({
												...item,
												enabled: event.target.checked,
											}))
										}
									/>
									在博客上显示相册
								</label>
								<p className="info-note">
									隐藏后不生成相册列表项和详情页，已上传图片仍可通过原链接访问。修改需保存并完成博客构建后生效。
								</p>
							</div>
							<div className="panel catalog-form">
								<div className="catalog-heading">
									<div>
										<h2>照片 · {album.photos.length}</h2>
										<small>封面未指定时使用第一张照片</small>
									</div>
									<div className="catalog-heading-actions">
										<label className="upload-button">
											<span>
												<Upload size={16} />
												上传照片
											</span>
											<input
												type="file"
												multiple
												accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
												aria-label="上传相册照片"
												disabled={!catalog.canSave || busy}
												onChange={(event) => {
													const files = Array.from(event.target.files || []);
													void upload(files);
													event.target.value = "";
												}}
											/>
										</label>
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												setExternal("");
												setWidth("");
												setHeight("");
												setDescription("");
												setError(null);
												setExternalOpen(true);
											}}
										>
											<Link2 size={16} />
											图片外链
										</Button>
									</div>
								</div>
								{progress && (
									<p className="upload-progress" role="status">
										{progress}
									</p>
								)}
								<ErrorNotice
									error={externalOpen || createOpen ? null : error}
								/>
								{album.photos.length ? (
									<div className="catalog-photo-grid">
										{album.photos.map((photo, index) => (
											<article className="catalog-photo" key={photo.id}>
												<ImagePreview
													src={photo.src}
													alt={photo.description || album.name}
												/>
												<div className="catalog-photo-body">
													<label className="field-label">
														照片说明
														<Input
															value={photo.description}
															onChange={(event) =>
																updateAlbum((item) => ({
																	...item,
																	photos: item.photos.map((row) =>
																		row.id === photo.id
																			? {
																					...row,
																					description: event.target.value,
																				}
																			: row,
																	),
																}))
															}
														/>
													</label>
													<small>
														{photo.width} × {photo.height} ·{" "}
														{photo.src.startsWith("/")
															? "上传图片"
															: "外链图片"}
													</small>
													<div className="catalog-photo-actions">
														<Button
															type="button"
															variant={
																album.coverPhotoId === photo.id
																	? "secondary"
																	: "ghost"
															}
															size="sm"
															aria-pressed={album.coverPhotoId === photo.id}
															onClick={() =>
																updateAlbum((item) => ({
																	...item,
																	coverPhotoId:
																		item.coverPhotoId === photo.id
																			? ""
																			: photo.id,
																}))
															}
														>
															<Star size={15} />
															{album.coverPhotoId === photo.id
																? "已设封面"
																: "设为封面"}
														</Button>
														<OrderButtons
															index={index}
															length={album.photos.length}
															label={"照片" + (index + 1)}
															onMove={(offset) =>
																updateAlbum((item) => ({
																	...item,
																	photos: moveItem(item.photos, index, offset),
																}))
															}
														/>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															aria-label={
																"移除照片" + (photo.description || index + 1)
															}
															onClick={() =>
																updateAlbum((item) =>
																	removeAlbumPhoto(item, photo.id),
																)
															}
														>
															<Trash2 size={16} />
														</Button>
													</div>
												</div>
											</article>
										))}
									</div>
								) : (
									<Empty
										title="开始整理这个相册"
										description="上传 PNG、JPEG、WebP、AVIF 或 GIF，单张不超过 5 MB；也可以添加 HTTPS 图片外链。"
									/>
								)}
								<p className="info-note">
									移除照片只删除相册中的引用，图片文件保留。上传的文件已入库，点击“保存并更新”后才进入照片清单。
								</p>
							</div>
						</section>
					) : (
						<section className="panel">
							<Empty
								title="选择或新建一个相册"
								description="相册默认隐藏，可以先整理照片，再公开展示。"
							/>
						</section>
					)}
				</div>
			</fieldset>
			<UnsavedGuard dirty={catalog.dirty} busy={busy} />
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogTitle>新建相册</DialogTitle>
					<DialogDescription>
						新相册默认隐藏。标识将用于 URL 和图片目录，创建后保持固定。
					</DialogDescription>
					<label className="field-label">
						相册名称
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="旅行的片段"
						/>
					</label>
					<label className="field-label">
						相册标识
						<Input
							value={slug}
							onChange={(event) => setSlug(event.target.value)}
							placeholder="travel-2026"
						/>
						<small>小写字母、数字和连字符</small>
					</label>
					<ErrorNotice error={error} />
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							取消
						</Button>
						<Button onClick={create}>创建相册</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog
				open={externalOpen}
				onOpenChange={(open) => {
					if (!uploading) setExternalOpen(open);
				}}
			>
				<DialogContent className="catalog-dialog">
					<DialogTitle>添加图片外链</DialogTitle>
					<DialogDescription>
						支持 HTTPS 地址。可自动读取宽高；读取失败时手动填写图片的实际尺寸。
					</DialogDescription>
					<fieldset disabled={uploading} className="editor-fieldset">
						<label className="field-label">
							图片地址
							<Input
								value={external}
								onChange={(event) => {
									setExternal(event.target.value);
									setWidth("");
									setHeight("");
								}}
								placeholder="https://…"
							/>
						</label>
						<ImagePreview src={external} alt="外链图片预览" />
						<Button
							variant="outline"
							onClick={() => void measureExternal()}
							disabled={!external}
						>
							{uploading ? "读取中…" : "读取图片尺寸"}
						</Button>
						<div className="catalog-form-grid">
							<label className="field-label">
								宽度（像素）
								<Input
									type="number"
									min={1}
									max={30000}
									value={width}
									onChange={(event) => setWidth(event.target.value)}
								/>
							</label>
							<label className="field-label">
								高度（像素）
								<Input
									type="number"
									min={1}
									max={30000}
									value={height}
									onChange={(event) => setHeight(event.target.value)}
								/>
							</label>
						</div>
						<label className="field-label">
							照片说明
							<Input
								value={description}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</label>
					</fieldset>
					<ErrorNotice error={error} />
					<DialogFooter>
						<Button
							variant="outline"
							disabled={uploading}
							onClick={() => setExternalOpen(false)}
						>
							取消
						</Button>
						<Button disabled={uploading} onClick={addExternal}>
							添加照片
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog
				open={deleteId !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteId(null);
				}}
			>
				<DialogContent>
					<DialogTitle>删除相册引用</DialogTitle>
					<DialogDescription>
						保存后，相册列表和详情页将移除。相册里的图片文件全部保留，其他引用仍可使用。
					</DialogDescription>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteId(null)}>
							取消
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								catalog.setData((value) =>
									value
										? {
												...value,
												albums: value.albums.filter(
													(item) => item.id !== deleteId,
												),
											}
										: value,
								);
								setDeleteId(null);
							}}
						>
							移除相册
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

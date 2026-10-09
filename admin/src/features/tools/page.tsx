import { useEffect, useState } from "react";
import { Plus, FolderOpen, Trash2, Link2, ExternalLink } from "lucide-react";
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
import { CatalogActions, OrderButtons } from "@/features/managed/components";
import { CatalogSessionRecovery } from "@/features/managed/session-recovery";
import { safeLink } from "@/lib/api";
import {
	toolsContentSchema,
	toolsDocumentSchema,
	toolsSaveResultSchema,
	TOOL_ICONS,
} from "@shared/managed-schema";
import type { ToolsContent, ToolGroup, Tool } from "@shared/managed-schema";
import { moveItem, moveTool, toolIconMode } from "@shared/managed-content";

const iconLabels: Record<string, string> = {
	"": "默认图标",
	"material-symbols:code": "代码",
	"material-symbols:search": "搜索",
	"material-symbols:smart-toy": "人工智能",
	"material-symbols:palette": "设计",
	"material-symbols:description": "文档",
	"material-symbols:build": "工具",
	"material-symbols:language": "网站",
	"material-symbols:school": "学习",
};

export function ToolsPage(): React.JSX.Element {
	const catalog = useCatalog<ToolsContent>(
		"/api/tools",
		toolsDocumentSchema,
		toolsContentSchema,
		toolsSaveResultSchema,
	);
	const [selected, setSelected] = useState(""),
		[createOpen, setCreateOpen] = useState(false),
		[name, setName] = useState(""),
		[query, setQuery] = useState(""),
		[deleteId, setDeleteId] = useState<string | null>(null),
		[error, setError] = useState<Error | null>(null);
	const [iconModes, setIconModes] = useState<
		Record<string, "builtin" | "external">
	>({});
	const groups = catalog.data?.apis || [],
		group = groups.find((item) => item.id === selected);
	useEffect(() => {
		if (catalog.data === null) setIconModes({});
	}, [catalog.data]);
	useEffect(() => {
		if (groups.length && !groups.some((item) => item.id === selected))
			setSelected(groups[0].id);
	}, [groups, selected]);
	function updateGroup(update: (value: ToolGroup) => ToolGroup): void {
		catalog.setData((value) =>
			value
				? {
						...value,
						apis: value.apis.map((item) =>
							item.id === selected ? update(item) : item,
						),
					}
				: value,
		);
	}
	function updateTool(id: string, update: (value: Tool) => Tool): void {
		updateGroup((value) => ({
			...value,
			items: value.items.map((tool) => (tool.id === id ? update(tool) : tool)),
		}));
	}
	function create(): void {
		const category = name.trim();
		if (!category) {
			setError(new Error("请填写分类名称。"));
			return;
		}
		if (groups.some((item) => item.category === category)) {
			setError(new Error("分类名称已存在。"));
			return;
		}
		const id = crypto.randomUUID();
		catalog.setData((value) =>
			value
				? {
						...value,
						apis: [...value.apis, { id, category, description: "", items: [] }],
					}
				: value,
		);
		setSelected(id);
		setCreateOpen(false);
		setError(null);
	}
	const header = (
		<PageHeader
			eyebrow="YOUR DIGITAL TOOLKIT"
			title="工具导航"
			description="把常用工具分门别类，维护一份随时可用的导航。"
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
				busy={catalog.busy}
				onSave={() => void catalog.save()}
				onReload={catalog.reload}
				canSave={catalog.canSave}
			/>
			{!catalog.canSave && (
				<CatalogSessionRecovery
					busy={catalog.busy || catalog.recovering}
					onRecover={catalog.recoverSession}
				/>
			)}
			<ErrorNotice error={catalog.error} />
			<fieldset disabled={catalog.busy} className="editor-fieldset">
				<section className="panel catalog-form catalog-page-settings">
					<div className="catalog-form-grid">
						<label className="field-label">
							页面标题
							<Input
								value={catalog.data.title}
								onChange={(event) =>
									catalog.setData((value) =>
										value ? { ...value, title: event.target.value } : value,
									)
								}
								placeholder="留空使用博客默认标题"
							/>
						</label>
						<label className="field-label">
							页面描述
							<Input
								value={catalog.data.description}
								onChange={(event) =>
									catalog.setData((value) =>
										value
											? { ...value, description: event.target.value }
											: value,
									)
								}
								placeholder="留空使用博客默认描述"
							/>
						</label>
					</div>
				</section>
				<div className="catalog-layout">
					<section className="panel catalog-sidebar">
						<div className="panel-heading">
							<div>
								<h2>工具分类</h2>
								<p>
									{groups.length} 个分类 ·{" "}
									{groups.reduce((count, item) => count + item.items.length, 0)}{" "}
									个工具
								</p>
							</div>
							<Button
								type="button"
								size="icon"
								aria-label="新建工具分类"
								onClick={() => {
									setName("");
									setError(null);
									setCreateOpen(true);
								}}
							>
								<Plus size={18} />
							</Button>
						</div>
						{groups.length ? (
							groups.map((item, index) => (
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
										onClick={() => {
											setSelected(item.id);
											setQuery("");
										}}
									>
										<FolderOpen size={19} />
										<span>
											<strong>{item.category}</strong>
											<small>{item.items.length} 个工具</small>
										</span>
									</button>
									<OrderButtons
										index={index}
										length={groups.length}
										label={item.category}
										onMove={(offset) =>
											catalog.setData((value) =>
												value
													? {
															...value,
															apis: moveItem(value.apis, index, offset),
														}
													: value,
											)
										}
									/>
								</div>
							))
						) : (
							<Empty
								title="还没有分类"
								description="先建立一个分类，再添加常用工具。"
								action={
									<Button
										type="button"
										onClick={() => {
											setName("");
											setError(null);
											setCreateOpen(true);
										}}
									>
										<Plus size={16} />
										新建分类
									</Button>
								}
							/>
						)}
					</section>
					{group ? (
						<section className="catalog-workspace">
							<div className="panel catalog-form">
								<div className="catalog-heading">
									<h2>分类信息</h2>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={"删除分类" + group.category}
										disabled={group.items.length > 0}
										onClick={() => setDeleteId(group.id)}
									>
										<Trash2 size={17} />
									</Button>
								</div>
								<label className="field-label">
									分类名称
									<Input
										value={group.category}
										onChange={(event) =>
											updateGroup((item) => ({
												...item,
												category: event.target.value,
											}))
										}
									/>
								</label>
								<label className="field-label">
									分类说明
									<Input
										value={group.description}
										onChange={(event) =>
											updateGroup((item) => ({
												...item,
												description: event.target.value,
											}))
										}
									/>
								</label>
								{group.items.length > 0 && (
									<p className="info-note">
										删除分类前，请先移动或移除其中的工具。
									</p>
								)}
							</div>
							<section className="panel catalog-form">
								<div className="catalog-heading">
									<div>
										<h2>
											{group.category} · {group.items.length}
										</h2>
										<small>
											停用工具会保留在后台；没有启用工具的分类不在博客展示
										</small>
									</div>
									<Button
										type="button"
										onClick={() =>
											updateGroup((item) => ({
												...item,
												items: [
													...item.items,
													{
														id: crypto.randomUUID(),
														name: "新工具",
														url: "",
														description: "",
														icon: "",
														enabled: true,
													},
												],
											}))
										}
									>
										<Plus size={16} />
										添加工具
									</Button>
								</div>
								{group.items.length > 0 && (
									<Input
										aria-label="搜索当前分类工具"
										placeholder="搜索名称、网址或描述…"
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										className="catalog-search"
									/>
								)}
								{group.items.length ? (
									group.items
										.filter((tool) =>
											(tool.name + " " + tool.url + " " + tool.description)
												.toLowerCase()
												.includes(query.toLowerCase()),
										)
										.map((tool) => {
											const index = group.items.findIndex(
													(item) => item.id === tool.id,
												),
												url = safeLink(tool.url),
												iconMode = toolIconMode(tool.icon, iconModes[tool.id]);
											return (
												<article className="catalog-tool" key={tool.id}>
													<div className="catalog-heading">
														<span className="catalog-tool-title">
															<Link2 size={18} />
															<strong>{tool.name || "未命名工具"}</strong>
															<Badge variant="secondary">
																{tool.enabled ? "已启用" : "已停用"}
															</Badge>
														</span>
														<OrderButtons
															index={index}
															length={group.items.length}
															label={tool.name}
															onMove={(offset) =>
																updateGroup((item) => ({
																	...item,
																	items: moveItem(item.items, index, offset),
																}))
															}
														/>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															aria-label={"移除工具" + tool.name}
															onClick={() =>
																updateGroup((item) => ({
																	...item,
																	items: item.items.filter(
																		(row) => row.id !== tool.id,
																	),
																}))
															}
														>
															<Trash2 size={17} />
														</Button>
													</div>
													<div className="catalog-form-grid">
														<label className="field-label">
															工具名称
															<Input
																value={tool.name}
																onChange={(event) =>
																	updateTool(tool.id, (item) => ({
																		...item,
																		name: event.target.value,
																	}))
																}
															/>
														</label>
														<label className="field-label">
															工具网址
															<Input
																value={tool.url}
																onChange={(event) =>
																	updateTool(tool.id, (item) => ({
																		...item,
																		url: event.target.value,
																	}))
																}
																placeholder="https://…"
															/>
														</label>
													</div>
													<label className="field-label">
														工具描述
														<textarea
															rows={2}
															value={tool.description}
															onChange={(event) =>
																updateTool(tool.id, (item) => ({
																	...item,
																	description: event.target.value,
																}))
															}
														/>
													</label>
													<div className="catalog-form-grid">
														<label className="field-label">
															图标
															<select
																value={
																	iconMode === "external"
																		? "external"
																		: tool.icon
																}
																onChange={(event) => {
																	setIconModes((value) => ({
																		...value,
																		[tool.id]:
																			event.target.value === "external"
																				? "external"
																				: "builtin",
																	}));
																	updateTool(tool.id, (item) => ({
																		...item,
																		icon:
																			event.target.value === "external"
																				? "https://"
																				: event.target.value,
																	}));
																}}
															>
																{TOOL_ICONS.map((icon) => (
																	<option value={icon} key={icon}>
																		{iconLabels[icon]}
																	</option>
																))}
																<option value="external">外部图片</option>
															</select>
														</label>
														<label className="field-label">
															所属分类
															<select
																value={group.id}
																onChange={(event) =>
																	catalog.setData((value) =>
																		value
																			? moveTool(
																					value,
																					group.id,
																					tool.id,
																					event.target.value,
																				)
																			: value,
																	)
																}
															>
																{groups.map((item) => (
																	<option value={item.id} key={item.id}>
																		{item.category}
																	</option>
																))}
															</select>
														</label>
													</div>
													{iconMode === "external" && (
														<label className="field-label">
															图标图片地址
															<Input
																value={tool.icon}
																onChange={(event) =>
																	updateTool(tool.id, (item) => ({
																		...item,
																		icon: event.target.value,
																	}))
																}
																placeholder="HTTPS 图片地址"
															/>
															{safeLink(tool.icon) && (
																<img
																	className="catalog-tool-icon"
																	src={safeLink(tool.icon)}
																	alt={tool.name + "图标预览"}
																	loading="lazy"
																/>
															)}
														</label>
													)}
													<div className="catalog-tool-footer">
														<label className="check-field">
															<input
																type="checkbox"
																checked={tool.enabled}
																onChange={(event) =>
																	updateTool(tool.id, (item) => ({
																		...item,
																		enabled: event.target.checked,
																	}))
																}
															/>
															在博客上启用
														</label>
														{url && (
															<a
																className="text-link"
																href={url}
																target="_blank"
																rel="noopener noreferrer"
															>
																打开工具
																<ExternalLink size={14} />
															</a>
														)}
													</div>
												</article>
											);
										})
								) : (
									<Empty
										title="添加第一个工具"
										description="填写名称、网址和描述，即可在博客工具导航页展示。"
									/>
								)}
								{group.items.length > 0 &&
									!group.items.some((tool) =>
										(tool.name + " " + tool.url + " " + tool.description)
											.toLowerCase()
											.includes(query.toLowerCase()),
									) && <p className="info-note">没有匹配的工具。</p>}
							</section>
						</section>
					) : (
						<section className="panel">
							<Empty
								title="选择或新建一个分类"
								description="分类和工具的排列顺序会同步到博客导航页。"
							/>
						</section>
					)}
				</div>
			</fieldset>
			<UnsavedGuard dirty={catalog.dirty} busy={catalog.busy} />
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogTitle>新建工具分类</DialogTitle>
					<DialogDescription>
						分类名称需保持唯一，可以随后填写说明、添加工具。
					</DialogDescription>
					<label className="field-label">
						分类名称
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="开发工具"
						/>
					</label>
					<ErrorNotice error={error} />
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							取消
						</Button>
						<Button onClick={create}>创建分类</Button>
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
					<DialogTitle>移除空分类</DialogTitle>
					<DialogDescription>
						保存并完成博客构建后，这个分类将从导航中移除。
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
												apis: value.apis.filter((item) => item.id !== deleteId),
											}
										: value,
								);
								setDeleteId(null);
							}}
						>
							移除分类
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

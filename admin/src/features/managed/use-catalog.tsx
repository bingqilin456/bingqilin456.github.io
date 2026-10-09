import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import type { ZodType } from "zod";
import { apiRequest } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import type { CommitReceipt } from "@shared/contracts";

export function useCatalog<T>(
	path: string,
	documentSchema: ZodType<{ sha: string | null; data: T }>,
	contentSchema: ZodType<T>,
	resultSchema: ZodType<{ sha: string; data: T; commit: CommitReceipt }>,
): {
	data: T | null;
	setData: React.Dispatch<React.SetStateAction<T | null>>;
	busy: boolean;
	dirty: boolean;
	error: Error | null;
	loading: boolean;
	receipt: CommitReceipt | null;
	save: () => Promise<void>;
	reload: () => void;
	canSave: boolean;
	recovering: boolean;
	recoverSession: () => Promise<void>;
} {
	const resource = useResource(path, documentSchema),
		{
			session,
			refresh,
			loading: recovering,
			error: sessionError,
		} = useSession();
	const ignoredDocument = useRef<{ sha: string | null; data: T } | null>(null);
	const [data, setData] = useState<T | null>(null),
		[sha, setSha] = useState<string | null>(null),
		[saved, setSaved] = useState<string | null>(null);
	const [busy, setBusy] = useState(false),
		[writeError, setWriteError] = useState<Error | null>(null),
		[receipt, setReceipt] = useState<CommitReceipt | null>(null);
	useEffect(() => {
		if (
			resource.data &&
			resource.data !== ignoredDocument.current &&
			saved === null
		) {
			setData(resource.data.data);
			setSha(resource.data.sha);
			setSaved(JSON.stringify(resource.data.data));
		}
	}, [resource.data, saved]);
	const dirty = data !== null && JSON.stringify(data) !== saved;
	async function save(): Promise<void> {
		if (!data || busy || !session) return;
		const parsed = contentSchema.safeParse(data);
		if (!parsed.success) {
			setWriteError(
				new Error(
					parsed.error.issues
						.slice(0, 3)
						.map((issue) => issue.path.join(".") + ": " + issue.message)
						.join("；"),
				),
			);
			return;
		}
		setBusy(true);
		setWriteError(null);
		try {
			const result = await apiRequest(path, resultSchema, {
				method: "POST",
				body: JSON.stringify({ expectedSha: sha, data: parsed.data }),
			});
			setData(result.data);
			setSha(result.sha);
			setSaved(JSON.stringify(result.data));
			setReceipt(result.commit);
		} catch (reason) {
			setWriteError(reason instanceof Error ? reason : new Error("保存失败"));
		} finally {
			setBusy(false);
		}
	}
	function reload(): void {
		if (busy) return;
		if (
			dirty &&
			!window.confirm(
				"重新读取会替换当前未保存内容。请先复制或备份编辑内容，确认要重新读取吗？",
			)
		)
			return;
		ignoredDocument.current = resource.data;
		setData(null);
		setSaved(null);
		setWriteError(null);
		setReceipt(null);
		resource.reload();
	}
	async function recoverSession(): Promise<void> {
		setWriteError(null);
		await refresh();
	}
	return {
		data,
		setData,
		busy,
		dirty,
		error: writeError || sessionError || resource.error,
		loading: resource.loading,
		receipt,
		save,
		reload,
		canSave: Boolean(session),
		recovering,
		recoverSession,
	};
}

export function UnsavedGuard({
	dirty,
	busy,
}: {
	dirty: boolean;
	busy: boolean;
}): React.JSX.Element {
	const blocker = useBlocker(dirty || busy);
	useEffect(() => {
		const before = (event: BeforeUnloadEvent): void => {
			if (dirty || busy) {
				event.preventDefault();
				event.returnValue = "";
			}
		};
		window.addEventListener("beforeunload", before);
		return () => window.removeEventListener("beforeunload", before);
	}, [dirty, busy]);
	return (
		<Dialog
			open={blocker.state === "blocked"}
			onOpenChange={(open) => {
				if (!open && blocker.state === "blocked") blocker.reset();
			}}
		>
			<DialogContent>
				<DialogTitle>
					{busy ? "正在保存或上传" : "有尚未保存的修改"}
				</DialogTitle>
				<DialogDescription>
					{busy
						? "请等待当前操作完成，再离开页面。"
						: "离开会丢失当前编辑内容。可以返回编辑并保存。已上传的图片文件会保留。"}
				</DialogDescription>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => {
							if (blocker.state === "blocked") blocker.reset();
						}}
					>
						返回编辑
					</Button>
					{!busy && (
						<Button
							variant="destructive"
							onClick={() => {
								if (blocker.state === "blocked") blocker.proceed();
							}}
						>
							放弃修改并离开
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

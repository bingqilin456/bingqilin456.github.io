import { Button } from "@/components/ui/button";

export function CatalogSessionRecovery({
	busy,
	onRecover,
}: {
	busy: boolean;
	onRecover: () => Promise<void>;
}): React.JSX.Element {
	return (
		<div className="panel catalog-form">
			<p>
				登录已过期，当前编辑内容仍保留。请在新窗口登录，再点击恢复登录继续保存。
			</p>
			<a
				className="text-link"
				href="/api/auth/login"
				target="_blank"
				rel="noopener noreferrer"
			>
				在新窗口登录
			</a>
			<Button
				type="button"
				variant="outline"
				disabled={busy}
				onClick={onRecover}
			>
				恢复登录
			</Button>
		</div>
	);
}

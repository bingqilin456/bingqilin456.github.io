import { RefreshCw, Rocket, ExternalLink, GitCommitHorizontal, CircleCheck, Clock3, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader,ConnectionGate,ErrorNotice,Loading,Empty } from "@/components/page";
import { useResource } from "@/lib/use-resource";
import { safeLink } from "@/lib/api";
import { deploymentsSchema } from "@shared/api-schema";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);dayjs.extend(timezone);
export function PublishingPage():React.JSX.Element {
 const {data,error,loading,reload}=useResource("/api/deployments",deploymentsSchema);
 return <><PageHeader eyebrow="FROM COMMIT TO LIVE" title="发布记录" description="跟踪每次保存，确认文章什么时候真正上线。" action={<Button variant="outline" disabled={loading} onClick={reload}><RefreshCw size={16}/>刷新状态</Button>}/><ConnectionGate><section className="panel"><div className="panel-heading"><div><h2>最近 20 次提交</h2><p>仅匹配该提交的 deploy-pages.yml 工作流</p></div><Rocket size={20}/></div><ErrorNotice error={error} retry={reload}/>{loading?<Loading/>:data?.length?<div className="deployment-list">{data.map(record=>{
 const succeeded=record.run?.status==="completed" && record.run.conclusion==="success",failed=record.run?.status==="completed" && !succeeded,status=succeeded?"部署成功":failed?"部署未成功":record.run?"正在构建":"等待运行 / 未触发";
 return <div className="deployment-row" key={record.commit.sha}><span className={"deploy-icon "+(succeeded?"success":failed?"failure":"")}>{succeeded?<CircleCheck size={20}/>:failed?<CircleAlert size={20}/>:<Clock3 size={20}/>}</span><div><strong><GitCommitHorizontal size={16}/>{record.commit.sha.slice(0,7)}</strong><small>{dayjs(record.commit.committedAt).tz("Asia/Shanghai").format("YYYY.MM.DD HH:mm:ss")} · 上海时间</small></div><Badge variant="secondary" className={succeeded?"badge-live":failed?"badge-error":""}>{status}</Badge><a href={safeLink(record.run?.url || record.commit.url)} target="_blank" rel="noopener noreferrer" className="text-link">{record.run?"查看构建":"查看提交"}<ExternalLink size={14}/></a></div>;
 })}</div>:!error && <Empty title="还没有发布记录" description="仓库创建并完成首次提交后，可以在这里跟踪博客部署。"/>}</section><p className="info-note">保存成功代表提交已进入 GitHub。只有对应提交的 Pages 工作流成功，才显示“部署成功”；构建失败可点击查看 GitHub 日志。</p></ConnectionGate></>;
}


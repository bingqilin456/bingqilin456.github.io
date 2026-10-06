import { Link } from "react-router-dom";
import { LogIn, PlugZap, LoaderCircle, AlertCircle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session";
import { ApiError, safeLink } from "@/lib/api";
import dayjs from "dayjs";
export function PageHeader({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}):React.JSX.Element {
 return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}
export function ErrorNotice({error,retry}:{error:Error|null;retry?:()=>void}):React.JSX.Element|null {
 if(!error)return null;
 return <div className="error-notice" role="alert"><AlertCircle size={18}/><div><strong>{error.message}</strong>{error instanceof ApiError && error.retryAt && <p>可重试时间：{dayjs(error.retryAt).format("YYYY-MM-DD HH:mm:ss")}</p>}{error instanceof ApiError && error.requestId && <small>请求编号 {error.requestId}</small>}{error instanceof ApiError && error.status===401 && <p><a href="/api/auth/login" target="_blank" rel="noopener noreferrer">在新窗口重新登录</a>，登录后重试，当前编辑内容会保留。</p>}</div>{retry && <Button variant="outline" size="sm" onClick={retry}>重试</Button>}</div>;
}
export function Loading():React.JSX.Element {return <div className="loading-state" role="status"><LoaderCircle className="spin" size={22}/>正在读取博客内容…</div>;}
export function Empty({title,description,action}:{title:string;description:string;action?:React.ReactNode}):React.JSX.Element {
 return <div className="empty-state"><div className="empty-icon"><PlugZap size={28}/></div><h2>{title}</h2><p>{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
export function ConnectionGate({children}:{children:React.ReactNode}):React.JSX.Element {
 const {setup,session,loading,error,refresh}=useSession();
 if(loading)return <Loading/>;
 if(error)return <ErrorNotice error={error} retry={()=>void refresh()}/>;
 if(!setup?.configured)return <Empty title="连接你的博客，开始管理" description="文章会从你的 GitHub 仓库读取，保存后自动触发博客发布。完成连接后，这里会展示真实内容。" action={<Button asChild><Link to="/settings">查看连接步骤<ArrowUpRight/></Link></Button>}/>;
 if(!session)return <Empty title="登录你的写作空间" description="使用管理员 GitHub 账号登录，管理文章、图片和发布状态。" action={<Button asChild><a href="/api/auth/login"><LogIn/>使用 GitHub 登录</a></Button>}/>;
 return <>{children}</>;
}
export function CommitNotice({url,sha}:{url:string;sha:string}):React.JSX.Element {return <div className="success-notice" role="status">已保存到 GitHub · <a href={safeLink(url)} target="_blank" rel="noopener noreferrer">{sha.slice(0,7)} ↗</a><Link to="/publishing">查看发布状态</Link></div>;}


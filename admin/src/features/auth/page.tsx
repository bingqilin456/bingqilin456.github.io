import { useSearchParams, Link } from "react-router-dom";
import { LogIn, Feather } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session";
import { ErrorNotice, Loading } from "@/components/page";
const messages:Record<string,string>={USER_NOT_ALLOWED:"该账号不在管理员名单中，请切换 GitHub 账号。",NO_PUSH_ACCESS:"请确认博客仓库公开，且账号拥有写入权限。",INVALID_STATE:"登录校验已过期，请重新开始登录。",OAUTH_FAILED:"GitHub 授权未完成，请重试。",OAUTH_UNAVAILABLE:"GitHub 登录服务暂时无法连接。",GITHUB_404:"博客仓库还不存在，请先创建仓库。",NOT_CONFIGURED:"请先完成后台连接配置。"};
export function LoginPage():React.JSX.Element {
 const {setup,session,loading,error,refresh}=useSession(),[params]=useSearchParams(),code=params.get("error");
 return <section className="login-panel panel"><div className="brand-mark"><Feather/></div><p className="eyebrow mt-6">YOUR PRIVATE WRITING SPACE</p><h1>欢迎回到 BQL</h1><p className="page-description">把每一次成长，都写进自己的故事。</p><ErrorNotice error={error} retry={()=>void refresh()}/>{code && <ErrorNotice error={new Error(messages[code] || "登录未完成，请检查仓库配置后重试。")}/>}<div className="login-actions">{loading?<Loading/>:session?<Button asChild><Link to="/">进入工作台</Link></Button>:<Button asChild={Boolean(setup?.configured)} disabled={!setup?.configured}>{setup?.configured?<a href="/api/auth/login"><LogIn/>使用 GitHub 登录</a>:<><LogIn/>等待连接配置</>}</Button>}<Link to="/settings" className="text-link">查看连接设置 ↗</Link></div><small>仅限管理员账号 · GitHub 授权 · 安全会话</small></section>;
}


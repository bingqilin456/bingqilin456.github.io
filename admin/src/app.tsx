import { lazy,Suspense } from "react";
import { createBrowserRouter,RouterProvider } from "react-router-dom";
import { AdminLayout } from "@/components/admin-layout";
import { SessionProvider } from "@/features/auth/session";
import { DashboardPage } from "@/features/dashboard/page";
const PostsPage=lazy(()=>import("@/features/posts/page").then(module=>({default:module.PostsPage})));
const TaxonomyPage=lazy(()=>import("@/features/taxonomy/page").then(module=>({default:module.TaxonomyPage})));
const MediaPage=lazy(()=>import("@/features/media/page").then(module=>({default:module.MediaPage})));
const GalleryPage=lazy(()=>import("@/features/gallery/page").then(module=>({default:module.GalleryPage})));
const ToolsPage=lazy(()=>import("@/features/tools/page").then(module=>({default:module.ToolsPage})));
const PublishingPage=lazy(()=>import("@/features/publishing/page").then(module=>({default:module.PublishingPage})));
const SettingsPage=lazy(()=>import("@/features/settings/page").then(module=>({default:module.SettingsPage})));
import { LoginPage } from "@/features/auth/page";
import { Loading,Empty } from "@/components/page";
const EditorPage=lazy(()=>import("@/features/editor/page").then(module=>({default:module.EditorPage})));
const router=createBrowserRouter([{element:<AdminLayout/>,children:[
 {path:"/",element:<DashboardPage/>},{path:"/posts",element:<PostsPage/>},
 {path:"/posts/new",element:<Suspense fallback={<Loading/>}><EditorPage/></Suspense>},
 {path:"/posts/edit",element:<Suspense fallback={<Loading/>}><EditorPage/></Suspense>},
 {path:"/taxonomy",element:<TaxonomyPage/>},{path:"/media",element:<MediaPage/>},
 {path:"/gallery",element:<GalleryPage/>},{path:"/tools",element:<ToolsPage/>},
 {path:"/publishing",element:<PublishingPage/>},{path:"/settings",element:<SettingsPage/>},
 {path:"/login",element:<LoginPage/>},{path:"*",element:<Empty title="页面不存在" description="请选择左侧的管理页面。"/>}
]}]);
export function App():React.JSX.Element {return <SessionProvider><Suspense fallback={<Loading/>}><RouterProvider router={router}/></Suspense></SessionProvider>;}

import { useEffect,useMemo,useRef,useState } from "react";
import { useBlocker,useLocation,useSearchParams } from "react-router-dom";
import { Save,Send,ImagePlus,Code2,Eye,ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog,DialogContent,DialogTitle,DialogDescription,DialogFooter } from "@/components/ui/dialog";
import { PageHeader,ConnectionGate,Loading,ErrorNotice,CommitNotice } from "@/components/page";
import { EditorFields } from "@/features/editor/fields";
import { MediaLibrary } from "@/features/media/library";
import { useSession } from "@/features/auth/session";
import { useResource } from "@/lib/use-resource";
import { apiRequest,ApiError } from "@/lib/api";
import { renderPreview } from "@/lib/preview";
import { postSchema,commitSchema } from "@shared/api-schema";
import { postFieldsSchema } from "@shared/post-schema";
import { assertContentPath,imageReference,imageMarkdown,imagePreviewSource } from "@shared/paths";
import type { PostDocument,PostFields,CommitReceipt,MediaItem } from "@shared/contracts";
import { editorSignature as signature,restoreSavedPost } from "@/features/editor/save-state";
import type { PendingSave } from "@/features/editor/save-state";
function today():string{return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export function EditorPage():React.JSX.Element {
 const [params]=useSearchParams(),location=useLocation(),isNew=location.pathname==="/posts/new",path=params.get("path") || "";
 return <EditorEntry key={isNew?"new":path} isNew={isNew} path={path}/>;
}
function EditorEntry({isNew,path}:{isNew:boolean;path:string}):React.JSX.Element {
 const {session}=useSession(),[opened,setOpened]=useState(false),[document,setDocument]=useState<PostDocument|null>(null);
 const resource=useResource("/api/post?path="+encodeURIComponent(path),postSchema,!isNew);
 useEffect(()=>{if(session && isNew)setOpened(true);if(resource.data && !document)setDocument(resource.data);},[session,isNew,resource.data,document]);
 if(document || (isNew && opened))return <EditorWorkspace initial={document}/>;
 return <ConnectionGate>{resource.loading?<Loading/>:resource.error?<><PageHeader eyebrow="ARTICLE EDITOR" title="无法打开文章" description="请检查路径或修复仓库中的文章格式。"/><ErrorNotice error={resource.error} retry={resource.reload}/></>:<Loading/>}</ConnectionGate>;
}
function EditorWorkspace({initial}:{initial:PostDocument|null}):React.JSX.Element {
 const defaultFields=postFieldsSchema.parse({title:"未命名文章",published:today(),draft:true});
 const [fields,setFields]=useState<PostFields>(initial?.fields || {...defaultFields,title:""}),[body,setBody]=useState(initial?.body || ""),[slug,setSlug]=useState(initial?.path.replace("src/content/posts/","") || ""),[version,setVersion]=useState<string|null>(initial?.sha || null),[created,setCreated]=useState(Boolean(initial)),[busy,setBusy]=useState(false),[error,setError]=useState<Error|null>(null),[receipt,setReceipt]=useState<CommitReceipt|null>(null),[confirmation,setConfirmation]=useState<PostFields|null>(null),[picker,setPicker]=useState<"cover"|"body"|null>(null),[mode,setMode]=useState<"source"|"preview">("source");
 const {setup,session,refresh}=useSession(),[persistedDraft,setPersistedDraft]=useState(initial?.fields.draft ?? true),[saved,setSaved]=useState(()=>signature(initial?.fields || {...defaultFields,title:""},initial?.body || "",initial?.path.replace("src/content/posts/","") || ""));
 const [pending,setPending]=useState<PendingSave|null>(null);
 const dirty=signature(fields,body,slug)!==saved,blocker=useBlocker(dirty || busy),textarea=useRef<HTMLTextAreaElement|null>(null),path="src/content/posts/"+slug;
 const imageSelection=useRef<{start:number;end:number}|null>(null),insertedCaret=useRef<number|null>(null);
 const coverSrc=imagePreviewSource(fields.image,path,setup?.blogUrl);
 const preview=useMemo(()=>mode==="preview"?renderPreview(body,path,setup?.blogUrl):"",[body,path,setup?.blogUrl,mode]);
 useEffect(()=>{const before=(event:BeforeUnloadEvent):void=>{if(dirty || busy){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",before);return ()=>window.removeEventListener("beforeunload",before);},[dirty,busy]);
 async function synchronize(pendingSave:PendingSave,current:{fields:PostFields;body:string;slug:string}):Promise<void>{
  const restored=await restoreSavedPost(pendingSave,current,()=>apiRequest("/api/post?path="+encodeURIComponent(pendingSave.path),postSchema));
  setVersion(restored.post.sha);setFields(restored.fields);setSaved(restored.saved);setPending(null);
 }
 async function recover():Promise<void>{
  if(!pending)return;setBusy(true);setError(null);
  try{await synchronize(pending,{fields,body,slug});}catch(reason){setError(reason instanceof Error?reason:new Error("版本确认失败"));}finally{setBusy(false);}
 }
 async function save(next:PostFields):Promise<void>{
  setBusy(true);setError(null);
  try{
   const result=await apiRequest("/api/post",commitSchema,{method:"POST",body:JSON.stringify({path,expectedSha:version,fields:next,body})});setReceipt(result);setConfirmation(null);setCreated(true);setPersistedDraft(next.draft);setFields(next);setSaved(signature(next,body,slug));
   const pendingSave:PendingSave={path,fields:next,body,slug};setPending(pendingSave);setVersion(null);
   await synchronize(pendingSave,{fields:next,body,slug});
  }catch(reason){setError(reason instanceof Error?reason:new Error("保存失败"));}finally{setBusy(false);}
 }
 function prepare(draft:boolean):void{
  setError(null);
  try{assertContentPath(path,"post");}catch{setError(new Error("请输入有效的文章路径，例如 生活/记录.md；保存后路径不能更改。"));return;}
  const parsed=postFieldsSchema.safeParse({...fields,tags:[...new Set(fields.tags.map(value=>value.trim()).filter(Boolean))],draft});
  if(!parsed.success){setError(new Error(parsed.error.issues.map(issue=>issue.message).slice(0,3).join("；")));return;}
  if(!created || (!persistedDraft && draft))setConfirmation(parsed.data);else void save(parsed.data);
 }
 function openPicker(target:"cover"|"body"):void{
  setError(null);
  try{assertContentPath(path,"post");}catch{setError(new Error("请先填写有效文章路径，例如 生活/记录.md，再选择封面或插入图片。"));return;}
  imageSelection.current=target==="body"?{start:textarea.current?.selectionStart ?? body.length,end:textarea.current?.selectionEnd ?? body.length}:null;
  insertedCaret.current=null;setPicker(target);
 }
 function selectImage(item:MediaItem):void{
  try{
   const reference=imageReference(path,item.path);
   if(picker==="cover")setFields(value=>({...value,image:reference}));
   else{
    const {start,end}=imageSelection.current || {start:body.length,end:body.length},markdown=imageMarkdown(path,item.path,item.name);
    setBody(value=>value.slice(0,start)+markdown+value.slice(end));insertedCaret.current=start+markdown.length;setMode("source");
   }setPicker(null);
  }catch{setError(new Error("请先填写有效文章路径，再选择图片，以生成正确的相对引用。"));setPicker(null);}
 }
 // A completed first save without a refreshed blob version must never be treated as a create again.
 const missingVersion=created && version===null;
 return <><PageHeader eyebrow="ARTICLE EDITOR" title={initial?"编辑文章":"新建文章"} description="让想法落在纸上，慢慢成为一篇好文章。" action={<div className="editor-status"><Badge variant="secondary">{dirty?"有未保存修改":"已保存"}</Badge><Button variant="outline" disabled={busy} onClick={()=>history.back()}><ArrowLeft size={15}/>返回</Button></div>}/><ErrorNotice error={error}/>{pending && <div className="success-notice" role="status"><span>提交已保存，待确认文件版本。当前编辑内容会保留。</span><Button variant="outline" size="sm" disabled={busy || !session} onClick={()=>void recover()}>{busy?"确认中…":"重新读取保存版本"}</Button></div>}{!session && <ErrorNotice error={new ApiError(401,"UNAUTHENTICATED","会话已到期，当前内容仍保留。")} retry={()=>void refresh()}/>}<div className="editor-actions"><span>{fields.draft?"草稿 · 不公开展示":"发布 · 保存会触发博客构建"}</span><div><Button variant="outline" disabled={busy || missingVersion || !session} onClick={()=>prepare(true)}><Save size={16}/>{busy?"保存中…":"保存草稿"}</Button><Button disabled={busy || missingVersion || !session} onClick={()=>prepare(false)}><Send size={16}/>{busy?"保存中…":created && !persistedDraft?"保存并更新":"发布文章"}</Button></div></div><fieldset className="editor-fieldset" disabled={busy}><div className="editor-grid"><section className="editor-main"><div className="panel title-panel"><label className="sr-only" htmlFor="article-title">文章标题</label><Input id="article-title" className="title-input" value={fields.title} onChange={event=>setFields({...fields,title:event.target.value})} placeholder="给这篇文章起个标题…"/><label className="path-field"><span>src/content/posts/</span><input value={slug} readOnly={created} onChange={event=>setSlug(event.target.value)} placeholder="生活/记录.md" aria-label="文章路径"/></label><small>{created?"文章路径固定，保证现有链接稳定。":"支持中文和嵌套目录；请包含 .md 或 .mdx，首次保存前会再次确认。"}</small></div><section className="panel writing-panel"><div className="writing-toolbar"><div className="section-tabs"><button type="button" className={mode==="source"?"active":""} aria-pressed={mode==="source"} onClick={()=>setMode("source")}><Code2 size={16}/>源码</button><button type="button" className={mode==="preview"?"active":""} aria-pressed={mode==="preview"} onClick={()=>setMode("preview")}><Eye size={16}/>预览</button></div><Button type="button" variant="ghost" size="sm" onClick={()=>openPicker("body")}><ImagePlus size={16}/>插入图片</Button></div>{mode==="source"?<textarea ref={textarea} className="markdown-source" value={body} onChange={event=>setBody(event.target.value)} placeholder={"从这里开始你的记录…\n\n支持 Markdown / MDX 源码。\n\n# 一个小标题\n\n写下今天的灵感。"} spellCheck={false} aria-label="文章 Markdown 或 MDX 正文"/>:<div className="markdown-preview" dangerouslySetInnerHTML={{__html:preview}}/>}<div className="writing-footer"><small>{body.length.toLocaleString()} 个字符</small><small>基础 Markdown 预览 · 不执行 MDX；自定义语法以博客构建为准</small></div></section></section><EditorFields fields={fields} onChange={setFields} onCover={()=>openPicker("cover")} coverSrc={coverSrc}/></div></fieldset>{receipt && <CommitNotice {...receipt}/>}<Dialog open={Boolean(confirmation)} onOpenChange={open=>{if(!busy && !open)setConfirmation(null);}}><DialogContent><DialogTitle>{!created?"确认文章路径与保存方式":confirmation?.draft?"将文章转为草稿？":"确认发布"}</DialogTitle><DialogDescription>{!created?"首次保存将创建文件，此后路径保持不变。":confirmation?.draft?"已发布文章将在博客重新构建后下线。":"会创建 GitHub 提交并触发博客发布。"}</DialogDescription><code className="block-code">{path}</code><p>保存方式：{confirmation?.draft?"草稿，不公开展示":"发布到博客"}</p><ErrorNotice error={error}/><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setConfirmation(null)}>取消</Button><Button disabled={busy} onClick={()=>{if(confirmation)void save(confirmation);}}>{busy?"保存中…":"确认保存"}</Button></DialogFooter></DialogContent></Dialog><Dialog open={Boolean(picker)} onOpenChange={open=>{if(!open)setPicker(null);}}><DialogContent className="library-dialog" onCloseAutoFocus={event=>{const caret=insertedCaret.current;if(caret===null)return;event.preventDefault();textarea.current?.focus();textarea.current?.setSelectionRange(caret,caret);insertedCaret.current=null;}}><DialogTitle>{picker==="cover"?"选择封面":"插入图片"}</DialogTitle><DialogDescription>选择图片后，将按当前文章路径生成相对引用。</DialogDescription>{picker && <MediaLibrary onSelect={selectImage}/>}</DialogContent></Dialog><Dialog open={blocker.state==="blocked"} onOpenChange={open=>{if(!open && blocker.state==="blocked" && !busy)blocker.reset();}}><DialogContent><DialogTitle>{busy?"文章正在保存":"离开编辑器？"}</DialogTitle><DialogDescription>{busy?"请等待保存完成后再离开。":"当前修改尚未保存，离开后这些修改会丢失。你也可以先复制正文备份。"}</DialogDescription><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>{if(blocker.state==="blocked")blocker.reset();}}>继续编辑</Button><Button variant="destructive" disabled={busy} onClick={()=>{if(blocker.state==="blocked")blocker.proceed();}}>放弃修改并离开</Button></DialogFooter></DialogContent></Dialog></>;
}


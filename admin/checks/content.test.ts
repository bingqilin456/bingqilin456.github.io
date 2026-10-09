import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePost, serializePost } from '#shared/content';
import { assertContentPath, imageReference, imageMarkdown, imagePreviewSource } from '#shared/paths';
import { marked } from "marked";
import { applyTaxonomy } from '#shared/taxonomy';
import { parseDocument } from "yaml";
import { restoreSavedPost, editorSignature } from "../src/features/editor/save-state.ts";
test("修改带锚点的字段保留未知引用值和集合注释",()=>{
 const raw="---\ntitle: &titleName 原标题\npublished: 2026-10-05\ntags: &names [A] # 标签注释\nauthor: *titleName\ncustom: *names # 自定义注释\ncustomTitle: *titleName\n---\nbody";
 const post=parsePost("src/content/posts/a.md","old",raw);
 const next=serializePost(raw,{...post.fields,title:"新标题",tags:["B"]},post.body);
 const yaml=next.split("---")[1],values:unknown=parseDocument(yaml).toJS({maxAliasCount:20});
 if(typeof values!=="object" || values===null)throw new Error("invalid");
 assert.deepEqual(Reflect.get(values,"custom"),["A"]);
 assert.equal(Reflect.get(values,"customTitle"),"原标题");
 assert.equal(parsePost(post.path,"new",next).fields.author,"原标题");
 assert.ok(next.includes("# 标签注释"));assert.ok(next.includes("# 自定义注释"));
});
test("保存后的 GET 可单独重试，同步版本保留继续输入并拒绝不匹配的新修改",async ()=>{
 const post=parsePost("src/content/posts/a.md","fresh","---\ntitle: A\npublished: 2026-10-05\n---\nbody");
 const pending={path:post.path,slug:"a.md",fields:post.fields,body:post.body};
 const current={fields:{...post.fields,title:"继续编辑的标题"},body:"继续编辑的正文",slug:"a.md"};
 await assert.rejects(restoreSavedPost(pending,current,async()=>{throw new Error("network");}),/network/);
 const restored=await restoreSavedPost(pending,current,async()=>post);
 assert.equal(restored.post.sha,"fresh");assert.equal(restored.fields.title,current.fields.title);
 assert.notEqual(restored.saved,editorSignature(current.fields,current.body,current.slug));
 const unchanged=await restoreSavedPost(pending,{fields:post.fields,body:post.body,slug:"a.md"},async()=>post);
 assert.equal(unchanged.saved,editorSignature(unchanged.fields,post.body,"a.md"));
 await assert.rejects(restoreSavedPost(pending,current,async()=>({...post,body:"他人修改"})),/新修改/);
 assert.equal(current.body,"继续编辑的正文");
});

test('保留未知 YAML、注释、BOM、CRLF 和正文，合并标签去重', () => {
  const raw = '\uFEFF---\r\n# 保留此注释\r\ntitle: 原标题\r\npublished: 2026-10-05\r\ncustomKey: 原值\r\ntags: [A, B]\r\n---\r\n\r\n# 正文\r\n<Component />\r\n';
  const post = parsePost('src/content/posts/中文.mdx', 'abc', raw);
  const fields = applyTaxonomy(post.fields, {kind:'tag',action:'merge',source:'A',target:'B',expected:[]});
  assert.deepEqual(fields.tags, ['B']);
  const next = serializePost(raw, {...fields,title:'新标题'}, post.body);
  assert.equal(parsePost(post.path,'def',next).body, post.body);
  assert.ok(next.startsWith('\uFEFF---\r\n'));
  assert.ok(next.includes('# 保留此注释\r\n'));
  assert.ok(next.includes('customKey: 原值'));
  assert.equal(serializePost(raw,post.fields,post.body),raw);
  assert.throws(() => parsePost(post.path,'abc','---\ntitle: [bad]\n---\nbody'));
});
test('只允许文章和安全图片路径，中文嵌套图片引用正确', () => {
  for (const path of ['src/content/posts/../../config/siteConfig.ts','src/content/posts/%2e%2e/a.md','src/content/posts/a\\b.md','src/content/posts//a.md','/src/content/posts/a.md','src/content/posts/%252e%252e/a.md']) assert.throws(() => assertContentPath(path,'post'));
  assert.throws(() => assertContentPath('src/content/posts/evil.svg','image'));
  assertContentPath('src/content/posts/生活/记录.mdx','post');
  assert.equal(imageReference('src/content/posts/生活/记录.mdx','src/content/posts/assets/a.webp'),'../assets/a.webp');
});

test("插入带空格、括号和方括号的图片仍生成有效 Markdown，封面保留原始文件路径", () => {
 const postPath="src/content/posts/生活/记录.mdx",imagePath="src/content/posts/assets/旅行 照片[1](原图).png";
 const markdown=imageMarkdown(postPath,imagePath,"旅行 照片[1](原图).png");
 const token=marked.lexer(markdown).find(token=>token.type==="paragraph");
 if(token?.type!=="paragraph")throw new Error("图片应为正文段落");
 const image=token.tokens?.find(token=>token.type==="image");
 if(image?.type!=="image")throw new Error("插入内容应被解析为图片");
 assert.ok(marked.parse(markdown,{async:false}).includes('alt="旅行 照片[1](原图).png"'));
 assert.equal(decodeURI(image.href),"../assets/旅行 照片[1](原图).png");
 assert.equal(imageReference(postPath,imagePath),"../assets/旅行 照片[1](原图).png");
 const fields=parsePost(postPath,"old","---\ntitle: 图片文章\npublished: 2026-10-08\n---\n正文").fields;
 const saved=parsePost(postPath,"new",serializePost(null,{...fields,image:imageReference(postPath,imagePath)},markdown));
 assert.equal(saved.fields.image,"../assets/旅行 照片[1](原图).png");
 assert.equal(saved.body,markdown);
});

test("封面和正文预览将中文相对图片解析到同源接口，public 与远程图片保持可访问", () => {
 const postPath="src/content/posts/生活/记录.md",blogUrl="https://blog.example.com/";
 assert.equal(imagePreviewSource("../assets/旅行 照片[1].png",postPath,blogUrl),"/api/media/file?path=src%2Fcontent%2Fposts%2Fassets%2F%E6%97%85%E8%A1%8C%20%E7%85%A7%E7%89%87%5B1%5D.png");
 assert.equal(imagePreviewSource("/cover.png",postPath,blogUrl),"https://blog.example.com/cover.png");
 assert.equal(imagePreviewSource("https://images.example.com/a.png",postPath,blogUrl),"https://images.example.com/a.png");
 for(const source of ["", "../../../secret.png", "javascript:alert(1)"])assert.equal(imagePreviewSource(source,postPath,blogUrl),undefined);
});
test("照片引用移除清空封面，工具跨分类移动保持标识与原清单不变", async () => {
 const helpers=await import("../shared/managed-content.ts").catch(()=>null);
 assert.ok(helpers,"管理界面的清单操作尚未实现");
 const album={id:"travel",name:"旅行",description:"",date:"",location:"",tags:[],enabled:false,coverPhotoId:"p",photos:[{id:"p",src:"https://example.com/p.png",width:10,height:10,description:""}]};
 assert.equal(helpers.removeAlbumPhoto(album,"p").coverPhotoId,"");
 assert.equal(album.photos.length,1);
 const tool={id:"t",name:"工具",url:"https://example.com",description:"",icon:"",enabled:true};
 const catalog={title:"",description:"",apis:[{id:"a",category:"A",description:"",items:[tool]},{id:"b",category:"B",description:"",items:[]}]};
 const moved=helpers.moveTool(catalog,"a","t","b");
 assert.equal(moved.apis[0].items.length,0);
 assert.equal(moved.apis[1].items[0].id,"t");
 assert.equal(catalog.apis[0].items.length,1);
});
test("外部图标编辑模式保留空值与未完成的网址，切换内置图标后退出", async () => {
 const helpers=await import("../shared/managed-content.ts");
 assert.equal(typeof helpers.toolIconMode,"function","外链图标模式尚未与网址内容分离");
 assert.equal(helpers.toolIconMode("https://example.com/icon.png",undefined),"external");
 for(const value of ["","h","https:","https://"])assert.equal(helpers.toolIconMode(value,"external"),"external");
 assert.equal(helpers.toolIconMode("material-symbols:code","builtin"),"builtin");
});

test("恢复登录入口在新窗口登录，刷新会话按钮不清空未保存编辑", async () => {
 const {tsImport}=await import("tsx/esm/api");
 const recovery=await tsImport("../src/features/managed/session-recovery.tsx",import.meta.url).catch(()=>null);
 assert.ok(recovery,"会话恢复入口尚未实现");
 const React=await import("react"),{renderToStaticMarkup}=await import("react-dom/server");
 const current={sha:"old",data:{albums:[{name:"尚未保存"}]}},before=JSON.stringify(current);let refreshes=0;
 const element=recovery.CatalogSessionRecovery({busy:false,onRecover:async()=>{refreshes++;}});
 const html=renderToStaticMarkup(element);
 assert.ok(html.includes('target="_blank"'));assert.ok(html.includes("恢复登录"));
 const nodes:unknown=element.props.children,children=Array.isArray(nodes)?nodes:[nodes];
 const button=children.find(node=>React.isValidElement<{onClick?:()=>Promise<void>}>(node) && typeof node.props.onClick==="function");
 assert.ok(React.isValidElement<{onClick:()=>Promise<void>}>(button));
 await button.props.onClick();
 assert.equal(refreshes,1);assert.equal(JSON.stringify(current),before);
});

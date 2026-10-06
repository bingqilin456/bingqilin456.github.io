import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePost, serializePost } from '#shared/content';
import { assertContentPath, imageReference } from '#shared/paths';
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

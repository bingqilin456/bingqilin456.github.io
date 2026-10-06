import { z } from "zod";
const date = z.string().refine(value => {
 if (!/^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+Zz-]+)?$/.test(value)) return false;
 const prefix=value.slice(0,10), parsed=new Date(prefix+"T00:00:00Z");
 return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===prefix && Number.isFinite(Date.parse(value));
}, "请输入有效日期（YYYY-MM-DD）");
const text=z.string().max(10000);
export const postFieldsSchema=z.object({
 title:z.string().min(1,"标题不能为空").max(300),published:date,updated:date.optional(),
 draft:z.boolean().default(false),description:text.default(""),image:text.default(""),
 tags:z.array(z.string().min(1).max(200)).max(100).default([]),category:z.string().max(200).nullable().default(""),
 lang:text.default(""),pinned:z.boolean().default(false),author:text.default(""),sourceLink:text.default(""),
 licenseName:text.default(""),licenseUrl:text.default(""),comment:z.boolean().default(true),
 password:text.default(""),passwordHint:text.default(""),wikiExclude:z.boolean().default(false)
});
export const taxonomySchema=z.object({
 kind:z.enum(["tag","category"]),action:z.enum(["rename","merge","remove"]),source:z.string().min(1).max(200),
 target:z.string().min(1).max(200).optional(),expected:z.array(z.object({path:z.string(),sha:z.string().min(1)})).max(10000)
}).refine(value => value.action==="remove" || (value.target && value.target!==value.source),"请输入不同的目标名称");
export const savePostSchema=z.object({path:z.string(),expectedSha:z.string().min(1).nullable(),fields:postFieldsSchema.strict(),body:z.string().max(2_000_000)});


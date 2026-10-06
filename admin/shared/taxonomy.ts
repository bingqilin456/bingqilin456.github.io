import type { PostFields, TaxonomyChange } from "#shared/contracts";
export function applyTaxonomy(fields: PostFields, change: TaxonomyChange): PostFields {
 const replacement=change.action==="remove" ? "" : change.target;
 if(replacement===undefined) throw new Error("缺少目标名称");
 if(change.kind==="category") return {...fields,category:fields.category===change.source ? replacement : fields.category};
 return {...fields,tags:[...new Set(fields.tags.flatMap(tag => tag!==change.source ? [tag] : replacement ? [replacement] : []))]};
}


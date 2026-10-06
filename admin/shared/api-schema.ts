import { z } from "zod";
import { postFieldsSchema } from "#shared/post-schema";
const webUrl=z.string().url().refine(value=>/^https?:\/\//.test(value));
export const setupSchema=z.object({configured:z.boolean(),missing:z.array(z.string()),repository:z.string().nullable(),branch:z.string(),blogUrl:z.string().nullable()});
export const sessionSchema=z.object({user:z.object({login:z.string(),avatarUrl:z.string()}),csrfToken:z.string(),expiresAt:z.number()});
export const postSchema=z.object({path:z.string(),sha:z.string(),raw:z.string(),fields:postFieldsSchema,body:z.string()});
export const summarySchema=z.object({path:z.string(),sha:z.string(),title:z.string(),published:z.string(),updated:z.string().optional(),draft:z.boolean(),pinned:z.boolean(),tags:z.array(z.string()),category:z.string().nullable(),error:z.string().optional()});
export const postsSchema=z.array(summarySchema);
export const commitSchema=z.object({sha:z.string(),url:webUrl,committedAt:z.string()});
export const mediaSchema=z.object({path:z.string(),sha:z.string(),name:z.string(),size:z.number()});
export const imagesSchema=z.array(mediaSchema);
export const uploadSchema=z.object({item:mediaSchema,commit:commitSchema});
export const connectionSchema=z.object({repositoryExists:z.boolean(),branchExists:z.boolean(),workflowExists:z.boolean()});
export const deploymentsSchema=z.array(z.object({commit:commitSchema,run:z.object({id:z.number(),headSha:z.string(),status:z.string(),conclusion:z.string().nullable(),url:webUrl,workflowPath:z.string()}).nullable()}));
export const failureSchema=z.object({error:z.object({code:z.string(),message:z.string(),requestId:z.string(),retryAt:z.number().optional()})});
export const okSchema=z.object({ok:z.literal(true)});


import { z } from "zod";
import { toBase64, fromBase64 } from "#worker/github";
const encoder=new TextEncoder();
function urlBase64(bytes: Uint8Array): string { return toBase64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function decode(value: string): Uint8Array<ArrayBuffer> { return new Uint8Array(fromBase64(value.replace(/-/g,"+").replace(/_/g,"/"))); }
async function hmac(secret:string):Promise<CryptoKey> { return crypto.subtle.importKey("raw",encoder.encode("sign:"+secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]); }
async function aes(secret:string):Promise<CryptoKey> { const hash=await crypto.subtle.digest("SHA-256",encoder.encode("encrypt:"+secret)); return crypto.subtle.importKey("raw",hash,"AES-GCM",false,["encrypt","decrypt"]); }
export function randomId():string { return urlBase64(crypto.getRandomValues(new Uint8Array(32))); }
export async function challenge(verifier:string):Promise<string> { return urlBase64(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(verifier)))); }
export async function signValue(value:unknown,secret:string):Promise<string> {
 const body=urlBase64(encoder.encode(JSON.stringify(value)));
 return body+"."+urlBase64(new Uint8Array(await crypto.subtle.sign("HMAC",await hmac(secret),encoder.encode(body))));
}
export async function verifyValue<T>(value:string,secret:string,schema:z.ZodType<T>):Promise<T> {
 const parts=value.split(".");
 if(parts.length!==2 || !(await crypto.subtle.verify("HMAC",await hmac(secret),decode(parts[1]),encoder.encode(parts[0])))) throw new Error("Invalid signature");
 return schema.parse(JSON.parse(new TextDecoder().decode(decode(parts[0]))));
}
export async function encryptValue(value:unknown,secret:string):Promise<string> {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await aes(secret),encoder.encode(JSON.stringify(value)));
 return urlBase64(iv)+"."+urlBase64(new Uint8Array(encrypted));
}
export async function decryptValue<T>(value:string,secret:string,schema:z.ZodType<T>):Promise<T> {
 const parts=value.split("."); if(parts.length!==2) throw new Error("Invalid encrypted value");
 const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(parts[0])},await aes(secret),decode(parts[1]));
 return schema.parse(JSON.parse(new TextDecoder().decode(decrypted)));
}


import { useCallback, useEffect, useState } from "react";
import type { ZodType } from "zod";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/features/auth/session";
export function useResource<T>(path:string,schema:ZodType<T>,enabled=true):{data:T|null;loading:boolean;error:Error|null;reload:()=>void} {
 const {session}=useSession(),[data,setData]=useState<T|null>(null),[error,setError]=useState<Error|null>(null),[loading,setLoading]=useState(false),[version,setVersion]=useState(0);
 const reload=useCallback(()=>setVersion(value=>value+1),[]);
 useEffect(()=>{
  setData(null);setError(null);
  if(!session || !enabled){setLoading(false);return;}
  const controller=new AbortController();setLoading(true);
  void apiRequest(path,schema,{signal:controller.signal}).then(setData).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason:new Error("加载失败"));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[path,schema,version,session,enabled]);
 return {data,error,loading,reload};
}


import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SessionView, SetupStatus } from "@shared/contracts";
import { sessionSchema, setupSchema } from "@shared/api-schema";
import { apiRequest, ApiError, setCsrfToken } from "@/lib/api";
interface SessionState {session:SessionView|null;setup:SetupStatus|null;loading:boolean;error:Error|null;refresh:()=>Promise<void>}
const Context=createContext<SessionState|null>(null);
export function SessionProvider({children}:{children:React.ReactNode}):React.JSX.Element {
 const [session,setSession]=useState<SessionView|null>(null),[setup,setSetup]=useState<SetupStatus|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<Error|null>(null);
 const refresh=useCallback(async ():Promise<void>=>{
  setLoading(true);setError(null);
  try{
   const config=await apiRequest("/api/setup",setupSchema);setSetup(config);
   if(!config.configured){setSession(null);setCsrfToken("");return;}
   try{const user=await apiRequest("/api/session",sessionSchema);setSession(user);setCsrfToken(user.csrfToken);}
   catch(reason){setSession(null);setCsrfToken("");if(!(reason instanceof ApiError && reason.status===401))throw reason;}
  }catch(reason){setError(reason instanceof Error?reason:new Error("无法连接后台"));}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  void refresh();
  const expire=():void=>{setSession(null);setCsrfToken("");};
  window.addEventListener("bql-session-expired",expire);
  return ()=>{window.removeEventListener("bql-session-expired",expire);setCsrfToken("");};
 },[refresh]);
 useEffect(()=>{
  if(!session)return;
  const id=window.setTimeout(()=>{setSession(null);setCsrfToken("");},Math.max(session.expiresAt-Date.now(),0));
  return ()=>window.clearTimeout(id);
 },[session]);
 return <Context.Provider value={{session,setup,loading,error,refresh}}>{children}</Context.Provider>;
}
export function useSession():SessionState {const value=useContext(Context);if(!value)throw new Error("SessionProvider missing");return value;}


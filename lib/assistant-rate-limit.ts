// Best-effort limits per Worker isolate; not an account-wide spending cap.
export function createAssistantLimiter(now:()=>number=Date.now){
 let windowStart=now(),total=0,inFlight=0;
 const clients=new Map<string,number>();
 return {acquire(client:string):(()=>void)|null{
  if(now()-windowStart>=60_000){windowStart=now();total=0;clients.clear();}
  const used=clients.get(client)||0;
  if(used>=6||total>=30||inFlight>=4)return null;
  clients.set(client,used+1);total++;inFlight++;
  let released=false;
  return()=>{if(!released){inFlight--;released=true;}};
 }};
}
export const assistantLimiter=createAssistantLimiter();

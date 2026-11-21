import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export const SESSION_COOKIE='gradias_drive_session';
export const STATE_COOKIE='gradias_google_state';
export type GoogleSession={accessToken:string;refreshToken?:string;email:string;tokenExpires:number;expires:number};
function key(){const secret=process.env.GOOGLE_SESSION_SECRET;if(!secret||secret.length<32)throw Error('Google session secret is not configured');return createHash('sha256').update(secret).digest();}
export function seal(value:unknown,purpose:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(purpose));
 return Buffer.concat([iv,cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]).toString('base64url');
}
export function unseal<T extends {expires:number}>(value:string,purpose:string):T|null{
 try{const data=Buffer.from(value,'base64url');if(data.length<29||data.length>4000)return null;const decipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));decipher.setAAD(Buffer.from(purpose));decipher.setAuthTag(data.subarray(-16));const item=JSON.parse(Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]).toString()) as T;return typeof item.expires==='number'&&item.expires>Date.now()?item:null;}catch{return null;}
}
export function cookieValue(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
export function appOrigin(){
 const url=new URL(process.env.APP_URL||'');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('APP_URL must use HTTPS');
 return url.origin;
}
export function cookie(name:string,value:string,maxAge:number){
 if(value.length>3800)throw Error('Google session exceeds cookie size');
 return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${appOrigin().startsWith('https:')?'; Secure':''}`;
}
export const sessionCookie=(session:GoogleSession)=>cookie(SESSION_COOKIE,seal(session,'drive-session'),Math.max(0,Math.floor((session.expires-Date.now())/1000)));
export async function googleSession(request:Request):Promise<{session:GoogleSession|null;setCookie?:string}>{
 const session=unseal<GoogleSession>(cookieValue(request,SESSION_COOKIE),'drive-session');
 if(!session||typeof session.accessToken!=='string'||typeof session.email!=='string'||typeof session.tokenExpires!=='number')return {session:null};
 if(session.tokenExpires>Date.now()+60_000)return {session};
 if(!session.refreshToken)return {session:null};
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:session.refreshToken,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15_000),cache:'no-store'});
 if(!response.ok)return {session:null};
 const token=await response.json() as {access_token?:string;expires_in?:number};
 if(!token.access_token||!token.expires_in)return {session:null};
 session.accessToken=token.access_token;session.tokenExpires=Date.now()+token.expires_in*1000;
 return {session,setCookie:sessionCookie(session)};
}

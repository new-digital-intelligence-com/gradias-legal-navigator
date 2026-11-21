import {appOrigin,cookie,cookieValue,sessionCookie,STATE_COOKIE,unseal,type GoogleSession} from '@/lib/google-session';
import {folderMetadata} from '@/lib/google-drive';
export const dynamic='force-dynamic';
function redirect(error?:string,session?:GoogleSession){
 const headers=new Headers({Location:appOrigin()+'/?'+(error?'driveError='+encodeURIComponent(error):'driveConnected=1')+'#sources','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 headers.append('Set-Cookie',cookie(STATE_COOKIE,'',0));if(session)headers.append('Set-Cookie',sessionCookie(session));
 return new Response(null,{status:303,headers});
}
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const saved=unseal<{state:string;verifier:string;expires:number}>(cookieValue(request,STATE_COOKIE),'oauth-state');
 if(!saved||!params.get('state')||params.get('state')!==saved.state)return redirect('Die Anmeldung konnte nicht bestätigt werden. Bitte erneut anmelden.');
 if(params.get('error'))return redirect('Die Google-Anmeldung wurde abgebrochen oder nicht freigegeben.');
 const code=params.get('code');if(!code)return redirect('Google hat keinen Anmeldecode geliefert.');
 try{
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:appOrigin()+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:saved.verifier}),signal:AbortSignal.timeout(15_000),cache:'no-store'});
  if(!response.ok)throw Error('Token exchange failed');
  const token=await response.json() as {access_token:string;refresh_token?:string;expires_in:number;scope:string};
  if(!token.access_token||!token.expires_in||!token.scope?.split(' ').includes('https://www.googleapis.com/auth/drive'))return redirect('Der Zugriff auf Google Drive wurde nicht freigegeben.');
  const userResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(15_000),cache:'no-store'});
  if(!userResponse.ok)throw Error('Identity check failed');
  const user=await userResponse.json() as {email?:string;email_verified?:boolean};
  if(!user.email||user.email_verified!==true)return redirect('Bitte ein bestätigtes Google-Konto verwenden.');
  // Successful sign-in alone is not authorization. Google must grant folder access.
  const root=await folderMetadata(token.access_token);
  if(root.mimeType!=='application/vnd.google-apps.folder'||root.capabilities?.canListChildren===false)return redirect('Dieses Google-Konto hat keinen Zugriff auf die Dokumentenablage.');
  return redirect(undefined,{accessToken:token.access_token,refreshToken:token.refresh_token,email:user.email,tokenExpires:Date.now()+token.expires_in*1000,expires:Date.now()+7*24*60*60*1000});
 }catch{return redirect('Die Verbindung zu Google Drive konnte nicht hergestellt werden. Bitte Anmeldung und Ordnerfreigabe prüfen.');}
}

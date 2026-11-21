import {createHash,randomBytes} from 'node:crypto';
import {googleConfigured} from '@/lib/drive-config';
import {appOrigin,cookie,seal,STATE_COOKIE} from '@/lib/google-session';
export const dynamic='force-dynamic';
export async function GET(){
 if(!googleConfigured())return Response.json({error:'Die Google-Anmeldung ist noch nicht eingerichtet.'},{status:503});
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
 const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:appOrigin()+'/api/auth/google/callback',response_type:'code',scope:'openid email https://www.googleapis.com/auth/drive',state,access_type:'offline',prompt:'consent select_account',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
 return new Response(null,{status:302,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+params,'Cache-Control':'no-store','Set-Cookie':cookie(STATE_COOKIE,seal({state,verifier,expires:Date.now()+600_000},'oauth-state'),600)}});
}

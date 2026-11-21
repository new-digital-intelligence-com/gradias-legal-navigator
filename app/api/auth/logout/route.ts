import {cookie,SESSION_COOKIE,STATE_COOKIE} from '@/lib/google-session';
import {hasSameOrigin} from '@/lib/request-context';
export async function POST(request:Request){
 if(!hasSameOrigin(request))return Response.json({error:'Diese Anfrage muss aus der App kommen.'},{status:403});
 const headers=new Headers({'Cache-Control':'no-store'});headers.append('Set-Cookie',cookie(SESSION_COOKIE,'',0));headers.append('Set-Cookie',cookie(STATE_COOKIE,'',0));
 return Response.json({ok:true},{headers});
}

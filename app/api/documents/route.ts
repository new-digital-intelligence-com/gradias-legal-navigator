import {driveFolder,googleConfigured,DRIVE_POLL_MS} from '@/lib/drive-config';
import {googleSession} from '@/lib/google-session';
import {DriveError,folderMetadata,listDocuments,invalidateDriveCache,MAX_DOCUMENT_BYTES,uploadDocument} from '@/lib/google-drive';
import {hasSameOrigin} from '@/lib/request-context';
import {createAssistantLimiter} from '@/lib/assistant-rate-limit';
export const dynamic='force-dynamic';
const uploadLimiter=createAssistantLimiter();
const json=(data:unknown,status=200,setCookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie',...(setCookie?{'Set-Cookie':setCookie}:{})}});
export async function GET(request:Request){
 const config={folder:driveFolder(),pollMs:DRIVE_POLL_MS,configured:googleConfigured()};
 if(!config.configured)return json({...config,connected:false,files:[]});
 let setCookie:string|undefined;
 try{
  const auth=await googleSession(request);setCookie=auth.setCookie;
  if(!auth.session)return json({...config,connected:false,files:[]});
  const root=await folderMetadata(auth.session.accessToken);
  if(new URL(request.url).searchParams.get('refresh')==='1')invalidateDriveCache(auth.session.accessToken);
  const snapshot=await listDocuments(auth.session.accessToken,root);
  return json({...config,connected:true,email:auth.session.email,canUpload:root.capabilities?.canAddChildren===true,...snapshot},200,setCookie);
 }catch(error){return json({...config,error:error instanceof DriveError?error.message:'Die Dokumentenablage konnte nicht geladen werden.'},error instanceof DriveError?error.status:502,setCookie);}
}
async function boundedFormData(request:Request){
 const max=MAX_DOCUMENT_BYTES+64*1024;
 if(Number(request.headers.get('content-length'))>max)throw new DriveError('Die Datei ist zu groß (maximal 20 MB).',413);
 const reader=request.body?.getReader();if(!reader)throw new DriveError('Datei fehlt.',400);
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new DriveError('Die Datei ist zu groß (maximal 20 MB).',413);}chunks.push(value);}}finally{reader.releaseLock();}
 try{return await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();}catch{throw new DriveError('Ungültiger Datei-Upload.',400);}
}
export async function POST(request:Request){
 if(!hasSameOrigin(request))return json({error:'Diese Anfrage muss aus der App kommen.'},403);
 if(!googleConfigured())return json({error:'Die Google-Anmeldung ist noch nicht eingerichtet.'},503);
 let release:(()=>void)|null=null,setCookie:string|undefined;
 try{
  const auth=await googleSession(request);setCookie=auth.setCookie;
  if(!auth.session)return json({error:'Bitte zuerst mit Google anmelden.'},401);
  release=uploadLimiter.acquire(auth.session.email);if(!release)return json({error:'Bitte eine Minute warten und den Upload erneut versuchen.'},429,setCookie);
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))return json({error:'Ein Datei-Upload ist erforderlich.'},415,setCookie);
  const form=await boundedFormData(request),file=form.get('file');
  if(!(file instanceof File)||form.getAll('file').length!==1)return json({error:'Bitte genau eine Datei auswählen.'},400,setCookie);
  const uploaded=await uploadDocument(auth.session.accessToken,file.name,new Uint8Array(await file.arrayBuffer()));
  return json({file:uploaded},201,setCookie);
 }catch(error){return json({error:error instanceof DriveError?error.message:'Der Upload konnte nicht bestätigt werden. Bitte den Drive-Ordner prüfen.'},error instanceof DriveError?error.status:502,setCookie);}finally{release?.();}
}

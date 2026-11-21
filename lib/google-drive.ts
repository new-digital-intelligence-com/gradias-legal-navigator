import {createHash,randomBytes} from 'node:crypto';
import {driveFolder} from './drive-config';

export type DriveFile={id:string;name:string;mimeType:string;parents?:string[];size?:string;modifiedTime?:string;webViewLink?:string;webContentLink?:string;driveId?:string;capabilities?:{canAddChildren?:boolean;canListChildren?:boolean;canDownload?:boolean};path?:string;sha256Checksum?:string;md5Checksum?:string};
export class DriveError extends Error {status:number;constructor(message:string,status=502){super(message);this.status=status;}}
const API='https://www.googleapis.com/drive/v3';
const FOLDER='application/vnd.google-apps.folder';
const FIELDS='id,name,mimeType,parents,size,modifiedTime,webViewLink,webContentLink,capabilities(canDownload),sha256Checksum,md5Checksum';
export async function googleDriveFetch<T>(token:string,path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(API+path,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(20_000)});
 if(!response.ok)throw new DriveError(response.status===401?'Die Google-Anmeldung ist abgelaufen. Bitte erneut anmelden.':response.status===403||response.status===404?'Kein Zugriff auf diesen Drive-Ordner. Bitte die Google-Berechtigungen prüfen.':response.status===429?'Google Drive ist vorübergehend ausgelastet. Bitte später erneut versuchen.':'Google Drive ist vorübergehend nicht erreichbar.',response.status===401?401:response.status===403||response.status===404?403:502);
 return response.json() as Promise<T>;
}
export function folderMetadata(token:string){return googleDriveFetch<DriveFile>(token,`/files/${driveFolder().id}?supportsAllDrives=true&fields=id,name,mimeType,driveId,capabilities(canAddChildren,canListChildren)`);}
type Snapshot={files:DriveFile[];syncedAt:string;partial:boolean};
const cache=new Map<string,{until:number;snapshot:Snapshot}>();
const cacheKey=(token:string)=>createHash('sha256').update(token+driveFolder().id).digest('hex');
export function invalidateDriveCache(token:string){cache.delete(cacheKey(token));}

export async function listDocuments(token:string,root:DriveFile):Promise<Snapshot>{
 if(root.mimeType!==FOLDER)throw new DriveError('Die Dokumentenablage ist kein Drive-Ordner.',503);
 const key=cacheKey(token),cached=cache.get(key);if(cached&&cached.until>Date.now())return cached.snapshot;
 const paths=new Map([[root.id,driveFolder().path]]),queue=[root.id],visited=new Set<string>(),files=new Map<string,DriveFile>();
 let partial=false,requests=0;
 while(queue.length){
  if(requests>=100||files.size>=10_000||visited.size>=1000){partial=true;break;}
  const batch=queue.splice(0,30).filter(id=>!visited.has(id));if(!batch.length)continue;batch.forEach(id=>visited.add(id));
  let pageToken:string|undefined;
  do{
   if(++requests>100){partial=true;break;}
   const query=new URLSearchParams({q:`trashed = false and (${batch.map(id=>`'${id}' in parents`).join(' or ')})`,fields:`nextPageToken,incompleteSearch,files(${FIELDS})`,pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(root.driveId?{corpora:'drive',driveId:root.driveId}:{}),...(pageToken?{pageToken}:{})});
   const page=await googleDriveFetch<{files:DriveFile[];nextPageToken?:string;incompleteSearch?:boolean}>(token,'/files?'+query);
   partial||=Boolean(page.incompleteSearch);
   for(const file of page.files){
    const parent=file.parents?.find(p=>paths.has(p));if(!parent)continue;
    const path=`${paths.get(parent)} / ${file.name}`;
    if(file.mimeType===FOLDER){if(!paths.has(file.id)){paths.set(file.id,path);queue.push(file.id);}}
    else if(file.mimeType!=='application/vnd.google-apps.shortcut'){files.set(file.id,{...file,path});}
   }
   pageToken=page.nextPageToken;
  }while(pageToken);
 }
 const snapshot={files:[...files.values()].sort((a,b)=>a.name.localeCompare(b.name,'de')),syncedAt:new Date().toISOString(),partial};
 // A cache is per credential, short lived and bounded. Recheck folder access before using it.
 if(!partial){for(const [k,v] of cache)if(v.until<=Date.now())cache.delete(k);if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+25_000,snapshot});}
 return snapshot;
}
export const MAX_DOCUMENT_BYTES=20*1024*1024;
const MIME:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',md:'text/markdown',csv:'text/csv',tsv:'text/tab-separated-values',json:'application/json',html:'text/html',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
export function documentMime(name:string,size:number){
 if(!name||name.length>200||/[\x00-\x1f\x7f/\\]/.test(name))throw new DriveError('Ungültiger Dateiname.',400);
 const mime=MIME[name.split('.').at(-1)!.toLowerCase()];if(!mime)throw new DriveError('Unterstützt: PDF, DOCX, XLSX, PPTX, Text, CSV, JSON, HTML und Bilder.',415);
 if(!size||size>MAX_DOCUMENT_BYTES)throw new DriveError('Bitte eine nicht leere Datei bis 20 MB auswählen.',413);
 return mime;
}
export async function uploadDocument(token:string,name:string,bytes:Uint8Array):Promise<DriveFile>{
 const root=await folderMetadata(token);
 if(!root.capabilities?.canAddChildren)throw new DriveError('Dein Google-Konto hat keine Schreibberechtigung für diesen Ordner.',403);
 const mime=documentMime(name,bytes.byteLength),boundary='gradias_'+randomBytes(24).toString('hex');
 const metadata={name,parents:[driveFolder().id]};
 const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),Buffer.from(bytes),Buffer.from(`\r\n--${boundary}--`)]);
 const response=await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(FIELDS)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body,signal:AbortSignal.timeout(60_000)});
 if(!response.ok)throw new DriveError(response.status===403?'Google Drive hat den Upload verweigert. Bitte Schreibrechte und Speicherplatz prüfen.':'Der Upload konnte nicht bestätigt werden. Bitte zuerst den Ordner prüfen, bevor du erneut hochlädst.',response.status===403?403:502);
 const file=await response.json() as DriveFile;invalidateDriveCache(token);return file;
}

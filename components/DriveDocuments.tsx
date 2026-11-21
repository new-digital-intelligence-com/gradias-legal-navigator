'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ExternalLink,FolderOpen,RefreshCw,Upload} from 'lucide-react';
import {DRIVE_POLL_MS,SOURCE_FOLDER_ID,SOURCE_FOLDER_PATH} from '@/lib/drive-config';
import type {DriveFile} from '@/lib/google-drive';
type DriveState={configured:boolean;connected:boolean;email?:string;canUpload?:boolean;folder:{id:string;path:string;url:string};files:DriveFile[];syncedAt?:string;partial?:boolean;error?:string};
export function DriveDocuments({query}:{query:string}){
 const [state,setState]=useState<DriveState|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[limit,setLimit]=useState(30);
 const mounted=useRef(true),loading=useRef(false),controller=useRef<AbortController|null>(null);
 const refresh=useCallback(async(force=false)=>{
  if(loading.current&&!force)return;if(force)controller.current?.abort();loading.current=true;const current=new AbortController();controller.current=current;setBusy(true);
  try{const response=await fetch('/api/documents'+(force?'?refresh=1':''),{signal:current.signal,cache:'no-store'}),data=await response.json() as DriveState;
   if(!mounted.current||controller.current!==current)return;
   if(!response.ok){if(response.status===401||response.status===403)setState(s=>s?{...s,connected:false,files:[],canUpload:false}:null);throw Error(data.error||'Die Dokumentenablage konnte nicht geladen werden.');}
   setState(data);setError('');
  }catch(e){if(mounted.current&&controller.current===current&&!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Verbindung unterbrochen.');}
  finally{if(controller.current===current){loading.current=false;if(mounted.current)setBusy(false);}}
 },[]);
 useEffect(()=>{
  mounted.current=true;
  const initial=setTimeout(()=>{
   void refresh();
   const params=new URLSearchParams(window.location.search);if(params.has('driveError'))setNotice(params.get('driveError')||'Anmeldung fehlgeschlagen.');if(params.has('driveConnected'))setNotice('Google Drive ist verbunden.');
   if(params.has('driveError')||params.has('driveConnected')){params.delete('driveError');params.delete('driveConnected');window.history.replaceState(null,'',window.location.pathname+(params.size?'?'+params:'')+window.location.hash);}
  },0);
  const onFocus=()=>{if(document.visibilityState==='visible')void refresh();};
  const timer=setInterval(onFocus,DRIVE_POLL_MS);window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);
  return()=>{mounted.current=false;controller.current?.abort();controller.current=null;loading.current=false;clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);};
 },[refresh]);
 async function upload(file:File){
  if(!file.size||file.size>20*1024*1024){setError('Bitte eine nicht leere Datei bis 20 MB auswählen.');return;}
  setUploading(true);setNotice('');setError('');
  try{const body=new FormData();body.append('file',file);const response=await fetch('/api/documents',{method:'POST',body});const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error||'Upload fehlgeschlagen.');setNotice(`${file.name} wurde in Google Drive abgelegt.`);await refresh(true);}
  catch(e){setError(e instanceof Error?e.message:'Upload fehlgeschlagen.');}finally{setUploading(false);}
 }
 async function logout(){try{const response=await fetch('/api/auth/logout',{method:'POST'});if(!response.ok)throw Error('Abmeldung fehlgeschlagen.');setState(s=>s?{...s,connected:false,files:[],email:undefined,canUpload:false}:null);setNotice('Abgemeldet.');}catch(e){setError(e instanceof Error?e.message:'Abmeldung fehlgeschlagen.');}}
 const folder=state?.folder||{id:SOURCE_FOLDER_ID,path:SOURCE_FOLDER_PATH,url:`https://drive.google.com/drive/folders/${SOURCE_FOLDER_ID}`};
 const files=state?.files.filter(f=>(f.name+' '+f.path).toLowerCase().includes(query.toLowerCase()))||[];
 return <section className="panel drive-documents" aria-label="Google Drive Dokumentenablage">
  <div className="drive-heading"><div><div className="eyebrow">ZENTRALE DOKUMENTENABLAGE</div><h2><FolderOpen size={22}/>Google Drive</h2><p className="drive-path">{folder.path}</p></div><a className="button" href={folder.url} target="_blank" rel="noreferrer"><FolderOpen size={16}/>Drive-Explorer öffnen <ExternalLink size={13}/></a></div>
  <p className="drive-description">Dokumente und Unterordner werden bei geöffneter Ansicht automatisch alle 30 Sekunden abgeglichen. Deine Google-Berechtigungen bestimmen den Zugriff.</p>
  <div className="drive-controls">{state?.connected?<><span>Angemeldet: {state.email}</span><button className="text-button" onClick={logout}>Abmelden</button><button className="button subtle" disabled={busy||uploading} onClick={()=>void refresh(true)}><RefreshCw size={15}/>{busy?'Aktualisierung …':'Aktualisieren'}</button><label className={'button primary upload-document '+(!state.canUpload||uploading?'disabled':'')}><Upload size={15}/>{uploading?'Wird hochgeladen …':'Dokument hinzufügen'}<input aria-label="Dokument zu Google Drive hinzufügen" type="file" disabled={!state.canUpload||uploading} accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.tsv,.json,.html,.png,.jpg,.jpeg,.webp" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void upload(file);}}/></label></>:state?.configured?<a className="button primary" href="/api/auth/google">Mit Google anmelden</a>:<span>{busy?'Verbindung wird geprüft …':'Google-Anmeldung noch nicht eingerichtet. Der Ordner kann bereits in Drive geöffnet werden.'}</span>}</div>
  {state?.connected&&!state.canUpload&&<p>Du hast Lesezugriff. Zum Hinzufügen ist Schreibberechtigung im Drive-Ordner erforderlich.</p>}
  {notice&&<p role="status">{notice}</p>}{error&&<p className="drive-error" role="alert">{error} <button className="text-button" onClick={()=>void refresh(true)}>Erneut versuchen</button></p>}
  {state?.connected&&<><div className="drive-sync"><span>{files.length} Dokumente{state.partial?' (Teilliste)':''}</span><span>{state.syncedAt?'Letzter Abgleich: '+new Date(state.syncedAt).toLocaleTimeString('de-DE'):''}</span></div>{state.partial&&<p role="alert">Der Ordner konnte nicht vollständig eingelesen werden. Bitte den Drive-Explorer für die vollständige Ablage verwenden.</p>}
  <div className="source-list">{files.slice(0,limit).map(file=><article className="source-row" key={file.id}><div className="source-body"><div className="source-meta"><span>{file.mimeType.replace('application/vnd.google-apps.','Google ')}</span>{file.size&&<span>{(Number(file.size)/1024/1024).toFixed(2)} MB</span>}</div><h3>{file.name}</h3><p>{file.path}</p><small>{file.modifiedTime?'Geändert: '+new Date(file.modifiedTime).toLocaleString('de-DE'):''}</small></div><div className="source-actions"><a href={`https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`} target="_blank" rel="noreferrer">In Drive öffnen <ExternalLink size={14}/></a></div></article>)}</div>
  {!files.length&&!busy&&<p>Keine passenden Dokumente im Drive-Ordner gefunden.</p>}{limit<files.length&&<button className="button" onClick={()=>setLimit(n=>n+30)}>Weitere Dokumente anzeigen</button>}
  <p className="drive-description">Neue Dateien erscheinen hier automatisch. Die geprüfte Recherchematrix und die Antworten aus dem Forschungsstand werden durch neue Dateien nicht ungeprüft überschrieben. Einzelne Dateien können zusätzlich als Chat-Anhang verwendet werden.</p></>}
 </section>;
}

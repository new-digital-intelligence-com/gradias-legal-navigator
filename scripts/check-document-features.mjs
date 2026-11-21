import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Run the actual server modules with mocked Google HTTP responses. No credentials,
// Drive writes, framework test bypasses or production network calls are needed.
const root=path.resolve(import.meta.dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gradias-document-tests-'));
fs.writeFileSync(path.join(temp,'package.json'),'{"type":"commonjs"}');
const modules=['lib/answer-tables','lib/drive-config','lib/google-session','lib/google-drive','lib/request-context','lib/assistant-rate-limit','app/api/documents/route','app/api/auth/google/route','app/api/auth/google/callback/route','app/api/auth/logout/route'];
for(const name of modules){
 const out=path.join(temp,name+'.js');fs.mkdirSync(path.dirname(out),{recursive:true});
 const source=fs.readFileSync(path.join(root,name+'.ts'),'utf8').replace(/(['"])@\/([^'"]+)\1/g,(_,quote,target)=>quote+path.relative(path.dirname(out),path.join(temp,target)).replaceAll('\\','/')+quote);
 fs.writeFileSync(out,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
}
const require=createRequire(path.join(temp,'test.cjs'));
const originalFetch=globalThis.fetch;
const originalEnv={...process.env};
try{
 const tables=require('./lib/answer-tables.js');
 const content=JSON.parse(fs.readFileSync(path.join(root,'data/content.json'),'utf8'));
 const table=tables.stateGuidanceTable(content.states,content.meta.reviewDate);
 assert.equal(table.rows.length,16);assert.equal(new Set(table.rows.map(r=>r.cells[0])).size,16);
 assert.match(table.rows.find(r=>r.cells[0]==='Saarland').cells[4],/nicht gefunden/);
 assert.match(table.rows.find(r=>r.cells[0]==='Sachsen-Anhalt').cells[4],/nicht zuverlässig erreichbar/);
 for(const q of ['Gib mir die 16 Richtlinien zur KI Nutzung in Schulen per Bundesland als Tabelle','Zeige eine Tabelle der KI-Handreichungen für alle Bundesländer','List AI guidance for schools in all 16 German states','Welche Richtlinien gibt es je Bundesland?'])assert.ok(tables.wantsStateOverview(q),q);
 assert.ok(tables.wantsStateOverview('Das bitte als CSV herunterladen','Welche KI-Richtlinien gelten in den Schulen der 16 Bundesländer?'));
 assert.ok(!tables.wantsStateOverview('What does Bavaria require for school consent?'));
 assert.ok(!tables.wantsStateOverview('Tabelle der Wettbewerber','Welche KI-Richtlinien gelten in den Bundesländern?'));
 assert.equal(tables.validateAnswerTable(table,new Set(table.rows.flatMap(r=>r.citationIds))),table);
 assert.throws(()=>tables.validateAnswerTable({...table,rows:[{cells:['wrong'],citationIds:['invented']}]},new Set()),/Ungrounded/);
 const csv=tables.tableCSV(table);assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/Baden-Württemberg/);assert.match(csv,/https:\/\/www\.berlin\.de/);
 assert.equal(tables.csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(tables.csvCell(' \t@SUM(1)'),'"\' \t@SUM(1)"');
 const malicious={title:'<script>alert(1)</script>',columns:['A','B'],rows:[{cells:['<img src=x onerror=alert(1)>','safe'],citationIds:['s']}],note:'<b>note</b>'};
 assert.doesNotMatch(tables.tableHTML(malicious),/<script>|<img/);

 process.env.APP_URL='https://gradias.example';process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';process.env.GOOGLE_SESSION_SECRET='test-only-session-secret-at-least-32-characters';
 const auth=require('./lib/google-session.js'),drive=require('./lib/google-drive.js'),config=require('./lib/drive-config.js');
 const session={accessToken:'user-token',email:'editor@example.com',tokenExpires:Date.now()+3600_000,expires:Date.now()+3600_000};
 const encrypted=auth.seal(session,'drive-session');assert.ok(!encrypted.includes('user-token'));assert.equal(auth.unseal(encrypted,'drive-session').email,session.email);
 assert.equal(auth.unseal(encrypted,'oauth-state'),null);assert.equal(auth.unseal(encrypted.slice(0,-8)+'xxxxxxxx','drive-session'),null);assert.equal(auth.unseal(auth.seal({...session,expires:0},'drive-session'),'drive-session'),null);
 assert.match(auth.sessionCookie(session),/HttpOnly; SameSite=Lax/);assert.match(auth.sessionCookie(session),/Secure/);
 const documents=require('./app/api/documents/route.js');
 const request=(options={})=>new Request('https://gradias.example/api/documents',{headers:{Origin:'https://gradias.example',Cookie:auth.sessionCookie(session).split(';')[0]},...options});
 const rootFolder={id:config.driveFolder().id,name:'Data Protection and Compliance',mimeType:'application/vnd.google-apps.folder',driveId:'shared-drive',capabilities:{canListChildren:true,canAddChildren:true}};
 let calls=[],phase=0,deny=false,uploadBody;
 globalThis.fetch=async(url,options={})=>{
  calls.push(String(url));const u=new URL(url);
  assert.equal(new Headers(options.headers).get('Authorization'),'Bearer user-token');
  if(u.pathname.includes('/upload/')){uploadBody=Buffer.from(options.body).toString();return Response.json({id:'created',name:'new.pdf'});}
  if(u.pathname.includes('/files/'))return deny?Response.json({}, {status:403}):Response.json(rootFolder);
  assert.equal(u.searchParams.get('driveId'),'shared-drive');assert.equal(u.searchParams.get('supportsAllDrives'),'true');
  const q=u.searchParams.get('q');assert.match(q,/trashed = false/);
  if(q.includes(rootFolder.id)){
   if(u.searchParams.get('pageToken')==='second')return Response.json({files:[{id:'folder-1',name:'Nested',mimeType:'application/vnd.google-apps.folder',parents:[rootFolder.id]}]});
   return Response.json({nextPageToken:'second',files:phase===1?[]:[{id:'first',name:'Same.pdf',mimeType:'application/pdf',parents:[rootFolder.id]},{id:'shortcut',name:'Outside shortcut',mimeType:'application/vnd.google-apps.shortcut',parents:[rootFolder.id]}]});
  }
  assert.match(q,/folder-1/);return Response.json({files:[{id:'nested',name:phase?'Added in Drive.pdf':'Same.pdf',mimeType:'application/pdf',parents:['folder-1']}]});
 };
 let response=await documents.GET(request()),data=await response.json();assert.equal(response.status,200);assert.equal(data.files.length,2);assert.equal(data.canUpload,true);assert.match(data.files.find(f=>f.id==='nested').path,/Nested \/ Same.pdf/);assert.equal(data.partial,false);
 assert.equal((await documents.GET(request())).status,200);assert.equal(calls.filter(u=>u.includes('pageToken=second')).length,1,'cache prevents repeated recursive scans');
 phase=1;data=await documents.GET(new Request('https://gradias.example/api/documents?refresh=1',{headers:request().headers})).then(r=>r.json());assert.equal(data.files.length,1,'deleted file removed on manual sync');assert.equal(data.files[0].name,'Added in Drive.pdf');
 deny=true;assert.equal((await documents.GET(request())).status,403,'revalidate access even with a cached catalog');deny=false;
 assert.equal((await documents.POST(new Request('https://gradias.example/api/documents',{method:'POST',headers:{Origin:'https://evil.example'}}))).status,403);
 assert.equal((await documents.POST(new Request('https://gradias.example/api/documents',{method:'POST',headers:{Origin:'https://gradias.example'}}))).status,401);
 rootFolder.capabilities.canAddChildren=false;
 const form=new FormData();form.append('file',new File(['%PDF-1.7 test'],'new.pdf',{type:'application/pdf'}));
 assert.equal((await documents.POST(request({method:'POST',body:form}))).status,403,'viewer cannot upload');rootFolder.capabilities.canAddChildren=true;
 response=await documents.POST(request({method:'POST',body:form}));assert.equal(response.status,201);assert.ok(uploadBody.includes(`"parents":["${rootFolder.id}"]`));
 assert.throws(()=>drive.documentMime('../escape.pdf',10));assert.throws(()=>drive.documentMime('bad.exe',10));assert.throws(()=>drive.documentMime('big.pdf',drive.MAX_DOCUMENT_BYTES+1));
 const login=require('./app/api/auth/google/route.js');response=await login.GET();const location=new URL(response.headers.get('Location'));assert.equal(location.hostname,'accounts.google.com');assert.equal(location.searchParams.get('code_challenge_method'),'S256');assert.equal(location.searchParams.get('redirect_uri'),'https://gradias.example/api/auth/google/callback');
 const callback=require('./app/api/auth/google/callback/route.js');calls=[];response=await callback.GET(new Request('https://gradias.example/api/auth/google/callback?state=invalid&code=fake'));assert.match(response.headers.get('Location'),/driveError=/);assert.equal(calls.length,0,'reject invalid state before token exchange');
 const saved={state:'valid-state',verifier:'test-pkce-verifier',expires:Date.now()+600_000};
 const callbackRequest=()=>new Request('https://gradias.example/api/auth/google/callback?state=valid-state&code=valid-code',{headers:{Cookie:auth.cookie(auth.STATE_COOKIE,auth.seal(saved,'oauth-state'),600).split(';')[0]}});
 globalThis.fetch=async(url,options={})=>{
  if(String(url)==='https://oauth2.googleapis.com/token'){assert.equal(options.body.get('code_verifier'),'test-pkce-verifier');return Response.json({access_token:'new-token',refresh_token:'refresh-token',expires_in:3600,scope:'openid email https://www.googleapis.com/auth/drive'});}
  if(String(url).includes('/userinfo'))return Response.json({email:'editor@example.com',email_verified:true});
  return Response.json(rootFolder);
 };
 response=await callback.GET(callbackRequest());assert.match(response.headers.get('Location'),/driveConnected=1#sources/);assert.ok(!response.headers.get('Location').includes('new-token'));
 const loginCookie=response.headers.getSetCookie().find(c=>c.startsWith(auth.SESSION_COOKIE+'='));assert.ok(loginCookie);const decoded=auth.unseal(loginCookie.split(';')[0].slice(auth.SESSION_COOKIE.length+1),'drive-session');assert.equal(decoded.refreshToken,'refresh-token');
 rootFolder.capabilities.canListChildren=false;response=await callback.GET(callbackRequest());assert.match(response.headers.get('Location'),/driveError=/);assert.ok(!response.headers.getSetCookie().some(c=>c.startsWith(auth.SESSION_COOKIE+'=')));rootFolder.capabilities.canListChildren=true;
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://oauth2.googleapis.com/token');assert.equal(options.body.get('grant_type'),'refresh_token');return Response.json({access_token:'renewed-token',expires_in:3600});};
 const expiredToken={...session,tokenExpires:0,refreshToken:'refresh-token'};
 const refreshed=await auth.googleSession(new Request('https://gradias.example',{headers:{Cookie:auth.sessionCookie(expiredToken).split(';')[0]}}));assert.equal(refreshed.session.accessToken,'renewed-token');assert.ok(refreshed.setCookie);
 console.log('PASS: 16-state completeness, follow-up exports, citations, CSV injection, HTML escaping, encrypted sessions, OAuth state/PKCE, recursive shared-Drive pagination, external additions/deletions, permission revocation, upload authorization and destination.');
}finally{
 globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in originalEnv))delete process.env[k];Object.assign(process.env,originalEnv);
 fs.rmSync(temp,{recursive:true,force:true});
}

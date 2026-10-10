import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:5173';
async function post(body,origin=base){return fetch(base+'/api/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});}
const health=await fetch(base+'/api/ask').then(r=>r.json());assert.ok(['search','ai'].includes(health.mode));
assert.equal((await post({question:'Consent'},'https://untrusted.example')).status,403);
assert.equal((await post('{broken')).status,400);
assert.equal((await post({question:''})).status,400);
assert.equal((await post({question:'a'.repeat(1601)})).status,400);
if(health.mode==='search'){
 const consent=await post({question:'Is student consent required?'}).then(r=>r.json());assert.match(consent.citations[0].title,/student.*consent/i);assert.match(consent.citations[0].excerpt,/Not automatically/);
 const nav=await post({question:'Show me the German country view'}).then(r=>r.json());assert.equal(nav.action.tab,'countries');assert.equal(nav.action.country,'Germany');
 const unknown=await post({question:'Tell me about extraterrestrial pizza on Jupiter'}).then(r=>r.json());assert.equal(unknown.citations.length,0);assert.match(unknown.text,/could not find/);
 console.log('PASS: retrieval, navigation, missing evidence, origin checks and input validation.');
}else console.log('PASS: input guards; paid inference requires authenticated hosted testing.');

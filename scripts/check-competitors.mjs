import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const {competitors:items,counts}=read('data/competitors.json');
const manifest=read('data/competitor-source-manifest.json');
const norm=s=>s.replace(/\s+/g,' ').trim();
assert.deepEqual(counts,{competitors:55,capturedDocuments:231,links:236,files:62,pages:1657});
let files=0,positions=0;
for(const c of items){
 const pages=read('public'+c.textUrl).pages;
 assert.equal(pages.length,c.pages,c.name);
 assert.equal(c.sources.length,manifest.filter(s=>s.competitor_id===c.number).length,c.name);
 for(const s of c.sources){assert.ok(/^https?:\/\//.test(s.source_url));if(s.status==='Captured'){assert.ok(s.startPage>1&&s.endPage<=c.pages,c.name+' '+s.document);assert.ok(s.pageRanges.length);}}
 for(const f of c.files){const bytes=fs.readFileSync(new URL('../public'+f.url,import.meta.url));assert.equal(bytes.length,f.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256,f.path);files++;}
 if(c.coverageKind==='links')assert.equal(c.positions.length,0);else assert.ok(c.positions.length>=2,c.name+': positions missing');
 for(const p of c.positions){assert.ok(p.page>=1&&p.page<=c.pages,c.name);assert.ok(c.sources.some(s=>s.source_url===p.sourceUrl),c.name+': position source');assert.ok(norm(pages[p.page-1].text).includes(norm(p.quote)),c.name+' page '+p.page+': quote must match');positions++;}
}
assert.equal(files,62);assert.equal(items.filter(c=>c.coverageKind==='policies').length,52);assert.equal(items.filter(c=>c.coverageKind==='statements').length,2);
console.log(`PASS: 55 competitors, 236 sources, 62 file hashes, 1,657 pages and ${positions} exact position quotes verified.`);

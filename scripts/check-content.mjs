import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const content=read('data/content.json'),sheet=read('data/spreadsheet-snapshot.json');
const rows=sheet.sheets.find(s=>s.properties.title==='Requirements matrix').data[0].rowData;
for(const [k,n] of Object.entries({requirements:60,instruments:97,qa:22,states:16,sources:222,documents:59}))assert.equal(content[k].length,n,k);
let yes=0;
for(const [r,requirement] of content.requirements.entries()){
 assert.equal(requirement.cells.length,97);
 for(const [c,cell] of requirement.cells.entries()){
  const original=rows[r+6].values[c+1];
  assert.equal(cell.value,original.formattedValue,`${requirement.id}/${cell.instrumentId}`);
  assert.equal(cell.note,original.note||'',`${requirement.id}/${cell.instrumentId}: note`);
  assert.equal(cell.instrumentId,content.instruments[c].id);assert.ok(['Yes','No'].includes(cell.value));
  if(cell.value==='Yes'){yes++;assert.ok(cell.note.length>20);}
 }
}
assert.equal(yes,581);
const downloads=new Set(content.documents.map(d=>d.url));
for(const d of content.documents){const bytes=fs.readFileSync(new URL('../public'+d.url,import.meta.url));assert.equal(bytes.length,d.bytes,d.filename);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),d.sha256,d.filename);}
for(const d of content.countryDocs)assert.ok(downloads.has(d.download));
for(const d of content.countryDocs)assert.equal(new Set(d.sections.map(s=>s.id)).size,d.sections.length,'Unique section navigation targets');
for(const s of content.sources){assert.ok(/^https?:\/\//.test(s.url),s.id);if(s.download)assert.ok(downloads.has(s.download));}
for(const k of ['requirements','instruments','qa','sources','documents'])assert.equal(new Set(content[k].map(x=>x.id)).size,content[k].length);
assert.equal(JSON.stringify(content).includes('\uFFFD'),false);
console.log('PASS: 5,820 values and notes match; 581 Yes cells; all 59 files match SHA-256; links and IDs valid.');

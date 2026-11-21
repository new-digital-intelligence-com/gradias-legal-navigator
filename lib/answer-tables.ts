import type {StateGuide} from './content';

export type AnswerTable = {
  title: string;
  columns: string[];
  rows: {cells: string[]; citationIds: string[]}[];
  note: string;
};
export type ExportCitation = {id:string;title:string;urls:string[]};

const normalize=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
export const wantsTable=(q:string)=>/\b(tabelle\w*|table\w*|csv|excel|spreadsheet|download\w*|herunterlad\w*|datei|export\w*)\b/i.test(q);
export function wantsStateOverview(question:string,previous='') {
  // Follow-up exports reuse the last user topic; unrelated new questions do not.
  const q=normalize(question);
  const topic=/(bundesland|bundeslander|lander|german states|federal states)/;
  const schoolAI=/(schule|schulen|school|richtlini|guidance|guideline|handreich|leitfad|ki.nutzung|ai use)/;
  const direct=topic.test(q)&&schoolAI.test(q);
  const followup=wantsTable(q)&&q.length<160&&/\b(das|diese\w*|davon|dazu|als|that|those|it|as)\b/.test(q)&&topic.test(normalize(previous))&&schoolAI.test(normalize(previous));
  return (direct&&(wantsTable(q)||/\b(16|alle\w*|all|je|per|each|welche|which|liste|list|ubersicht|overview)\b/.test(q)))||followup;
}

export function stateGuidanceTable(states:StateGuide[],reviewDate:string):AnswerTable {
  return {
    title:'KI-Nutzung in Schulen: Übersicht der 16 Bundesländer',
    columns:['Bundesland','Amtliche Quelle / Einordnung','Stand der Quelle','Wesentliche Vorgaben','Geltungsgrenzen / Recherchehinweise','Fundstelle','Primärquelle'],
    rows:states.map((s,i)=>({cells:[s.name,`${s.instrument}\n${s.availability}`,s.date,s.finding,s.limits,s.locator,s.url],citationIds:[`state-${i}`]})),
    note:`Recherchestand: ${reviewDate}. Die Tabelle gibt die vorhandene Recherche wieder. Amtliche Empfehlungen, schulformspezifische und plattformspezifische Hinweise sind keine 16 einheitlich geltenden gesetzlichen Richtlinien. Geltungsbereich und Einschränkungen stehen in jeder Zeile; aktuelle Gültigkeit wurde nicht neu geprüft.`,
  };
}

export function validateAnswerTable(value:unknown,allowed:Set<string>):AnswerTable|null {
  if(value===null||value===undefined)return null;
  const t=value as AnswerTable;
  if(typeof t.title!=='string'||!t.title.trim()||t.title.length>250||typeof t.note!=='string'||t.note.length>4000||!Array.isArray(t.columns)||t.columns.length<2||t.columns.length>12||t.columns.some(c=>typeof c!=='string'||!c.trim()||c.length>250)||!Array.isArray(t.rows)||!t.rows.length||t.rows.length>100)throw Error('Invalid answer table');
  for(const row of t.rows){
    if(!row||!Array.isArray(row.cells)||row.cells.length!==t.columns.length||row.cells.some(c=>typeof c!=='string'||c.length>8000)||!Array.isArray(row.citationIds)||!row.citationIds.length||row.citationIds.some(id=>!allowed.has(id)))throw Error('Ungrounded table row');
  }
  return t;
}

// Quoting alone does not prevent spreadsheet formula execution.
export function csvCell(value:string){const safe=/^[\s\uFEFF]*[=+@-]/.test(value)?"'"+value:value;return '"'+safe.replaceAll('"','""')+'"';}
export function tableCSV(table:AnswerTable,citations:ExportCitation[]=[]){
  const source=(ids:string[])=>ids.map(id=>citations.find(c=>c.id===id)).filter((c):c is ExportCitation=>!!c).map(c=>`${c.title}${c.urls.length?' — '+c.urls.join(' '):''}`).join('\n');
  return '\uFEFF'+[ [...table.columns,'Quellennachweis','Recherchehinweis'], ...table.rows.map(r=>[...r.cells,source(r.citationIds),table.note]) ].map(r=>r.map(csvCell).join(',')).join('\r\n');
}
const escapeHTML=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function tableHTML(table:AnswerTable,citations:ExportCitation[]=[]){
  return `<!doctype html><html lang="de"><meta charset="utf-8"><title>${escapeHTML(table.title)}</title><style>body{font:14px system-ui;margin:32px;color:#163047}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbcbd5;padding:10px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#edf4fa}p{line-height:1.5}@media print{body{margin:0;font-size:9px}thead{display:table-header-group}tr{break-inside:avoid}}</style><h1>${escapeHTML(table.title)}</h1><p>${escapeHTML(table.note)}</p><table><thead><tr>${[...table.columns,'Quellen'].map(c=>`<th>${escapeHTML(c)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(r=>`<tr>${[...r.cells,r.citationIds.map(id=>{const c=citations.find(c=>c.id===id);return c?`${c.title}\n${c.urls.join('\n')}`:id;}).join('\n\n')].map(c=>`<td>${escapeHTML(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></html>`;
}

export function answerText(text:string,table?:AnswerTable|null,citations:ExportCitation[]=[]){
  return text+(table?`\n\n${table.title}\n${table.note}\n\n${table.rows.map(r=>r.cells.map((c,i)=>`${table.columns[i]}: ${c}`).join('\n')).join('\n\n')}`:'')+(citations.length?'\n\nSources:\n'+citations.map(c=>`[${c.id}] ${c.title}\n${c.urls.join('\n')}`).join('\n\n'):'');
}

'use client';
import {Download,Maximize2,X} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {type AnswerTable as Table,type ExportCitation,tableCSV,tableHTML} from '@/lib/answer-tables';
import {downloadText} from './ChatFiles';

export function AnswerTable({table,citations=[]}:{table:Table;citations?:ExportCitation[]}){
 const [expanded,setExpanded]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(expanded)dialog.current?.showModal();},[expanded]);
 const filename=table.title.startsWith('KI-Nutzung')?'gradias-ki-schulen-16-bundeslaender':'gradias-tabelle';
 const downloads=<div className="table-downloads"><button className="button" onClick={()=>downloadText(tableCSV(table,citations),filename+'.csv','text/csv;charset=utf-8')}><Download size={15}/>Tabelle herunterladen (CSV)</button><button className="button subtle" onClick={()=>downloadText(tableHTML(table,citations),filename+'.html','text/html;charset=utf-8')}>Druckansicht herunterladen</button></div>;
 const grid=<div className="answer-table-scroll" tabIndex={0} role="region" aria-label="Tabelle, horizontal scrollbar"><table><caption>{table.rows.length} Einträge · horizontal scrollen für alle Spalten</caption><thead><tr>{table.columns.map((c,i)=><th key={i} scope="col">{c}</th>)}</tr></thead><tbody>{table.rows.map((r,i)=><tr key={i}>{r.cells.map((cell,j)=>{const value=/^https?:\/\/\S+$/i.test(cell)?<a href={cell} target="_blank" rel="noreferrer">Quelle öffnen ↗</a>:cell;return j===0?<th key={j} scope="row">{value}</th>:<td key={j}>{value}</td>;})}</tr>)}</tbody></table></div>;
 return <section className="answer-table-section" aria-label={table.title}>
  <h3>{table.title}</h3>
  {downloads}<button className="text-button table-expand" onClick={()=>setExpanded(true)}><Maximize2 size={14}/>Tabelle groß anzeigen</button>
  <details className="table-note"><summary>Recherchestand und Einordnung</summary><p>{table.note}</p></details>
  {!expanded&&grid}
  {expanded&&<dialog className="table-dialog" ref={dialog} onCancel={()=>setExpanded(false)} onClose={()=>setExpanded(false)} aria-label={table.title}><div className="table-dialog-header"><h2>{table.title}</h2><button autoFocus className="icon-button" aria-label="Große Tabellenansicht schließen" onClick={()=>{dialog.current?.close();setExpanded(false);}}><X size={22}/></button></div>{downloads}<p className="table-note">{table.note}</p>{grid}</dialog>}
 </section>;
}

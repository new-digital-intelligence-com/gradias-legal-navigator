import raw from '../data/competitors.json';
export type CompetitorFile={title:string;url:string;path:string;bytes:number;sha256:string;format:string};
export type CompetitorSource={id:string;document:string;source_url:string;status:string;format:string;retrieved:string;startPage:number|null;endPage:number|null;pageRanges:string;original:CompetitorFile|null;converted:CompetitorFile|null};
export type Position={topic:string;summary:string;quote:string;page:number;sourceTitle:string;sourceUrl:string};
export type Competitor={id:string;number:number;name:string;website:string;status:string;note:string;coverage:string;coverageKind:'policies'|'statements'|'links';capturedCount:number;pages:number;bundle:CompetitorFile;sources:CompetitorSource[];files:CompetitorFile[];textUrl:string;positions:Position[];caveat:string};
export type ArchivePage={page:number;text:string;sourceTitle:string;sourceUrl:string};
export const competitorArchive=raw as {captured:string;counts:{competitors:number;capturedDocuments:number;links:number;files:number;pages:number};competitors:Competitor[]};
export const competitors=competitorArchive.competitors;
export const coverageLabels={policies:'Policy collection',statements:'Statements only',links:'Links only'};
export function mentionedCompetitors(text:string){
 const q=text.toLowerCase();
 return competitors.filter(c=>[c.name,c.name.replace(/\s*\([^)]*\)/g,'').replace(/\s+by\s+.+$/i,'')].some(name=>{
  const pattern=name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*');
  return new RegExp('(?:^|[^a-z0-9])'+pattern+'(?:$|[^a-z0-9])').test(q);
 }));
}

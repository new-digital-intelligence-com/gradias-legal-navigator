import raw from '../data/content.json';

export type Block = {type:string;style?:string;text?:string;links?:{label:string;url:string}[];rows?:string[][]};
export type Section={id:string;number:string;title:string;blocks:Block[]};
export type Instrument={id:string;title:string;country:string;type:string;timing:string;timingDetail:string;scope:string;locator:string;urls:string[];note:string};
export type Requirement={id:string;title:string;category:string;cells:{instrumentId:string;value:string;note:string}[]};
export type CountryDoc={id:string;title:string;filename:string;download:string;sha256:string;intro:Block[];sections:Section[]};
export type Source={id:string;title:string;url:string;origins:string[];status:string;download:string|null;countries:string[];historical:boolean};
export type SourceFile={id:string;title:string;filename:string;path:string;url:string;format:string;bytes:number;historical:boolean;category:string;sha256:string};
export type StateGuide={name:string;availability:string;instrument:string;date:string;finding:string;limits:string;locator:string;url:string};
export type Content={meta:{reviewDate:string;spreadsheetUrl:string;revisionView:string;sourceMode:string};categories:string[];instruments:Instrument[];requirements:Requirement[];countryDocs:CountryDoc[];qa:Section[];states:StateGuide[];sources:Source[];documents:SourceFile[];readme:{label:string;text:string}[];uncodedInstruments:{id:string;title:string;scope:string;urls:string[]}[]};
export const content=raw as Content;
export const countryNames:Record<string,string>={de:'Germany',uk:'United Kingdom',us:'United States'};
export const countryKey:Record<string,string>={Germany:'de',UK:'uk',US:'us'};
export const inCountry=(instrument:Instrument,country:string)=>country==='All'||instrument.country.startsWith(country);
export const blockText=(b:Block)=>b.text||b.rows?.map(r=>r.join(' | ')).join('\n')||'';
export const sectionText=(s:Section)=>s.blocks.map(blockText).join('\n\n');
export const safeUrl=(url:string)=>/^https?:\/\//i.test(url)||url.startsWith('/documents/')?url:'#';

export type Passage={id:string;title:string;text:string;tab:'matrix'|'countries'|'qa'|'sources';target:string;country:string;urls:string[]};
export const passages:Passage[]=[
 ...content.qa.map(s=>({id:s.id,title:s.title,text:sectionText(s),tab:'qa' as const,target:s.id,country:'All',urls:s.blocks.flatMap(b=>(b.links||[]).map(l=>l.url))})),
 ...content.countryDocs.flatMap(d=>d.sections.flatMap(s=>s.blocks.filter(b=>blockText(b).length>90).map((b,i)=>({id:`${s.id}-p${i}`,title:`${countryNames[d.id]} · ${s.title}`,text:blockText(b),tab:'countries' as const,target:s.id,country:d.id,urls:s.blocks.flatMap(x=>(x.links||[]).map(l=>l.url))})))),
 ...content.requirements.map(r=>({id:r.id,title:`${r.id} · ${r.title}`,text:r.cells.filter(c=>c.value==='Yes').map(c=>c.note).join('\n\n'),tab:'matrix' as const,target:r.id,country:'All',urls:[]})),
 ...content.states.map((s,i)=>({id:`state-${i}`,title:`${s.name} · official guidance`,text:`${s.finding}\nLimits: ${s.limits}\n${s.date} · ${s.locator}`,tab:'countries' as const,target:`state-${i}`,country:'de',urls:[s.url]})),
 ...content.readme.map((r,i)=>({id:`method-${i}`,title:r.label,text:r.text,tab:'sources' as const,target:'methodology',country:'All',urls:[content.meta.spreadsheetUrl]}))
];
const stop=new Set('a an the is are was were be been being does do did can could would should must may what which how when where why who of in on to for by at and or with from that this these those it its as i me my you your any about show tell please need needs require required requirements ai grading exam school schools use using und der die das von mit für ist ein eine den zu'.split(' '));
export function tokens(s:string):string[]{return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)?.filter(t=>t.length>1&&!stop.has(t)).map(t=>t.replace(/(ing|ed|s)$/,''))||[];}
const index=passages.map(p=>({p,title:tokens(p.title),words:tokens(p.title+' '+p.text)}));
const df=new Map<string,number>(); index.forEach(d=>new Set(d.words).forEach(t=>df.set(t,(df.get(t)||0)+1)));
export function retrieve(question:string,country='All',limit=10):Passage[]{
 const synonyms:Record<string,string>={gdpr:'dsgvo datenschutz grundverordnung',consent:'einwilligung parental',anonymous:'anonymised anonymisation pseudonymisation',anonymized:'anonymisation',approval:'authorisation permission freigabe',permission:'authorisation approval',teacher:'lehrkraft examiner',bias:'discrimination equality',dpa:'processor contract auftragsverarbeitung',subprocessor:'unterauftragnehmer processor llm',germany:'deutschland',uk:'britain united kingdom',us:'ferpa united states',deadline:'timing date commencement',second:'opinion zweimeinung vergleich',nrw:'nordrhein westfalen'};
 const q=question.toLowerCase();const expanded=question+' '+Object.entries(synonyms).filter(([k])=>new RegExp('\\b'+k+'\\b').test(q)).map(([,v])=>v).join(' ');
 const ts=[...new Set(tokens(expanded))];if(!ts.length)return [];
 const filtered=index.filter(d=>country==='All'||d.p.country==='All'||d.p.country===countryKey[country]||d.p.country===country);
 return filtered.map(d=>{let score=0,hits=0;for(const t of ts){const n=d.words.filter(w=>w===t).length;if(n){hits++;score+=Math.log(1+(index.length-(df.get(t)||0)+.5)/((df.get(t)||0)+.5))*n*2.2/(n+1.2*(.25+.75*d.words.length/180));if(d.title.includes(t))score+=3;}}return {p:d.p,score:score*(.5+hits/ts.length)+(d.p.tab==='qa'?1:0),hits};}).filter(x=>x.hits>0&&x.score>2).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.p);
}

export type NavAction={tab:'matrix'|'countries'|'qa'|'sources';country?:string;target?:string;label:string};
export function navigationIntent(q:string):NavAction|null{
 if(!/\b(show|open|go|navigate|take|view|switch|zeige|öffne)\b/i.test(q))return null;
 const country=/german|deutsch/i.test(q)?'Germany':/\buk\b|united kingdom|brit/i.test(q)?'UK':/\bus\b|united states|america/i.test(q)?'US':undefined;
 const tab=/matrix|requirement/i.test(q)?'matrix':/\bqa\b|q&a|question|faq/i.test(q)?'qa':/source|document|link/i.test(q)?'sources':country||/countr/i.test(q)?'countries':null;
 return tab?{tab,country,label:`Open ${country?country+' ':''}${tab==='qa'?'Q&A':tab==='matrix'?'requirements matrix':tab==='countries'?'country view':'sources'}`} : null;
}

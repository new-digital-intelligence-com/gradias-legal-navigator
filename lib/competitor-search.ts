// Server-only page corpus: do not import this module from client components.
import raw from '../data/competitor-search.json';
import {competitors,mentionedCompetitors} from './competitors';
import {tokens,type Passage} from './content';
const rows=raw as {id:string;competitorId:string;name:string;page:number;text:string;sourceTitle:string;sourceUrl:string}[];
const index=rows.map(r=>{const words=tokens(r.text);const counts=new Map<string,number>();for(const w of words)counts.set(w,(counts.get(w)||0)+1);return {r,counts,length:words.length};});
export function retrieveCompetitor(question:string,selectedId?:string,limit=12):Passage[]{
 const named=mentionedCompetitors(question);const ids=new Set(named.length?named.map(c=>c.id):selectedId?[selectedId]:competitors.map(c=>c.id));
 const q=tokens(question+' '+(/training|train|models?/i.test(question)?'training train model':'')+' '+(/data protection|gdpr/i.test(question)?'personal privacy processor controller':''));
 const scored=index.filter(d=>ids.has(d.r.competitorId)).map(d=>({r:d.r,score:q.reduce((score,t)=>score+(d.counts.has(t)?Math.min(d.counts.get(t)!,5)/(1+d.length/900):0),0)})).filter(d=>d.score>0).sort((a,b)=>b.score-a.score);
 const groups=named.map(c=>scored.filter(d=>d.r.competitorId===c.id));
 const chosen=named.length>1?Array.from({length:Math.ceil(limit/named.length)},(_,i)=>groups.flatMap(g=>g[i]?[g[i]]:[])).flat().slice(0,limit):scored.slice(0,limit);
 return chosen.map(({r})=>{
  const company=competitors.find(c=>c.id===r.competitorId)!;
  const focused=company.positions.filter(p=>p.page===r.page).map(p=>({p,score:tokens(p.topic).filter(t=>q.includes(t)).length})).filter(p=>p.score>0).sort((a,b)=>b.score-a.score)[0]?.p;
  const excerpt=focused?`Relevant archived excerpt:\n${focused.quote}\n\n`:'';
  const scope=company.caveat?`Scope note: ${company.caveat}\n\n`:'';
  return {id:r.id,title:`${r.name} · ${r.sourceTitle} · p. ${r.page}`,text:`Captured vendor statement (10 October 2026); not an independent compliance finding.\n\n${excerpt}${scope}${r.text}`,tab:'competitors',target:r.id,country:'All',urls:r.sourceUrl?[r.sourceUrl]:[]};
 });
}

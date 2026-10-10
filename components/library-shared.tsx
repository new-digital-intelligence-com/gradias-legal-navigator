'use client';
import {ExternalLink} from 'lucide-react';
import {safeUrl,type Block} from '@/lib/content';
export const labels:Record<string,string>={All:'All jurisdictions',Germany:'Germany',UK:'United Kingdom',US:'United States'};
export function Flag({country}:{country:string}){return <span className={'flag flag-'+country} aria-hidden="true">{country==='Germany'?'DE':country==='UK'?'UK':'US'}</span>;}
export function SourceLink({href,children}:{href:string;children:React.ReactNode}){return <a href={safeUrl(href)} target="_blank" rel="noreferrer noopener">{children}<ExternalLink size={12}/></a>;}
export function Blocks({blocks}:{blocks:Block[]}){return <div className="document-prose">{blocks.map((b,i)=>{
 if(b.type==='table')return <div className="prose-table" key={i}><table><tbody>{b.rows?.map((r,j)=><tr key={j}>{r.map((c,k)=>j===0?<th key={k}>{c}</th>:<td key={k}>{c}</td>)}</tr>)}</tbody></table></div>;
 if(b.style?.startsWith('Heading'))return <h3 key={i}>{b.text}</h3>;
 const links=b.links||[];const linkOnly=links.length>0&&b.text===links.map(l=>l.label).join('');
 return <div key={i}>{!linkOnly&&<p>{b.text}</p>}{links.length>0&&<div className="inline-sources">{links.map((l,j)=><SourceLink href={l.url} key={j}>{l.label||'Primary source'}</SourceLink>)}</div>}</div>;
})}</div>;}


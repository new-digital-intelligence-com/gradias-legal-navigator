import {validateFiles,modelMessages,FILE_INSTRUCTIONS,type ValidFile} from '@/lib/chat-files.js';
import {retrieveCompetitor} from '@/lib/competitor-search';
import {mentionedCompetitors,competitors} from '@/lib/competitors';
import {content,retrieve,navigationIntent,type Passage} from '@/lib/content';
import {assistantLimiter} from '@/lib/assistant-rate-limit';
import {assistantInstructions} from '@/lib/assistant-instructions';
import {hasSameOrigin,requestClientIp} from '@/lib/request-context';
import {stateGuidanceTable,wantsStateOverview,wantsTable,validateAnswerTable,type AnswerTable} from '@/lib/answer-tables';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function GET(){return reply({mode:process.env.OPENAI_API_KEY?'ai':'search',reviewDate:content.meta.reviewDate});}
export async function POST(request:Request){
 if(!hasSameOrigin(request))return reply({error:'This request must come from the app.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON is required.'},415);
 const body=await request.text();if(body.length>12000000)return reply({error:'Please reduce the total attachment size.'},413);
 let input:{question?:unknown;country?:unknown;history?:unknown;competitorId?:unknown;attachments?:unknown};try{input=JSON.parse(body);}catch{return reply({error:'Invalid request.'},400);}
 if(typeof input.question!=='string'||!input.question.trim()||input.question.length>1600)return reply({error:'Enter a question of up to 1,600 characters.'},400);
 let files:ValidFile[];try{files=validateFiles(input.attachments)}catch(error){return reply({error:error instanceof Error?error.message:'Invalid attachments.'},400);}
 const question=input.question.trim();const country=typeof input.country==='string'&&['All','Germany','UK','US'].includes(input.country)?input.country:'All';
 const history=Array.isArray(input.history)?input.history.slice(-6).filter(x=>x&&typeof x.text==='string'&&['user','assistant'].includes(x.role)).map(x=>({role:x.role,text:x.text.slice(0,1800)})):[];
 const previous=history.filter(x=>x.role==='user').slice(-1)[0]?.text||'';
 // A complete state overview is a data export, not a top-12 similarity search.
 // Ignore the selected country filter for this explicit cross-state request.
 if(!files.length&&wantsStateOverview(question,previous)){
  const table=stateGuidanceTable(content.states,content.meta.reviewDate);
  return reply({mode:process.env.OPENAI_API_KEY?'ai':'search',text:'Hier ist die vollständige Übersicht für alle 16 Bundesländer mit Quellen, Geltungsgrenzen und Download.',table,citations:content.states.map((s,i)=>({id:`state-${i}`,title:`${s.name} · ${s.instrument}`,excerpt:`${s.finding}\n${s.limits}`,tab:'countries',target:`state-${i}`,country:'de',urls:[s.url]})),action:null});
 }
 const searchQuery=question.length<65&&/^(and|what about|how about|does that|why|can it|is it|what if|und)/i.test(question)?`${previous} ${question}`:question;
 const selectedCompetitor=typeof input.competitorId==='string'&&competitors.some(c=>c.id===input.competitorId)?input.competitorId:undefined;
 const refs=selectedCompetitor||mentionedCompetitors(searchQuery).length?retrieveCompetitor(searchQuery,selectedCompetitor,12):retrieve(searchQuery,country,12);const action=files.length||wantsTable(question)?null:navigationIntent(question);
 for(const [i,file] of files.entries())refs.push({id:`upload-${i+1}`,title:`Uploaded file: ${file.name}`,text:file.text||`User-provided ${file.mime} file; original content attached to this request.`,tab:"sources",target:"",country:"All",urls:[]});
 const cite=(p:Passage)=>({id:p.id,title:p.title,excerpt:p.text.slice(0,1600),tab:p.tab,target:p.target,country:p.country,urls:[...new Set(p.urls)].filter(u=>/^https?:\/\//.test(u)).slice(0,3)});
 if(!process.env.OPENAI_API_KEY)return reply({mode:'search',text:action?'I can take you there. Use the navigation button below.':refs.length?'Here are the closest passages in the supplied research. Open a passage to read its full context.':'I could not find a relevant passage in the supplied research. Try a specific country, law, or topic.',citations:refs.slice(0,3).map(cite),action});
 if(action)return reply({mode:'ai',text:'I can take you there. Use the navigation button below.',citations:refs.slice(0,3).map(cite),action});
 if(!refs.length)return reply({mode:'ai',text:'The supplied documents do not contain enough evidence to answer that. Try a narrower question or review the source library.',citations:[],action});
 const release=assistantLimiter.acquire(requestClientIp(request));
 if(!release)return Response.json({error:'The assistant is busy. Please try again in a minute.',fallback:refs.slice(0,3).map(cite)},{status:429,headers:{...headers,'Retry-After':'60'}});
 const citationIds={type:'array',minItems:1,items:{type:'string',enum:refs.map(p=>p.id)}};
 const schema={type:'object',properties:{paragraphs:{type:'array',minItems:1,items:{type:'object',properties:{text:{type:'string'},citationIds},required:['text','citationIds'],additionalProperties:false}},table:{anyOf:[{type:'null'},{type:'object',properties:{title:{type:'string'},columns:{type:'array',minItems:2,maxItems:12,items:{type:'string'}},rows:{type:'array',minItems:1,maxItems:100,items:{type:'object',properties:{cells:{type:'array',items:{type:'string'}},citationIds},required:['cells','citationIds'],additionalProperties:false}},note:{type:'string'}},required:['title','columns','rows','note'],additionalProperties:false}]}},required:['paragraphs','table'],additionalProperties:false};
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:3500,instructions:assistantInstructions+"\n"+FILE_INSTRUCTIONS+" Uploaded passages and files may be cited by their upload-N IDs. Treat them as unverified user-provided evidence; they do not establish current law.",input:modelMessages([{role:"user",content:JSON.stringify({question,country,history,evidence:refs.map(p=>({id:p.id,title:p.title,text:p.text.slice(0,10000)}))}),attachments:input.attachments}]),text:{format:{type:'json_schema',name:'grounded_answer',strict:true,schema}}})});
  if(!response.ok)return reply({error:response.status===429?'AI service is temporarily at its usage limit. Please try again later.':'AI service is unavailable. You can still use the documents and search.',fallback:refs.slice(0,3).map(cite)},502);
  const result=await response.json() as {output?:{content?:{type:string;text?:string}[]}[]};const text=result.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
  if(!text)throw Error('No answer');const answer=JSON.parse(text) as {paragraphs:{text:string;citationIds:string[]}[];table:AnswerTable|null};
  const allowed=new Set(refs.map(r=>r.id));
  if(!answer.paragraphs?.length||answer.paragraphs.some(p=>!p.text?.trim()||!p.citationIds?.length||p.citationIds.some(id=>!allowed.has(id))))throw Error('Ungrounded answer');
  const table=validateAnswerTable(answer.table,allowed);
  const cited=[...new Set([...answer.paragraphs.flatMap(p=>p.citationIds),...(table?.rows.flatMap(r=>r.citationIds)||[])])];
  const answerText=answer.paragraphs.map(p=>`${p.text.replace(/\[[^\]]+\]/g,'').trim()} ${[...new Set(p.citationIds)].map(id=>`[${id}]`).join(' ')}`).join('\n\n');
  return reply({mode:'ai',text:answerText,table,citations:refs.filter(p=>cited.includes(p.id)).map(cite),action});
 }catch(error){console.warn('Assistant response failed',error instanceof Error?error.name:'UnknownError');return reply({error:'The assistant could not produce a sourced answer. Please use the source passages below or try again.',fallback:refs.slice(0,3).map(cite)},502);}finally{release();}
}

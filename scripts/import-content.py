"""Import the supplied research without changing its legal meaning.
Usage: python scripts/import-content.py SOURCE_FOLDER EXTRACTED_FOLDER
The extracted folder contains sheets.json and final-revision documents.json.
"""
from pathlib import Path
import json, sys, shutil, re, hashlib

root=Path(sys.argv[1]); extracted=Path(sys.argv[2]); project=Path(__file__).resolve().parent.parent
dest=project/'public/documents'; dest.mkdir(parents=True,exist_ok=True)
data=project/'data'; data.mkdir(exist_ok=True)
sheet=json.loads((extracted/'sheets.json').read_text(encoding='utf-8'))
docs=json.loads((extracted/'documents.json').read_text(encoding='utf-8'))
sheets={s['properties']['title']:s['data'][0]['rowData'] for s in sheet['sheets']}
def vals(row): return [c.get('formattedValue','') for c in row.get('values',[])]
matrix=sheets['Requirements matrix']; headers=[vals(r) for r in matrix[:6]]
instruments=[]
register={vals(r)[0]:vals(r) for r in sheets['Instrument register'][1:] if vals(r) and vals(r)[0]}
for col in range(1,98):
    ident,title=headers[1][col].split(' | ',1); r=register[ident]
    instruments.append({'id':ident,'title':title,'country':headers[0][col],'type':headers[2][col],'timing':headers[3][col],'timingDetail':r[6],'scope':r[5],'locator':r[4],'urls':r[7].splitlines(),'note':matrix[3]['values'][col].get('note','')})
categories=[('Authority & consent',[1,2,3,4,5,6,51]),('Data & privacy',[7,8,9,10,11,12,19,23,24,29,35,43,49,50,53,56]),('Assessment & fairness',[13,14,15,16,17,18,20,21,22,52,60]),('Contracts & governance',[25,26,27,28,30,31,32,33,34,44,45,46,47,48,55,57,58]),('AI obligations',[36,37,38,39,40,41,42,54,59])]
requirements=[]
for row in matrix[6:]:
    v=vals(row); ident,title=v[0].split(' | ',1); n=int(ident[1:])
    cells=[{'instrumentId':instruments[i-1]['id'],'value':v[i],'note':row['values'][i].get('note','')} for i in range(1,98)]
    requirements.append({'id':ident,'title':title,'category':next(name for name,ids in categories if n in ids),'cells':cells})

documents=[]; filename_map={}
for path in sorted(root.rglob('*')):
    if not path.is_file() or 'Gradias Legal Navigator App' in path.parts or path.suffix.lower() not in ['.docx','.pptx','.pdf','.html']: continue
    # Separate competitor website crawl is outside this legal-requirements snapshot.
    if any(p.startswith('Website privacy archive -') for p in path.parts): continue
    rel=path.relative_to(root).as_posix(); short=hashlib.sha256(rel.encode()).hexdigest()[:10]+'-'+re.sub(r'[^a-zA-Z0-9._-]','-',path.name)
    shutil.copy2(path,dest/short); href='/documents/'+short; filename_map[rel]=href
    documents.append({'id':'file-'+hashlib.sha256(rel.encode()).hexdigest()[:10],'title':path.stem,'filename':path.name,'path':rel,'url':href,'format':path.suffix[1:].upper(),'bytes':path.stat().st_size,'historical':rel.startswith('Archiv/'),'category':'Archive' if rel.startswith('Archiv/') else 'Country research' if path.parent==root else 'Primary sources' if path.suffix.lower()=='.pdf' else 'Supporting documents','sha256':hashlib.sha256(path.read_bytes()).hexdigest()})

countrydocs=[]; qa=[]
for d in docs:
    sections=[]; section=None; intro=[]
    for b in d['blocks']:
        if b['type']=='paragraph' and b['style'].startswith('Heading1'):
            label=b['text']; num=re.match(r'^(\d+[a-z]?)\s+',label)
            sid=num[1] if num else str(len(sections)+1)
            base=d['id']+'-'+sid; unique=base; suffix=2
            while any(s['id']==unique for s in sections): unique=base+'-'+str(suffix); suffix+=1
            section={'id':unique,'number':sid,'title':label[num.end():] if num else label,'blocks':[]};sections.append(section)
        elif section: section['blocks'].append(b)
        else: intro.append(b)
    entry={'id':d['id'],'title':next((b['text'] for b in intro if b.get('style')=='Title'),d['filename']),'filename':d['filename'],'download':filename_map[d['filename']],'sha256':d['sha256'],'intro':intro,'sections':sections}
    if d['id']=='qa': qa=sections
    else: countrydocs.append(entry)

manifest=json.loads((root/'Data Privacy Research/Sources/Research_2026-10-10/source_manifest.json').read_text(encoding='utf-8-sig'))
sources=[]
for s in manifest:
    local=s.get('local_file','').replace('\\','/')
    match=next((url for rel,url in filename_map.items() if local and (local.endswith(rel) or rel.endswith(local) or Path(rel).name==Path(local).name)),None)
    origins=s.get('origins',[])
    sources.append({'id':s['source_id'],'title':s['title'],'url':s['url'],'origins':origins,'status':s['status'],'download':match,'countries':list(dict.fromkeys('Germany' if re.match(r'^(DE-|G-)',o) or 'Germany' in o else 'UK' if o.startswith('UK-') or 'UK.docx' in o else 'US' if o.startswith('US-') or 'US.docx' in o else 'Cross-country' for o in origins)),'historical':not any(re.match(r'^(DE-|UK-|US-|G-)',o) or (not o.startswith('Archiv') and 'AI Exam Grading' in o) for o in origins)})

states=[]
for row in sheets['German states'][1:]:
    v=vals(row)
    if v: states.append(dict(zip(['name','availability','instrument','date','finding','limits','locator','url'],v)))
result={'meta':{'title':'Gradias Legal Navigator','reviewDate':'2026-10-10','spreadsheetUrl':sheet['spreadsheetUrl'],'countries':['Germany','UK','US'],'sourceMode':'Imported research snapshot; not a live legal update service.','revisionView':'Final text includes tracked insertions and excludes tracked deletions. Original files retain tracked changes.'},'categories':[c[0] for c in categories],'instruments':instruments,'requirements':requirements,'countryDocs':countrydocs,'qa':qa,'states':states,'sources':sources,'documents':documents,'readme':[{'label':vals(r)[0],'text':vals(r)[1]} for r in sheets['Read me'] if len(vals(r))>1],'uncodedInstruments':[{'id':k,'title':v[2],'scope':v[5],'urls':v[7].splitlines()} for k,v in register.items() if k not in [i['id'] for i in instruments]]}
(data/'content.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(data/'provenance.json').write_text(json.dumps({'importDate':'2026-10-10','spreadsheetId':sheet['spreadsheetId'],'documents':[{'filename':d['filename'],'sha256':d['sha256']} for d in docs],'counts':{k:len(result[k]) for k in ['requirements','instruments','qa','states','sources','documents']}},indent=2),encoding='utf-8')
shutil.copy2(extracted/'sheets.json',data/'spreadsheet-snapshot.json')
shutil.copy2(extracted/'documents.json',data/'document-snapshot.json')
print(json.dumps({k:len(result[k]) for k in ['requirements','instruments','qa','states','sources','documents']}))

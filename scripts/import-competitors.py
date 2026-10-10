"""Import the supplied competitor archive, preserving documents and page provenance.
Usage: python scripts/import-competitors.py ARCHIVE_FOLDER [POSITION_SUMMARIES_JSON]
Requires pypdf. Does not fetch or update vendor websites.
"""
from pathlib import Path
from pypdf import PdfReader
import hashlib,json,re,shutil,sys

root=Path(sys.argv[1]).resolve(); project=Path(__file__).resolve().parent.parent
public=project/'public/competitors';public.mkdir(parents=True,exist_ok=True)
data=project/'data';data.mkdir(exist_ok=True)
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
coverage=read(root/'Competitor coverage.json'); manifest=read(root/'Source manifest.json')
positions={p['competitorId']:p for p in read(Path(sys.argv[2]))} if len(sys.argv)>2 else {}
catalog=[];search=[];files=[]
for comp in coverage:
    ident=f"competitor-{comp['id']:02d}";folder=public/f"{comp['id']:02d}";folder.mkdir(exist_ok=True)
    sources=[dict(s) for s in manifest if s['competitor_id']==comp['id']]
    downloads={}
    for path in sorted((root/comp['folder']).rglob('*')):
        if not path.is_file() or path.suffix.lower() not in ['.pdf','.docx']:continue
        rel=path.relative_to(root).as_posix();name=hashlib.sha256(rel.encode()).hexdigest()[:10]+path.suffix.lower()
        destination=folder/name;shutil.copy2(path,destination)
        f={'title':path.name,'url':f"/competitors/{comp['id']:02d}/{name}",'path':rel,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'format':path.suffix[1:].upper()}
        downloads[rel]=f;files.append(f)
    bundle=downloads[comp['pdf']];assert bundle['sha256']==comp['pdf_sha256']
    for i,s in enumerate(sources):
        s['id']=f'{ident}-source-{i+1}';s['startPage']=None;s['endPage']=None;s['pageNumbers']=[];s['pageRanges']=''
        s['original']=downloads.get(s.get('original_file',''));s['converted']=downloads.get(s.get('converted_pdf',''))
        if s['original']:assert s['original']['sha256']==s['source_sha256']
    pages=[];active=None
    for n,page in enumerate(PdfReader(root/comp['pdf']).pages,1):
        raw=page.extract_text() or ''
        lines=raw.splitlines()
        if lines and lines[0].startswith('GRADIAS | Competitor privacy source archive'):lines=lines[1:]
        if lines and lines[0].strip()==str(n):lines=lines[1:]
        text='\n'.join(lines).replace('\x00','•').strip()
        match=re.search(r'(?m)^(\d{2})\s*\|',text[:600])
        if match and 0<int(match[1])<=len(sources):
            active=sources[int(match[1])-1]
            if active['startPage'] is None:active['startPage']=n
        if active:active['endPage']=n;active['pageNumbers'].append(n)
        record={'page':n,'text':text,'sourceTitle':active['document'] if active else 'Archive coverage and source list','sourceUrl':active['source_url'] if active else ''}
        pages.append(record)
        if n>1 and text and comp['id']!=54:
            search.append({'id':f'{ident}-p{n}','competitorId':ident,'name':comp['name'],**record})
    assert len(pages)==comp['pages']
    for source in sources:
        ranges=[]
        for n in source['pageNumbers']:
            if ranges and n==ranges[-1][1]+1:ranges[-1][1]=n
            else:ranges.append([n,n])
        source['pageRanges']=', '.join(str(a) if a==b else f'{a}–{b}' for a,b in ranges)
    (public/f"{comp['id']:02d}.json").write_text(json.dumps({'id':ident,'pages':pages},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    kind='links' if comp['id']==54 else 'statements' if comp['id'] in [32,41] else 'policies'
    catalog.append({'id':ident,'number':comp['id'],'name':comp['name'],'website':comp['website'].get('hyperlink') or comp['website'].get('formattedValue',''),'status':comp['status'],'note':comp['note'],'coverage':comp['coverage'],'coverageKind':kind,'capturedCount':comp['captured_count'],'pages':len(pages),'bundle':bundle,'sources':sources,'files':list(downloads.values()),'textUrl':f"/competitors/{comp['id']:02d}.json",'positions':positions.get(comp['id'],{}).get('positions',[]),'caveat':positions.get(comp['id'],{}).get('caveat','')})
for name in ['Competitor coverage.json','Source manifest.json','Verification.json','Read me.txt']:
    shutil.copy2(root/name,data/('competitor-'+name.lower().replace(' ','-')))
result={'captured':'2026-10-10','counts':{'competitors':len(catalog),'capturedDocuments':sum(s['status']=='Captured' for s in manifest),'links':len(manifest),'files':len(files),'pages':sum(c['pages'] for c in catalog)},'competitors':catalog}
(data/'competitors.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(data/'competitor-search.json').write_text(json.dumps(search,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(result['counts']))

from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E
import json, re, hashlib, sys

root=Path(sys.argv[1])
out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True)
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def text(el):
    return ''.join(x.text or '' for x in el.iter() if x.tag==f"{{{ns['w']}}}t")
docs=[]
for path in root.glob('*.docx'):
    key='qa' if 'Questions Answers' in path.name else ('de' if 'Germany' in path.name else 'uk' if 'UK' in path.name else 'us')
    with ZipFile(path) as z:
        xml=E.fromstring(z.read('word/document.xml'))
        # Show final revision: retain insertions, exclude deleted paragraphs/text.
        for parent in xml.iter():
            for c in list(parent):
                if c.tag in [f"{{{ns['w']}}}del",f"{{{ns['w']}}}moveFrom"]: parent.remove(c)
        rels={r.attrib['Id']:r.attrib.get('Target','') for r in E.fromstring(z.read('word/_rels/document.xml.rels'))}
        body=xml.find('w:body',ns); blocks=[]
        for el in body:
            if el.tag.endswith('}p'):
                s=el.find('w:pPr/w:pStyle',ns)
                style=s.attrib.get(f"{{{ns['w']}}}val",'') if s is not None else ''
                t=text(el)
                links=[{'label':text(h),'url':rels.get(h.attrib.get(f"{{{ns['r']}}}id"),'')} for h in el.findall('.//w:hyperlink',ns)]
                if t.strip(): blocks.append({'type':'paragraph','style':style,'text':t,'links':links})
            elif el.tag.endswith('}tbl'):
                rows=[[text(c) for c in row.findall('w:tc',ns)] for row in el.findall('w:tr',ns)]
                blocks.append({'type':'table','rows':rows})
        doc={'id':key,'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'blocks':blocks,'links':sorted(set(u for u in rels.values() if u.startswith('http')))}
        docs.append(doc)
        (out/f'{key}.txt').write_text('\n\n'.join((f"[{b['style']}] {b['text']}" if b['type']=='paragraph' else '\n'.join(' | '.join(r) for r in b['rows'])) for b in blocks),encoding='utf-8')
(out/'documents.json').write_text(json.dumps(docs,ensure_ascii=False,indent=2),encoding='utf-8')
manifest=json.loads((root/'Data Privacy Research/Sources/Research_2026-10-10/source_manifest.json').read_text(encoding='utf-8-sig'))
(out/'manifest-shape.txt').write_text(str(type(manifest))+'\n'+json.dumps(manifest[:2] if isinstance(manifest,list) else {k:(v[:2] if isinstance(v,list) else v) for k,v in manifest.items()},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'id':d['id'],'blocks':len(d['blocks']),'links':len(d['links'])} for d in docs]))


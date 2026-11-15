"""Check every recording by ear, with speech recognition: check.py clipsdir"""
import json, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asr import transcribe
import soundfile as sf
out=sys.argv[1]
man=json.load(open(f'{out}/manifest.json'))
def words(t): return re.sub(r'[^а-яё ]',' ',t.lower().replace('+','').replace('ё','е')).split()
import difflib
import os
prev={}
if os.path.exists(f'{out}/check.json'):
    prev={(r['id'],r['say']):r for r in json.load(open(f'{out}/check.json'))}
res=[]
for u in man:
    p=f"{out}/{u['id']}.wav"
    if (u['id'],u['say']) in prev:
        res.append(prev[(u['id'],u['say'])]); continue
    hyp=transcribe(p)
    a=words(u['say']); b=words(hyp)
    sm=difflib.SequenceMatcher(None,a,b)
    errs=sum(max(i2-i1,j2-j1) for op,i1,i2,j1,j2 in sm.get_opcodes() if op!='equal')
    info=sf.info(p)
    syl=len(re.findall(r'[аеёиоуыэюя]',u['say'].lower()))
    res.append({'id':u['id'],'say':u['say'],'hyp':hyp,'err':errs,'n':len(a),'dur':round(info.duration,2),'sps':round(syl/max(info.duration,0.1),2)})
json.dump(res,open(f'{out}/check.json','w'),ensure_ascii=False,indent=0)
tot=sum(r['n'] for r in res); e=sum(r['err'] for r in res)
print('WER', round(e/tot*100,2), 'clips with errors', sum(1 for r in res if r['err']))

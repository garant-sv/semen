"""Longest pause inside each recording: silences.py clipsdir"""
import json, sys, numpy as np, soundfile as sf
OUT = sys.argv[1]
man=json.load(open(OUT + '/manifest.json'))
out=[]
for u in man:
    a,sr=sf.read(f"{OUT}/{u['id']}.wav")
    fr=int(0.02*sr); n=len(a)//fr
    e=np.sqrt((a[:n*fr].reshape(n,fr)**2).mean(1))
    quiet=e<0.004
    # longest internal quiet run
    best=cur=0
    for q in quiet[3:-3]:
        cur=cur+1 if q else 0; best=max(best,cur)
    out.append((best*0.02, u['say']))
out.sort(reverse=True)
for x in out[:12]: print(round(x[0],2), x[1][:90])

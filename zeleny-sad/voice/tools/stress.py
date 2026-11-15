"""Put stress marks on every phrase for review: stress.py phrases.json out.json"""
import json, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from norm import spell
from silero_stress import load_accentor
acc = load_accentor()
units = json.load(open(sys.argv[1]))
out = []
for u in units:
    s = spell(u['text'])
    out.append({**u, 'say': s, 'stressed': acc(s)})
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)

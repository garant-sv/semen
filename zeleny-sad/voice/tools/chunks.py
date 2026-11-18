"""Pieces that are not recorded whole (the fair of the 4th–5th class: thousands of different numbers)
are said from shorter recorded chunks: the words around a number, and the number itself in parts
(«равно | двум тысячам | трёмстам | сорока пяти»). About a thousand chunks cover every problem.

Usage: chunks.py all.json young.json chunks.json seq.json
  all.json, young.json — from scripts/voice-phrases.ts (with and without --young);
  chunks.json — the chunks to record (input for gen.py, together with young.json);
  seq.json — piece key → its chunk keys (for pack.py).
"""
import json, sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from norm import spell, num

NUMERAL = {w for n in range(10000) for c in ('nom', 'acc', 'gen', 'dat', 'prep') for g in 'mfn' for w in num(n, c, g).split()}
HUNDREDS = {w for h in range(1, 10) for c in ('nom', 'gen', 'dat', 'prep') for w in [num(h * 100, c)] if ' ' not in w}
PUNCT = '.,;:!?—…'


def core(w: str) -> str:
    return w.strip(PUNCT).lower()


def chunk_key(text: str) -> str:
    return '§' + re.sub(r'\s+', ' ', text.lower().replace('ё', 'е')).strip()


def split(said: str) -> list[str]:
    groups, text, run = [], [], []

    def close_run():
        part = []
        for w in run:
            part.append(w)
            if core(w).startswith('тысяч'):
                groups.append(' '.join(part))
                part = []
        if len(part) > 1 and core(part[0]) in HUNDREDS:
            groups.append(part.pop(0))
        if part:
            groups.append(' '.join(part))
        run.clear()

    for w in said.split():
        if core(w) in NUMERAL and core(w):
            if text:
                groups.append(' '.join(text))
                text = []
            run.append(w)
            if w[-1] in PUNCT and w[-1] != '—':
                close_run()
        else:
            if run:
                close_run()
            text.append(w)
    if run:
        close_run()
    if text:
        groups.append(' '.join(text))
    # A part of a number inside the piece is said as going on (a comma: «две тысячи, | семьсот»),
    # the last chunk as the piece ends. Words before a number («равно», «Возьму») stay as they are.
    def going_on(i, g):
        return i < len(groups) - 1 and g[-1] not in PUNCT and core(g.split()[-1]) in NUMERAL and core(groups[i + 1].split()[0]) in NUMERAL
    return [g + ',' if going_on(i, g) else g for i, g in enumerate(groups)]


if __name__ == '__main__':
    every, young, out_chunks, out_seq = sys.argv[1:5]
    whole = {u['key'] for u in json.load(open(young))}
    chunks, seq = {}, {}
    for u in json.load(open(every)):
        if u['key'] in whole:
            continue
        keys = []
        for g in split(spell(u['text'])):
            k = chunk_key(g)
            chunks.setdefault(k, {'key': k, 'text': g, 'grade': u['grade'], 'kind': 'chunk'})
            keys.append(k)
        seq[u['key']] = keys
    json.dump(list(chunks.values()), open(out_chunks, 'w'), ensure_ascii=False, indent=0)
    json.dump(seq, open(out_seq, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(seq), 'pieces from', len(chunks), 'chunks')

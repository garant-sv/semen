"""Record every piece with Silero v5.6 (xenia), trim, level, save as wav. Usage: gen.py phrases.json outdir"""
import json, sys, re, hashlib, os
import numpy as np, torch, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from norm import spell

torch.set_num_threads(4)
SR = 48000
SPEAKER = os.environ.get('SPEAKER', 'xenia')
FORCE = os.environ.get('FORCE', '')

# Stress fixes found when checking every word (silero-stress puts these wrong in this game's texts).
FIX = [
    (r'\bклеит\b', 'кле+ит'), (r'\bклеить\b', 'кле+ить'),
    (r'\bполюсами\b', 'п+олюсами'),
    (r'\b([Рр])аздели\b', r'\1аздел+и'),
    (r'\bПокупка стоит\b', 'Покупка ст+оит'),
    (r'\b([Рр])авно\b', r'\1авн+о'),
    (r'\b([Сс])орок\b', r'\1+орок'),
    (r'\bДорога —', 'Дор+ога —'),
    (r'\bВорона — словарное', 'Вор+она — словарное'),
]


def fix(text: str) -> str:
    for a, b in FIX:
        text = re.sub(a, b, text)
    return text


def clip_id(key: str) -> str:
    return hashlib.sha1(key.encode()).hexdigest()[:12]


MAX_PAUSE = 0.32  # s: the model pauses up to a second after a colon; children found it slow


def shorten_pauses(a: np.ndarray) -> np.ndarray:
    fr = int(0.01 * SR)
    n = len(a) // fr
    e = np.sqrt((a[:n * fr].reshape(n, fr) ** 2).mean(1))
    quiet = e < 0.004
    keep = int(MAX_PAUSE / 0.01)
    parts, i, last = [], 0, 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if j - i > keep and i > 0 and j < n:
                # Keep the start and the end of the silence, cut its middle.
                cut_from = (i + keep // 2) * fr
                cut_to = (j - keep // 2) * fr
                parts.append(a[last:cut_from])
                last = cut_to
            i = j
        else:
            i += 1
    parts.append(a[last:])
    return np.concatenate(parts)


def finish(a: np.ndarray) -> np.ndarray:
    # Trim silence at the edges (keep 40 ms), level to the same loudness, soft fade.
    thr = 10 ** (-40 / 20) * np.abs(a).max()
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx):
        pad = int(0.04 * SR)
        a = a[max(0, idx[0] - pad): min(len(a), idx[-1] + pad)]
    rms = np.sqrt(np.mean(a ** 2)) + 1e-9
    a = a * (0.08 / rms)
    peak = np.abs(a).max()
    if peak > 0.95:
        a = a * (0.95 / peak)
    a = shorten_pauses(a)
    f = int(0.01 * SR)
    a[:f] *= np.linspace(0, 1, f)
    a[-f:] *= np.linspace(1, 0, f)
    return a.astype(np.float32)


if __name__ == '__main__':
    units = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    m = torch.package.PackageImporter(os.environ.get('SILERO_MODEL', 'v5_6_ru.pt')).load_pickle('tts_models', 'model')
    manifest = []
    old = {}
    if os.path.exists(f'{out}/manifest.json'):
        old = {x['id']: x['say'] for x in json.load(open(f'{out}/manifest.json'))}
    for i, u in enumerate(units):
        say = fix(spell(u['text']))
        cid = clip_id(u['key'])
        path = f'{out}/{cid}.wav'
        if not os.path.exists(path) or old.get(cid) != say or (FORCE and FORCE in say):
            # «окончание ет»: the model would read it «ёт» if it put ё by itself.
            yo = not re.search(r'окончание (ет|ит)', say)
            a = m.apply_tts(text=say, speaker=SPEAKER, sample_rate=SR, put_yo=yo).numpy()
            sf.write(path, finish(a), SR)
        manifest.append({**u, 'say': say, 'id': cid})
        if i % 200 == 0:
            print(i, len(units), flush=True)
    json.dump(manifest, open(f'{out}/manifest.json', 'w'), ensure_ascii=False, indent=0)

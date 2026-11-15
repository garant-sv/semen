"""Record every piece, trim, level, save as wav. Usage: gen.py phrases.json outdir

ENGINE=vosk (default): Vosk TTS ru 0.10 multi (VOSK_MODEL=folder of the model), voice SPEAKER_ID (1).
ENGINE=silero: Silero v5.6 (SILERO_MODEL=v5_6_ru.pt), voice SPEAKER (xenia).
"""
import json, sys, re, hashlib, os, collections
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from norm import spell

ENGINE = os.environ.get('ENGINE', 'vosk')
SR = 22050 if ENGINE == 'vosk' else 48000
SPEAKER = os.environ.get('SPEAKER', 'xenia')
SPEAKER_ID = int(os.environ.get('SPEAKER_ID', '1'))
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
    # silero-stress errors found when comparing it with the Vosk dictionary:
    (r'\bтрёмстам\b', 'трёмст+ам'),
    (r'\bГости сада\b', 'Г+ости сада'),
    (r'\bязык и губы\b', 'язык и г+убы'),
    (r'\bо степи\b', 'о ст+епи'), (r'\bо ночи\b', 'о н+очи'),
    (r'\b([Сс])олит\b', r'\1ол+ит'),
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


VOWELS = 'аеёиоуыэюя'


class Vosk:
    """Vosk reads words from its dictionary, which has no context: «равно», «стоит», «часа» get one
    stress everywhere, and a few words are wrong in it (создАют, полИвай). So silero-stress (MIT) puts the
    stress in context, and every word of two syllables or more is read with the dictionary variant that
    has that stress (keeping its exceptions like «что» = што), or by the rules if there is none."""

    def __init__(self):
        from vosk_tts import Model, Synth
        from silero_stress import load_accentor
        path = os.environ.get('VOSK_MODEL', 'vosk-model-tts-ru-0.10-multi')
        self.model = Model(model_path=path)
        self.synth = Synth(self.model)
        self.acc = load_accentor()
        self.variants = collections.defaultdict(list)
        for line in open(os.path.join(path, 'dictionary'), encoding='utf-8'):
            w, _, ph = line.split(maxsplit=2)
            self.variants[w].append(ph.strip())

    @staticmethod
    def _stress(ph: str):
        vs = [x for x in ph.split() if x[-1] in '01']
        return [i for i, x in enumerate(vs) if x.endswith('1')]

    def prepare(self, say: str) -> str:
        # «окончание ет»: the accentor would make it «ёт».
        yo = not re.search(r'окончание (ет|ит)', say, re.I)
        st = self.acc(say, put_yo=yo, put_yo_homo=yo)
        def word(m):
            w = m.group(0)
            plain = w.replace('+', '')
            if '+' not in w or len(re.findall(f'[{VOWELS}]', plain.lower())) < 2:
                return plain
            low = w.lower()
            if low not in self.model.dic:
                sidx = len(re.findall(f'[{VOWELS}]', low[:low.index('+')]))
                match = [ph for ph in self.variants.get(plain.lower(), []) if sidx in self._stress(ph)]
                if match:
                    self.model.dic[low] = match[0]
            return w
        st = re.sub(r"[А-Яа-яЁё+]+", word, st).replace('…', '...')
        # Only what the model knows: letters, stress marks and its punctuation.
        return re.sub(r'[^А-Яа-яЁё+ ,.!?;:()"\-]', ' ', st)

    def say(self, say: str) -> np.ndarray:
        a = self.synth.synth_audio(self.prepare(say), SPEAKER_ID)
        return a.astype(np.float32) / 32768


def engine():
    if ENGINE == 'vosk':
        return Vosk().say
    import torch
    torch.set_num_threads(4)
    m = torch.package.PackageImporter(os.environ.get('SILERO_MODEL', 'v5_6_ru.pt')).load_pickle('tts_models', 'model')
    def say(text):
        # «окончание ет»: the model would read it «ёт» if it put ё by itself.
        yo = not re.search(r'окончание (ет|ит)', text, re.I)
        return m.apply_tts(text=text, speaker=SPEAKER, sample_rate=SR, put_yo=yo).numpy()
    return say


if __name__ == '__main__':
    units = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    speak = engine()
    manifest = []
    old = {}
    if os.path.exists(f'{out}/manifest.json'):
        old = {x['id']: x['say'] for x in json.load(open(f'{out}/manifest.json'))}
        # A run that stopped midway wrote the manifest only so far: keep the clips it recorded.
    for i, u in enumerate(units):
        say = fix(spell(u['text']))
        cid = clip_id(u['key'])
        path = f'{out}/{cid}.wav'
        if not os.path.exists(path) or old.get(cid) != say or (FORCE and FORCE in say):
            a = speak(say)
            sf.write(path, finish(a), SR)
        manifest.append({**u, 'say': say, 'id': cid})
        if i % 200 == 0:
            print(i, len(units), flush=True)
            json.dump(manifest, open(f'{out}/manifest.json', 'w'), ensure_ascii=False, indent=0)
    json.dump(manifest, open(f'{out}/manifest.json', 'w'), ensure_ascii=False, indent=0)

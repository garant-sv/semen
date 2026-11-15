"""Pack the recorded pieces into two MP3 files + index. Usage: pack.py clipsdir public/voice

Pack 0 holds the sentences without numbers (quests, questions, signs, facts: what a child hears
first), pack 1 the pieces with numbers (the fair, scores). The game downloads pack 0 first.
"""
import json, sys, os, re, subprocess, hashlib, glob

src, dst = sys.argv[1], sys.argv[2]
man = json.load(open(f'{src}/manifest.json'))
os.makedirs(dst, exist_ok=True)
blobs = [bytearray(), bytearray()]
clips = {}
for u in man:
    mp3 = f"{src}/{u['id']}.mp3"
    if not os.path.exists(mp3) or os.path.getmtime(mp3) < os.path.getmtime(f"{src}/{u['id']}.wav"):
        # 24 kHz mono, 40 kbit/s: clear speech, 5 KB a second. No headers, so pieces join cleanly.
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f"{src}/{u['id']}.wav", '-ac', '1', '-ar', '24000',
                        '-c:a', 'libmp3lame', '-b:a', '40k', '-write_xing', '0', '-id3v2_version', '0',
                        '-f', 'mp3', mp3], check=True)
    data = open(mp3, 'rb').read()
    k = 1 if re.search(r'\d', u['text']) else 0
    clips[u['key']] = [k, len(blobs[k]), len(data)]
    blobs[k] += data
for old in glob.glob(f'{dst}/pack-*'):
    os.remove(old)
names = []
for b in blobs:
    # MP3 data under a .txt name: the server's self-update only takes files of known web types
    # (deploy/zeleny-sad-install.sh), and the game reads the file as bytes anyway.
    name = f"pack-{hashlib.sha256(b).hexdigest()[:12]}.txt"
    open(f'{dst}/{name}', 'wb').write(b)
    names.append(name)
    print(name, len(b) // 1024, 'KB')
json.dump({'packs': names, 'clips': clips}, open(f'{dst}/voice.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(clips), 'pieces')

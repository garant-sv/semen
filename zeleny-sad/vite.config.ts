/// <reference types="vitest" />
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** Emits sw.js with the exact list of built files, versioned by their content hash. */
function serviceWorker(): Plugin {
  return {
    name: 'green-garden-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const files: string[] = [];
      for (const [name, item] of Object.entries(bundle)) {
        if (name.endsWith('.map')) continue;
        files.push(name);
        hash.update(name);
        hash.update(item.type === 'chunk' ? item.code : item.source);
      }
      const publicDir = join(process.cwd(), 'public');
      const voicePacks: string[] = [];
      let voiceIndex = '';
      for (const p of listFiles(publicDir)) {
        const rel = relative(publicDir, p).split('\\').join('/');
        if (rel.startsWith('.')) continue;
        // The voice recording is big and has its own cache (see sw-template.js): not precached
        // with the game. Their names hold their content hash, and voice.json (precached) names them.
        if (/^voice\/pack-[\w-]+\.txt$/.test(rel)) {
          voicePacks.push(rel.slice('voice/'.length));
          continue;
        }
        // The index of the recording (867 KB) is only needed by those who listen: it is fetched
        // with the recording and kept in the voice cache under its content hash, not precached.
        if (rel === 'voice/voice.json') {
          voiceIndex = `voice.json?v=${createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12)}`;
          continue;
        }
        files.push(rel);
        hash.update(rel);
        hash.update(readFileSync(p));
      }
      const precache = ['./', ...files.sort().map((f) => `./${f}`)];
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(join(process.cwd(), 'src/sw/sw-template.js'), 'utf8');
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache, null, 2)).replace('__VOICE_PACKS__', JSON.stringify(voicePacks.sort())).replace('__VOICE_INDEX__', JSON.stringify(voiceIndex));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [serviceWorker()],
  build: { target: 'safari15', assetsInlineLimit: 0 },
  server: { host: true },
  preview: { host: true },
  test: { include: ['tests/unit/**/*.test.ts'] },
});

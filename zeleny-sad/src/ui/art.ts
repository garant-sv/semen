// Hand-written SVG art for the garden. Everything is drawn in code for this project:
// no external images, no emoji. Each object is drawn with its base point at (0, 0).

import type { DecoId, GuestId, PlantId, Stage } from '../game/data';

export const C = {
  ink: '#3B2E1E',
  stem: '#4E8A3A',
  stemDark: '#3D7330',
  leaf: '#6FAE4E',
  leafLight: '#93C76B',
  soil: '#8A5A3B',
  soilDark: '#5E3B26',
  soilDeep: '#6F4630',
  wood: '#B47E52',
  woodDark: '#7A5230',
  cream: '#FFF6E3',
  water: '#6EC1D9',
  waterDark: '#3E9BB8',
};

const f = (n: number) => Math.round(n * 10) / 10;

export const shadow = (rx: number, ry = rx * 0.32, y = 0, x = 0) =>
  `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#3B2A14" opacity=".16"/>`;

function stem(h: number, bend = 0, w = 3, color = C.stem, x = 0) {
  return `<path d="M${x} 0 Q${f(x + bend)} ${f(-h / 2)} ${x} ${f(-h)}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
}

/** A leaf pointing along `angle` degrees from (x, y). */
export function leaf(x: number, y: number, len: number, angle: number, fill = C.leaf, vein = true) {
  const w = len * 0.36;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${angle})"><path d="M0 0 Q${f(len * 0.45)} ${f(-w)} ${f(len)} 0 Q${f(len * 0.45)} ${f(w)} 0 0Z" fill="${fill}" stroke="${C.stemDark}" stroke-width=".8"/>${
    vein ? `<path d="M1 0 L${f(len * 0.8)} 0" stroke="${C.leafLight}" stroke-width=".7"/>` : ''
  }</g>`;
}

function petalRing(n: number, r: number, pw: number, pl: number, fill: string, stroke: string, offset = 0) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<ellipse cx="0" cy="${f(-r)}" rx="${f(pw)}" ry="${f(pl)}" fill="${fill}" stroke="${stroke}" stroke-width=".7" transform="rotate(${f((360 / n) * i + offset)})"/>`;
  }
  return s;
}

// ---------------------------------------------------------------- plants

const BUD: Record<PlantId, string> = {
  daisy: '#FFFDF5',
  sunflower: '#F6BE3B',
  bellflower: '#8C92E6',
  tulip: '#E5546B',
  lavender: '#9C7BD1',
  moonflower: '#E3EEFF',
  carrot: '#F28C28',
  strawberry: '#E5463B',
  pumpkin: '#F29A2E',
};

const BUD_HEIGHT: Record<PlantId, number> = {
  daisy: 24,
  sunflower: 40,
  bellflower: 30,
  tulip: 30,
  lavender: 28,
  moonflower: 32,
  carrot: 20,
  strawberry: 20,
  pumpkin: 20,
};

function seedMound() {
  return `${shadow(16, 5, 2)}<ellipse cx="0" cy="0" rx="15" ry="6" fill="${C.soilDeep}"/><ellipse cx="0" cy="-2" rx="11" ry="4" fill="#9A6A48"/><ellipse cx="1" cy="-4" rx="4" ry="2.6" fill="#E7C78F" stroke="${C.woodDark}" stroke-width=".8" transform="rotate(-20 1 -4)"/>`;
}

function sprout() {
  return `${shadow(10, 3.5, 1)}<ellipse cx="0" cy="0" rx="9" ry="3.4" fill="${C.soilDeep}"/>${stem(16, 2)}${leaf(0, -15, 12, -150, C.leafLight)}${leaf(0, -15, 12, -30, C.leafLight)}`;
}

function bud(p: PlantId) {
  if (p === 'carrot') return carrotYoung();
  if (p === 'strawberry') return strawberryBush(false);
  if (p === 'pumpkin') return pumpkinVine(false);
  const h = BUD_HEIGHT[p];
  const col = BUD[p];
  return `${shadow(14, 4.5, 1)}${stem(h, 3)}${leaf(0, -h * 0.35, 15, -160)}${leaf(0, -h * 0.55, 13, -25)}<g transform="translate(0 ${-h})"><path d="M0 -14 Q8 -6 5 2 Q0 4 -5 2 Q-8 -6 0 -14Z" fill="${col}" stroke="${C.ink}" stroke-opacity=".35" stroke-width=".8"/><path d="M-6 1 Q-2 -4 0 2 Q2 -4 6 1 Q0 5 -6 1Z" fill="${C.leaf}" stroke="${C.stemDark}" stroke-width=".7"/></g>`;
}

function daisyHead(x: number, y: number, r: number) {
  return `<g transform="translate(${x} ${y})">${petalRing(13, r * 0.6, r * 0.2, r * 0.48, '#FFFDF5', '#D9CDB0')}<circle r="${f(r * 0.34)}" fill="#F2B632" stroke="#C98A22" stroke-width="1"/><circle cx="${f(-r * 0.1)}" cy="${f(-r * 0.1)}" r="${f(r * 0.12)}" fill="#FFD866"/></g>`;
}

function daisy() {
  return `${shadow(18, 5, 1)}${stem(30, -4, 2.6, C.stem, -7)}${stem(24, 4, 2.6, C.stem, 8)}${leaf(-6, -8, 13, -165)}${leaf(7, -6, 12, -15)}${daisyHead(-7, -31, 12)}${daisyHead(8, -25, 10)}`;
}

function sunflower() {
  return `${shadow(20, 6, 1)}${stem(62, 5, 4)}${leaf(1, -22, 22, -155)}${leaf(1, -34, 20, -30)}<g transform="translate(0 -64)">${petalRing(
    16,
    13,
    4.2,
    9,
    '#F6BE3B',
    '#D9962B',
  )}${petalRing(16, 10, 3.4, 7, '#FFD25A', '#D9962B', 11)}<circle r="9" fill="#6B4226" stroke="#4A2C18" stroke-width="1"/><circle cx="-3" cy="-2" r="1.2" fill="#8A5A3B"/><circle cx="2" cy="-4" r="1.2" fill="#8A5A3B"/><circle cx="3" cy="2" r="1.2" fill="#8A5A3B"/><circle cx="-2" cy="3" r="1.2" fill="#8A5A3B"/></g>`;
}

function bell(x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -3 L0 0" stroke="${C.stem}" stroke-width="1.4"/><path d="M-6 11 Q-7 1 0 0 Q7 1 6 11 Q4 9 3 12 Q1.5 9 0 12 Q-1.5 9 -3 12 Q-4 9 -6 11Z" fill="#8C92E6" stroke="#5A60B8" stroke-width=".9"/><path d="M-3 4 Q-3.5 8 -3 10" stroke="#B7BCF5" stroke-width="1.2" fill="none"/></g>`;
}

function bellflower() {
  return `${shadow(18, 5, 1)}<path d="M0 0 C1 -24 4 -42 20 -46" stroke="${C.stem}" stroke-width="3" fill="none" stroke-linecap="round"/>${leaf(0, -10, 15, -160)}${leaf(1, -20, 13, -40)}<path d="M3 -36 Q-6 -40 -10 -36" stroke="${C.stem}" stroke-width="2" fill="none"/>${bell(
    -10,
    -36,
  )}${bell(9, -44, 0.95)}${bell(20, -46, 0.85)}`;
}

function tulip() {
  return `${shadow(16, 5, 1)}${stem(40, 2, 3.4)}<path d="M-2 0 Q-18 -14 -12 -34 Q-6 -16 -1 -4Z" fill="${C.leaf}" stroke="${C.stemDark}" stroke-width=".8"/><path d="M2 0 Q18 -12 13 -30 Q6 -14 1 -3Z" fill="${C.leafLight}" stroke="${C.stemDark}" stroke-width=".8"/><g transform="translate(0 -40)"><path d="M-10 0 Q-12 -14 -7 -22 L-3.5 -14 L0 -24 L3.5 -14 L7 -22 Q12 -14 10 0 Q0 6 -10 0Z" fill="#E5546B" stroke="#B83A52" stroke-width="1"/><path d="M-6 -3 Q-7 -10 -5 -15" stroke="#F59AAA" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
}

function lavenderStalk(angle: number, h: number) {
  let buds = '';
  for (let i = 0; i < 7; i++) {
    const y = -h + i * 3.2;
    const side = i % 2 ? 1.6 : -1.6;
    buds += `<ellipse cx="${side}" cy="${f(y)}" rx="2.1" ry="2.8" fill="${i % 3 ? '#9C7BD1' : '#B79BE3'}" stroke="#6E52A8" stroke-width=".5"/>`;
  }
  return `<g transform="rotate(${angle})"><path d="M0 0 L0 ${-h + 2}" stroke="#6E9E58" stroke-width="1.6"/>${buds}</g>`;
}

function lavender() {
  return `${shadow(18, 5, 1)}${leaf(-2, -2, 13, -170, '#8DB57A', false)}${leaf(2, -2, 13, -10, '#8DB57A', false)}${leaf(0, -4, 10, -120, '#8DB57A', false)}${[
    [-22, 34],
    [-10, 40],
    [0, 44],
    [11, 39],
    [22, 33],
  ]
    .map(([a, h]) => lavenderStalk(a, h))
    .join('')}`;
}

function sparkle(x: number, y: number, r: number, cls = 'twinkle') {
  return `<path class="${cls}" d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="#FFF8D6"/>`;
}

function moonflower() {
  let petals = '';
  for (let i = 0; i < 5; i++) {
    petals += `<path d="M0 0 Q-9 -8 -6 -17 Q0 -21 6 -17 Q9 -8 0 0Z" fill="#EEF4FF" stroke="#A9BFE8" stroke-width=".8" transform="rotate(${i * 72})"/>`;
  }
  return `${shadow(18, 5, 1)}<circle cx="0" cy="-44" r="26" fill="url(#gMoonGlow)" class="pulse"/>${stem(42, -4, 3)}<path d="M0 -14 C-14 -24 -22 -10 -10 -6 Q-4 -6 0 -14Z" fill="${C.leaf}" stroke="${C.stemDark}" stroke-width=".8"/><path d="M0 -24 C14 -34 22 -20 10 -16 Q4 -16 0 -24Z" fill="${C.leafLight}" stroke="${C.stemDark}" stroke-width=".8"/><g transform="translate(0 -44)">${petals}<circle r="5" fill="#FFF3B8" stroke="#E2C66A" stroke-width=".8"/></g>${sparkle(
    -20,
    -60,
    4,
  )}${sparkle(19, -52, 3, 'twinkle d2')}${sparkle(14, -72, 2.6, 'twinkle d3')}`;
}

// ---------------------------------------------------------------- vegetables

function carrotLeaves(h: number, spread: number) {
  let out = '';
  for (const [a, k] of [
    [-spread, 0.85],
    [-spread / 2, 1],
    [0, 1.08],
    [spread / 2, 1],
    [spread, 0.85],
  ]) {
    const len = h * k;
    out += `<g transform="rotate(${a})"><path d="M0 0 L0 ${f(-len)}" stroke="${C.stem}" stroke-width="1.6"/>${[0.45, 0.65, 0.85]
      .map((t) => `${leaf(0, -len * t, len * 0.28, -150, C.leafLight, false)}${leaf(0, -len * t, len * 0.28, -30, C.leafLight, false)}`)
      .join('')}${leaf(0, -len, len * 0.24, -90, C.leafLight, false)}</g>`;
  }
  return out;
}

function carrotYoung() {
  return `${shadow(12, 4, 1)}<ellipse cx="0" cy="0" rx="9" ry="3.4" fill="${C.soilDeep}"/>${carrotLeaves(18, 26)}`;
}

function carrot() {
  return `${shadow(16, 5, 1)}<ellipse cx="0" cy="1" rx="13" ry="4.4" fill="${C.soilDeep}"/>${carrotLeaves(30, 30)}<path d="M-8 -4 Q-9 6 0 9 Q9 6 8 -4 Q0 -8 -8 -4Z" fill="#F28C28" stroke="#B85E14" stroke-width="1.1"/><path d="M-5 -1 h4 M2 2 h4 M-3 5 h3" stroke="#B85E14" stroke-width=".9" stroke-linecap="round"/><ellipse cx="-3" cy="-3" rx="2.4" ry="1.2" fill="#FFC27A" opacity=".8"/>`;
}

function trefoil(x: number, y: number, s: number, a: number) {
  return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})">${[-40, 0, 40]
    .map((r) => `<ellipse cx="0" cy="-7" rx="4.6" ry="6.6" fill="${C.leaf}" stroke="${C.stemDark}" stroke-width=".8" transform="rotate(${r})"/>`)
    .join('')}</g>`;
}

function berry(x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-5 -4 Q-6 4 0 8 Q6 4 5 -4 Q0 -6 -5 -4Z" fill="#E5463B" stroke="#A3282A" stroke-width=".9"/><path d="M-4 -5 L-1 -3 L0 -6 L1 -3 L4 -5 L2 -2 L-2 -2Z" fill="${C.leaf}" stroke="${C.stemDark}" stroke-width=".5"/>${[
    [-2, 0],
    [2, 1],
    [0, 4],
    [-2.6, 3.4],
    [2.6, 4],
  ]
    .map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx=".6" ry=".9" fill="#FFE08A"/>`)
    .join('')}</g>`;
}

function whiteFlower(x: number, y: number) {
  return `<g transform="translate(${x} ${y})">${petalRing(5, 2.6, 2, 2.6, '#FFFDF5', '#D9CDB0')}<circle r="1.6" fill="#F2B632"/></g>`;
}

function strawberryBush(ripe: boolean) {
  const fruit = ripe
    ? `${berry(-14, -6)}${berry(13, -4, 1.1)}${berry(-2, -2, 0.95)}${berry(20, -12, 0.85)}`
    : `${whiteFlower(-12, -20)}${whiteFlower(10, -24)}${whiteFlower(18, -14)}`;
  return `${shadow(20, 5.5, 1)}<path d="M0 0 Q-6 -10 -14 -16 M0 0 Q2 -14 0 -24 M0 0 Q8 -10 16 -18" stroke="${C.stem}" stroke-width="1.6" fill="none"/>${trefoil(-14, -14, 1, -30)}${trefoil(0, -22, 1.1, 0)}${trefoil(16, -16, 1, 30)}${trefoil(-6, -8, 0.8, -60)}${trefoil(8, -8, 0.8, 60)}${fruit}`;
}

function pumpkinLeaf(x: number, y: number, s: number, a: number) {
  return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M0 0 C-10 -2 -14 -10 -10 -16 C-8 -20 -3 -18 0 -22 C3 -18 8 -20 10 -16 C14 -10 10 -2 0 0Z" fill="#6FAE4E" stroke="${C.stemDark}" stroke-width=".9"/><path d="M0 0 L0 -18 M0 -8 L-7 -14 M0 -8 L7 -14" stroke="${C.leafLight}" stroke-width=".8" fill="none"/></g>`;
}

function pumpkinVine(ripe: boolean) {
  const vine = `<path d="M-26 2 Q-12 -6 0 -2 Q14 2 26 -4" stroke="${C.stem}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M22 -4 q6 -6 2 -9 q-4 -2 -3 3" stroke="${C.stem}" stroke-width="1.2" fill="none"/>`;
  if (!ripe) {
    return `${shadow(24, 5.5, 1)}${vine}${pumpkinLeaf(-16, -2, 1, -20)}${pumpkinLeaf(10, -1, 1.15, 15)}${pumpkinLeaf(-2, -4, 0.9, 0)}<g transform="translate(-4 -22)"><path d="M0 0 L-6 -8 L-2 -7 L0 -12 L2 -7 L6 -8Z" fill="#F6BE3B" stroke="#C98A22" stroke-width=".8" stroke-linejoin="round"/></g>`;
  }
  return `${shadow(28, 7, 1)}${vine}${pumpkinLeaf(-22, -2, 1, -40)}${pumpkinLeaf(22, -4, 0.95, 40)}<g transform="translate(0 -2)"><ellipse cx="-11" cy="-12" rx="10" ry="12" fill="#E8862A" stroke="#A85A16" stroke-width="1"/><ellipse cx="11" cy="-12" rx="10" ry="12" fill="#E8862A" stroke="#A85A16" stroke-width="1"/><ellipse cx="0" cy="-13" rx="11" ry="13.4" fill="#F29A2E" stroke="#A85A16" stroke-width="1.1"/><path d="M-5 -24 Q-7 -13 -5 -1 M5 -24 Q7 -13 5 -1" stroke="#C9701E" stroke-width="1" fill="none"/><ellipse cx="-4" cy="-19" rx="3" ry="4.6" fill="#FFC27A" opacity=".55"/><path d="M0 -25 Q1 -31 4 -33" stroke="#6B5A2E" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
}

const BLOOMS: Record<PlantId, () => string> = {
  daisy,
  sunflower,
  bellflower,
  tulip,
  lavender,
  moonflower,
  carrot,
  strawberry: () => strawberryBush(true),
  pumpkin: () => pumpkinVine(true),
};

export function plantArt(p: PlantId, stage: Stage): string {
  if (stage === 0) return seedMound();
  if (stage === 1) return sprout();
  if (stage === 2) return bud(p);
  return BLOOMS[p]();
}

/** Plant picture for cards (seed picker, collection): framed in a small viewBox. */
export function plantIcon(p: PlantId, stage: Stage = 3, size = 64, locked = false): string {
  const art = plantArt(p, stage);
  return `<svg class="icon-svg${locked ? ' locked' : ''}" viewBox="-36 -84 72 92" width="${size}" height="${size}" aria-hidden="true">${art}</svg>`;
}

// ---------------------------------------------------------------- plots

export function plotBed(wet = false): string {
  const damp = wet
    ? `<ellipse class="wet" cx="0" cy="0" rx="45" ry="17" fill="#5A3826" opacity=".6"/><path d="M-22 -4 q4 -2 8 0 M14 6 q4 -2 8 0 M-6 9 q3 -1.5 6 0" stroke="#A9D9E6" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/>`
    : '';
  return `${shadow(56, 20, 10)}<ellipse cx="0" cy="7" rx="52" ry="22" fill="${C.soilDark}"/><ellipse cx="0" cy="0" rx="52" ry="22" fill="${C.wood}" stroke="${C.woodDark}" stroke-width="1.6"/><ellipse cx="0" cy="0" rx="45" ry="17" fill="${C.soil}"/>${damp}<path d="M-30 -6 Q0 -10 30 -6 M-36 2 Q0 -2 36 2 M-28 9 Q0 6 28 9" stroke="${C.soilDeep}" stroke-width="1.4" fill="none" opacity=".55"/>`;
}

/** Golden aura behind a golden bloom (the plant itself is tinted with the fGold filter). */
export function goldenAura(): string {
  return `<ellipse class="pulse" cx="0" cy="-40" rx="40" ry="46" fill="url(#gGold)"/><ellipse class="pulse" cx="0" cy="0" rx="47" ry="18" fill="none" stroke="#F6BE3B" stroke-width="2.4" stroke-dasharray="4 5"/>`;
}

export function goldenSparkles(): string {
  return `${sparkle(-34, -66, 5)}${sparkle(30, -78, 4, 'twinkle d2')}${sparkle(36, -30, 3.5, 'twinkle d3')}${sparkle(-30, -24, 3, 'twinkle d2')}`;
}

/** Watering can used in the watering animation; spout points right. */
export function wateringCan(): string {
  return `<g class="can"><path d="M-10 -14 Q0 -30 10 -14" stroke="#3E9BB8" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M8 -2 L27 -15" stroke="#3E9BB8" stroke-width="4.6" stroke-linecap="round"/><path d="M8 -2 L27 -15" stroke="#6EC1D9" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="28" cy="-16" rx="3.4" ry="4.8" fill="#3E9BB8" transform="rotate(-35 28 -16)"/><rect x="-15" y="-15" width="26" height="20" rx="5" fill="#6EC1D9" stroke="#3E9BB8" stroke-width="1.8"/><path d="M-11 -9 h18" stroke="#BDE6F0" stroke-width="2" stroke-linecap="round"/><circle cx="-2" cy="-1" r="2.6" fill="#F59AAA"/></g>`;
}

export function brambles(): string {
  const vines = [
    'M-40 4 C-30 -20 -12 -26 -4 -6',
    'M-14 8 C-6 -26 16 -30 22 -4',
    'M10 6 C18 -18 34 -20 40 2',
    'M-30 -2 C-24 -30 0 -40 6 -22',
  ];
  const thorns = [
    [-32, -10],
    [-14, -18],
    [4, -20],
    [20, -14],
    [30, -10],
    [-6, -30],
  ];
  return `${vines
    .map((d) => `<path d="${d}" stroke="#4A5E2E" stroke-width="3.4" fill="none" stroke-linecap="round"/>`)
    .join('')}${thorns.map(([x, y]) => leaf(x, y, 9, -60 + x, '#6E7F3E', false)).join('')}<g transform="translate(30 -8)"><rect x="-1.6" y="-26" width="3.2" height="28" fill="${C.woodDark}"/><rect x="-11" y="-34" width="22" height="13" rx="2" fill="#D9B98A" stroke="${C.woodDark}" stroke-width="1.2"/><path d="M-6 -27.5 h12" stroke="${C.woodDark}" stroke-width="1.4" stroke-dasharray="2 2"/></g>`;
}

export function waterBadge(): string {
  return `<g class="badge bob"><circle r="13" fill="${C.cream}" stroke="${C.waterDark}" stroke-width="2"/><path d="M0 -8 Q7 1 6 4 A6 6 0 0 1 -6 4 Q-7 1 0 -8Z" fill="${C.water}" stroke="${C.waterDark}" stroke-width="1"/><path d="M-2.5 2 Q-3 4.5 -1 5.5" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>`;
}

export function readyBadge(): string {
  return `<g class="badge bob"><circle r="13" fill="${C.cream}" stroke="#D9962B" stroke-width="2"/><path d="M-6 0 L-1.5 5 L7 -5" stroke="#3E8E3A" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

export function progressBar(fraction: number): string {
  const w = 54;
  return `<g class="progress"><rect x="${-w / 2}" y="-4" width="${w}" height="8" rx="4" fill="${C.cream}" stroke="${C.woodDark}" stroke-width="1.2"/><rect x="${-w / 2 + 1.5}" y="-2.5" width="${f(Math.max(0, (w - 3) * fraction))}" height="5" rx="2.5" fill="#7FB069"/></g>`;
}

// ---------------------------------------------------------------- decorations

function lantern() {
  return `${shadow(11)}<rect x="-2" y="-46" width="4" height="46" rx="1" fill="${C.woodDark}"/><rect x="-6" y="-3" width="12" height="4" rx="1.5" fill="${C.woodDark}"/><circle cx="0" cy="-54" r="16" fill="url(#gLampGlow)" class="pulse"/><path d="M-8 -60 L0 -67 L8 -60Z" fill="${C.woodDark}"/><rect x="-6.5" y="-60" width="13" height="14" rx="3" fill="#FFD77A" stroke="${C.woodDark}" stroke-width="2"/><path d="M0 -60 v14 M-6.5 -53 h13" stroke="${C.woodDark}" stroke-width="1"/>`;
}

function birdhouse() {
  return `${shadow(11)}<rect x="-2.2" y="-42" width="4.4" height="42" fill="${C.woodDark}"/><rect x="-12" y="-64" width="24" height="23" rx="2" fill="#D8A06A" stroke="${C.woodDark}" stroke-width="1.6"/><path d="M-16 -62 L0 -76 L16 -62Z" fill="#B5543F" stroke="#7E3527" stroke-width="1.4" stroke-linejoin="round"/><circle cx="0" cy="-55" r="4" fill="#4A2C18"/><path d="M-4 -46 h8" stroke="${C.woodDark}" stroke-width="2" stroke-linecap="round"/>`;
}

function pinwheel() {
  const cols = ['#E5546B', '#F6BE3B', '#6EC1D9', '#7FB069'];
  const blades = cols
    .map((c, i) => `<path d="M0 0 L0 -15 Q8 -12 0 0Z" fill="${c}" stroke="${C.ink}" stroke-opacity=".35" stroke-width=".7" transform="rotate(${i * 90})"/>`)
    .join('');
  return `${shadow(9)}<rect x="-1.6" y="-48" width="3.2" height="48" fill="${C.wood}" stroke="${C.woodDark}" stroke-width=".6"/><g transform="translate(0 -50)"><g class="spin">${blades}</g><circle r="2.6" fill="${C.cream}" stroke="${C.woodDark}"/></g>`;
}

function bench() {
  return `${shadow(28, 7)}<rect x="-22" y="-14" width="4" height="14" fill="${C.woodDark}"/><rect x="18" y="-14" width="4" height="14" fill="${C.woodDark}"/><rect x="-26" y="-18" width="52" height="6" rx="2" fill="${C.wood}" stroke="${C.woodDark}" stroke-width="1.2"/><rect x="-21" y="-38" width="3.5" height="22" fill="${C.woodDark}"/><rect x="17.5" y="-38" width="3.5" height="22" fill="${C.woodDark}"/><rect x="-25" y="-36" width="50" height="6" rx="2" fill="${C.wood}" stroke="${C.woodDark}" stroke-width="1.2"/><rect x="-25" y="-27" width="50" height="5" rx="2" fill="${C.wood}" stroke="${C.woodDark}" stroke-width="1.2"/>`;
}

function scarecrow() {
  return `${shadow(14)}<rect x="-2" y="-60" width="4" height="60" fill="${C.woodDark}"/><rect x="-22" y="-46" width="44" height="3.5" fill="${C.woodDark}"/><path d="M-22 -44 l-5 4 M-22 -44 l-6 -1 M22 -44 l5 4 M22 -44 l6 -1" stroke="#E2B94E" stroke-width="1.6" stroke-linecap="round"/><path d="M-16 -48 L16 -48 L12 -22 L-12 -22Z" fill="#6E9BD1" stroke="#466FA3" stroke-width="1.2"/><rect x="2" y="-36" width="7" height="7" fill="#E5546B" opacity=".85"/><path d="M-12 -22 l-2 5 M-6 -22 l-1 5 M0 -22 v5 M6 -22 l1 5 M12 -22 l2 5" stroke="#E2B94E" stroke-width="1.6"/><circle cx="0" cy="-57" r="9" fill="#E9C98B" stroke="#B8935A" stroke-width="1"/><circle cx="-3" cy="-58" r="1.3" fill="${C.ink}"/><circle cx="3" cy="-58" r="1.3" fill="${C.ink}"/><path d="M-3 -54 Q0 -52 3 -54" stroke="${C.ink}" stroke-width="1" fill="none"/><path d="M-14 -63 h28" stroke="#7A5230" stroke-width="3" stroke-linecap="round"/><path d="M-8 -63 Q-7 -76 0 -76 Q7 -76 8 -63Z" fill="#8D6238" stroke="#5E3B26" stroke-width="1"/>`;
}

function arch() {
  const flowers = [
    [-21, -46, '#F59AAA'],
    [-17, -58, '#FFFDF5'],
    [-8, -66, '#E5546B'],
    [3, -68, '#FFFDF5'],
    [13, -63, '#F59AAA'],
    [20, -52, '#E5546B'],
    [-22, -30, '#FFFDF5'],
    [22, -34, '#F59AAA'],
  ] as const;
  return `${shadow(30, 7)}<rect x="-24" y="-50" width="4.5" height="50" fill="${C.woodDark}"/><rect x="19.5" y="-50" width="4.5" height="50" fill="${C.woodDark}"/><path d="M-22 -50 Q0 -84 22 -50" stroke="${C.woodDark}" stroke-width="4.5" fill="none"/><path d="M-22 -4 C-28 -20 -16 -30 -22 -44 C-24 -60 -6 -72 4 -68 C14 -66 24 -58 22 -44 C20 -30 28 -18 22 -4" stroke="${C.stem}" stroke-width="2" fill="none"/>${flowers
    .map(([x, y, c]) => `<g transform="translate(${x} ${y})">${petalRing(5, 2.6, 1.8, 2.6, c, '#C76A7A')}<circle r="1.4" fill="#F2B632"/></g>`)
    .join('')}${leaf(-24, -20, 8, 200)}${leaf(24, -24, 8, -20)}${leaf(-12, -66, 8, -120)}`;
}

const DECOS: Record<DecoId, () => string> = { lantern, birdhouse, pinwheel, bench, scarecrow, arch };

export function decoArt(id: DecoId): string {
  return DECOS[id]();
}

export function decoIcon(id: DecoId, size = 64): string {
  return `<svg class="icon-svg" viewBox="-40 -86 80 96" width="${size}" height="${size}" aria-hidden="true">${decoArt(id)}</svg>`;
}

// ---------------------------------------------------------------- guests

const INK = '#2B1D14';

function ladybug() {
  const spots = [
    [-4, -10],
    [3, -10],
    [-5, -4],
    [4, -4],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${INK}"/>`)
    .join('');
  return `${shadow(11, 3.4, 1)}<path d="M-6 0 l-2 2 M0 0 v2.5 M6 0 l2 2" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/><circle cx="10" cy="-6" r="4.4" fill="${INK}"/><circle cx="11.8" cy="-7.6" r="1.1" fill="#fff"/><path d="M12 -10 q2 -4 4 -4 M10 -10 q0 -4 2 -6" stroke="${INK}" stroke-width=".9" fill="none"/><ellipse cx="0" cy="-7" rx="10" ry="7.6" fill="#E5463B" stroke="#8E2A22" stroke-width="1"/><path d="M0 -14.4 V0.4" stroke="${INK}" stroke-width="1.2"/>${spots}<ellipse cx="-4" cy="-11" rx="3" ry="1.4" fill="#fff" opacity=".35"/>`;
}

function snail() {
  return `${shadow(16, 3.6, 1)}<path d="M-16 0 Q-6 -6 8 -4 Q12 -4 13 -10 Q14 -16 17 -17 Q20 -16 19 -10 Q18 -2 10 0Z" fill="#D8CB95" stroke="#9C8E57" stroke-width="1"/><path d="M15 -16 L13 -24 M18 -16 L20 -23" stroke="#9C8E57" stroke-width="1.3" stroke-linecap="round"/><circle cx="13" cy="-24" r="1.6" fill="${INK}"/><circle cx="20" cy="-23" r="1.6" fill="${INK}"/><path d="M15 -11 q1.5 1.4 3 0" stroke="${INK}" stroke-width=".9" fill="none" stroke-linecap="round"/><circle cx="-2" cy="-11" r="10" fill="#E3A35E" stroke="#8C5A2B" stroke-width="1.4"/><path d="M-2 -11 m0 -6.5 a6.5 6.5 0 1 1 -5.6 9.8 a4.2 4.2 0 1 1 7.6 -3.4 a2 2 0 1 1 -2.4 1.6" stroke="#8C5A2B" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
}

function bee() {
  return `<g class="wings"><ellipse cx="-2" cy="-13" rx="5" ry="7" fill="#EAF7FB" stroke="#9CC9D6" stroke-width=".8" opacity=".9" transform="rotate(-20 -2 -13)"/><ellipse cx="4" cy="-13" rx="4" ry="6" fill="#EAF7FB" stroke="#9CC9D6" stroke-width=".8" opacity=".9" transform="rotate(15 4 -13)"/></g><path d="M-11 -6 L-15 -5 L-11 -3Z" fill="${INK}"/><ellipse cx="0" cy="-5" rx="11" ry="7" fill="#F6BE3B" stroke="#B9852A" stroke-width="1"/><path d="M-5 -11.4 Q-6.5 -5 -5 1.4 M1 -12 Q-0.5 -5 1 2" stroke="${INK}" stroke-width="3" fill="none"/><circle cx="11" cy="-6" r="4.6" fill="${INK}"/><circle cx="12.6" cy="-7.4" r="1.2" fill="#fff"/><path d="M12 -10 q1 -4 4 -5 M10 -10 q-1 -4 1 -6" stroke="${INK}" stroke-width=".9" fill="none"/>`;
}

function butterflyGuest() {
  return `<g class="wings"><path d="M0 -6 C-6 -22 -22 -20 -18 -8 C-16 -2 -6 -2 0 -6Z" fill="#8C92E6" stroke="#4B5BB0" stroke-width="1"/><path d="M0 -6 C-4 2 -14 6 -14 0 C-14 -4 -6 -6 0 -6Z" fill="#B7BCF5" stroke="#4B5BB0" stroke-width="1"/><path d="M0 -6 C6 -22 22 -20 18 -8 C16 -2 6 -2 0 -6Z" fill="#8C92E6" stroke="#4B5BB0" stroke-width="1"/><path d="M0 -6 C4 2 14 6 14 0 C14 -4 6 -6 0 -6Z" fill="#B7BCF5" stroke="#4B5BB0" stroke-width="1"/><circle cx="-11" cy="-12" r="2.4" fill="#F6BE3B"/><circle cx="11" cy="-12" r="2.4" fill="#F6BE3B"/></g><rect x="-1.4" y="-14" width="2.8" height="14" rx="1.4" fill="${INK}"/><path d="M0 -14 q-2 -5 -5 -6 M0 -14 q2 -5 5 -6" stroke="${INK}" stroke-width=".9" fill="none"/>`;
}

function hedgehog() {
  let spikes = '';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.02 + (i / 8) * 0.88);
    const x = Math.cos(a) * 15 - 1;
    const y = Math.sin(a) * 15 - 2;
    const x2 = Math.cos(a) * 21 - 1;
    const y2 = Math.sin(a) * 21 - 2;
    spikes += `<path d="M${f(x - 3)} ${f(y)} L${f(x2)} ${f(y2)} L${f(x + 3)} ${f(y + 1)}" fill="#6B4A2E" stroke="#4A3220" stroke-width=".8" stroke-linejoin="round"/>`;
  }
  return `${shadow(18, 4, 1)}${spikes}<path d="M-17 0 Q-18 -16 -2 -17 Q12 -17 15 -8 L22 -4 Q21 0 15 0Z" fill="#8A6A4A" stroke="#5E4530" stroke-width="1"/><path d="M6 -14 Q14 -12 16 -6 L22 -4 Q20 -0.5 14 -0.5 Q6 -1 6 -8Z" fill="#E2C49A" stroke="#B08A5E" stroke-width=".8"/><circle cx="22.4" cy="-4" r="1.9" fill="${INK}"/><circle cx="12" cy="-9" r="1.6" fill="${INK}"/><circle cx="12.5" cy="-9.6" r=".5" fill="#fff"/><circle cx="14.6" cy="-5" r="1.6" fill="#F59AAA" opacity=".6"/><ellipse cx="-8" cy="0" rx="3" ry="1.6" fill="#5E4530"/><ellipse cx="7" cy="0" rx="3" ry="1.6" fill="#5E4530"/>`;
}

function frog() {
  return `${shadow(15, 4, 1)}<ellipse cx="-11" cy="-2" rx="6" ry="3.4" fill="#5E9E45" stroke="#3F7A3A" stroke-width=".9"/><ellipse cx="11" cy="-2" rx="6" ry="3.4" fill="#5E9E45" stroke="#3F7A3A" stroke-width=".9"/><ellipse cx="0" cy="-9" rx="13" ry="9.5" fill="#7DBA57" stroke="#3F7A3A" stroke-width="1.1"/><ellipse cx="0" cy="-5" rx="8" ry="4.4" fill="#C9E6A6"/><circle cx="-6.5" cy="-18" r="5" fill="#7DBA57" stroke="#3F7A3A" stroke-width="1.1"/><circle cx="6.5" cy="-18" r="5" fill="#7DBA57" stroke="#3F7A3A" stroke-width="1.1"/><circle cx="-6.5" cy="-18.4" r="3" fill="#fff"/><circle cx="6.5" cy="-18.4" r="3" fill="#fff"/><circle cx="-6" cy="-18" r="1.7" fill="${INK}"/><circle cx="7" cy="-18" r="1.7" fill="${INK}"/><path d="M-6 -10 Q0 -6 6 -10" stroke="#2E5A24" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="-9" cy="-11" r="1.8" fill="#F59AAA" opacity=".55"/><circle cx="9" cy="-11" r="1.8" fill="#F59AAA" opacity=".55"/>`;
}

const GUEST_ART: Record<GuestId, () => string> = {
  ladybug,
  snail,
  bee,
  butterfly: butterflyGuest,
  hedgehog,
  frog,
};

export function guestArt(id: GuestId): string {
  return GUEST_ART[id]();
}

export function guestIcon(id: GuestId, size = 64, locked = false): string {
  return `<svg class="icon-svg${locked ? ' locked' : ''}" viewBox="-26 -32 52 40" width="${size}" height="${size}" aria-hidden="true">${guestArt(id)}</svg>`;
}

export function medalIcon(got: boolean, size = 52): string {
  const [fill, ring] = got ? ['#F6BE3B', '#C98A22'] : ['#E6DCC4', '#C9B994'];
  return `<svg class="medal" viewBox="-20 -24 40 46" width="${size}" height="${size}" aria-hidden="true"><path d="M-9 -22 L-3 -6 M9 -22 L3 -6" stroke="${got ? '#6EC1D9' : '#D8CDB4'}" stroke-width="6"/><circle cx="0" cy="6" r="14" fill="${fill}" stroke="${ring}" stroke-width="2.4"/><path d="M0 -3 L2.6 2.6 L8.6 3.2 L4 7.2 L5.4 13 L0 10 L-5.4 13 L-4 7.2 L-8.6 3.2 L-2.6 2.6Z" fill="${got ? '#FFF6E3' : '#F4EEDF'}"/></svg>`;
}

export function starIcon(size = 18): string {
  return `<svg class="star-icon" viewBox="-12 -12 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M0 -10 L2.9 -3.6 L9.6 -3.1 L4.5 1.4 L6 8.2 L0 4.6 L-6 8.2 L-4.5 1.4 L-9.6 -3.1 L-2.9 -3.6Z" fill="#F6BE3B" stroke="#C98A22" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}

// ---------------------------------------------------------------- Listik

export function listik(size = 56, mood: 'happy' | 'wow' = 'happy'): string {
  const mouth =
    mood === 'wow'
      ? `<ellipse cx="0" cy="8" rx="3" ry="3.6" fill="#7A2E2E"/>`
      : `<path d="M-5.5 6 Q0 11.5 5.5 6" stroke="#2E3A24" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  return `<svg class="listik-svg" viewBox="-28 -34 56 68" width="${size}" height="${size}" aria-hidden="true"><path d="M0 24 Q3 30 -2 33" stroke="#3F7A3A" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M0 -31 C19 -19 24 5 0 25 C-24 5 -19 -19 0 -31Z" fill="url(#gListik)" stroke="#3F7A3A" stroke-width="2"/><path d="M0 -25 L0 19 M0 -8 L-9 -15 M0 -8 L9 -15 M0 8 L-11 1 M0 8 L11 1" stroke="#B7DE96" stroke-width="1.3" fill="none" opacity=".8"/><g class="eyes"><ellipse cx="-7" cy="-5" rx="4.4" ry="5.2" fill="#fff" stroke="#2E3A24" stroke-width=".8"/><ellipse cx="7" cy="-5" rx="4.4" ry="5.2" fill="#fff" stroke="#2E3A24" stroke-width=".8"/><circle cx="-6.2" cy="-4" r="2.4" fill="#2E3A24"/><circle cx="7.8" cy="-4" r="2.4" fill="#2E3A24"/><circle cx="-5.4" cy="-5" r=".9" fill="#fff"/><circle cx="8.6" cy="-5" r=".9" fill="#fff"/></g><circle cx="-12" cy="4" r="3" fill="#F59AAA" opacity=".55"/><circle cx="12" cy="4" r="3" fill="#F59AAA" opacity=".55"/>${mouth}</svg>`;
}

// ---------------------------------------------------------------- small UI icons

export function petalIcon(size = 22): string {
  return `<svg class="petal-icon" viewBox="-12 -12 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M0 10 C-11 2 -9 -9 0 -10 C9 -9 11 2 0 10Z" fill="#F59AAA" stroke="#C25A6E" stroke-width="1.4"/><path d="M0 7 Q-1 -1 0 -7" stroke="#FFD3DB" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
}

export const ICONS = {
  garden: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 12C12 7 8.5 5 4.5 5c0 4.5 3 7 7.5 7Z" fill="currentColor"/><path d="M12 14c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5Z" fill="currentColor" opacity=".7"/><path d="M5 21h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  decor: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V12a7 7 0 0 1 14 0v9" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="12" cy="5.6" r="2" fill="currentColor" opacity=".7"/><circle cx="16" cy="8" r="2" fill="currentColor"/></svg>`,
  book: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z" fill="currentColor" opacity=".75"/><path d="M13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13Z" fill="currentColor"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  circle: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>`,
};

/** Shared gradients used by all inline SVGs on the page (rendered once, hidden). */
export const SHARED_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="gListik" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A6D67E"/><stop offset="1" stop-color="#5E9E45"/></linearGradient>
<radialGradient id="gMoonGlow"><stop offset="0" stop-color="#E3EEFF" stop-opacity=".95"/><stop offset=".6" stop-color="#BFD7FF" stop-opacity=".35"/><stop offset="1" stop-color="#BFD7FF" stop-opacity="0"/></radialGradient>
<radialGradient id="gLampGlow"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/></radialGradient>
<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FCEBC8"/><stop offset="1" stop-color="#E4F0CF"/></linearGradient>
<linearGradient id="gMeadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CCB74"/><stop offset="1" stop-color="#77AC57"/></linearGradient>
<linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD6E6"/><stop offset="1" stop-color="#4FA7C4"/></linearGradient>
<radialGradient id="gGold"><stop offset="0" stop-color="#FFE9A6" stop-opacity=".95"/><stop offset=".55" stop-color="#FFD25A" stop-opacity=".4"/><stop offset="1" stop-color="#FFD25A" stop-opacity="0"/></radialGradient>
<radialGradient id="gGuest"><stop offset="0" stop-color="#FFF6E3" stop-opacity=".85"/><stop offset="1" stop-color="#FFF6E3" stop-opacity="0"/></radialGradient>
<filter id="fGold" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.55 0.5 0.1 0 0.22  0.42 0.42 0.08 0 0.14  0.12 0.14 0.05 0 0.02  0 0 0 1 0"/></filter>
<radialGradient id="gDryPond"><stop offset="0" stop-color="#C79C6C"/><stop offset="1" stop-color="#A27449"/></radialGradient>
</defs></svg>`;

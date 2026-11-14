// The 2.5D garden diorama (SVG, viewBox 400×640). Static background is drawn once;
// dynamic layers are re-rendered only when their markup changes.

import { AREA_PLOTS, PLOT_COUNT, SLOT_COUNT, VEG_PLOT_COUNT, plotArea, type DecoId, type PlantId, type ZoneId } from '../game/data';
import {
  gardenProgress,
  orderComplete,
  ordersAvailable,
  plotStatus,
  stageProgress,
  type GameState,
} from '../game/state';
import {
  C,
  brambles,
  decoArt,
  goldenAura,
  goldenSparkles,
  guestArt,
  leaf,
  plantArt,
  plotBed,
  progressBar,
  readyBadge,
  shadow,
  waterBadge,
  wateringCan,
  wildBed,
} from './art';

export const VIEW_W = 400;
export const VIEW_H = 640;

export const PLOTS: { x: number; y: number }[] = [
  { x: 80, y: 448 },
  { x: 200, y: 448 },
  { x: 320, y: 448 },
  { x: 80, y: 552 },
  { x: 200, y: 552 },
  { x: 320, y: 552 },
];

export const SLOTS: { x: number; y: number }[] = [
  { x: 214, y: 318 },
  { x: 352, y: 304 },
  { x: 140, y: 384 },
  { x: 260, y: 384 },
  { x: 140, y: 626 },
  { x: 260, y: 626 },
];

export const VEG_PLOTS: { x: number; y: number }[] = [
  { x: 112, y: 436 },
  { x: 288, y: 436 },
  { x: 112, y: 560 },
  { x: 288, y: 560 },
];

if (PLOTS.length !== PLOT_COUNT || SLOTS.length !== SLOT_COUNT || VEG_PLOTS.length !== VEG_PLOT_COUNT) {
  throw new Error('scene layout mismatch');
}

/** The three beds in each natural zone. */
export const ZONE_PLOTS: { x: number; y: number }[] = [
  { x: 104, y: 470 },
  { x: 296, y: 470 },
  { x: 200, y: 580 },
];

/** Scene position of any bed. */
export function plotPos(i: number) {
  const area = plotArea(i);
  const k = i - AREA_PLOTS[area][0];
  if (area === 'garden') return PLOTS[k];
  if (area === 'veg') return VEG_PLOTS[k];
  return ZONE_PLOTS[k];
}

// A tiny deterministic random generator, so the background looks the same every time.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function tree(x: number, y: number, r: number, tone: string) {
  return `<g transform="translate(${x} ${y})"><rect x="-3" y="-4" width="6" height="${r * 0.9}" fill="#6B4A2E"/><circle cx="0" cy="${-r * 0.4}" r="${r}" fill="${tone}"/><circle cx="${-r * 0.55}" cy="${-r * 0.05}" r="${r * 0.7}" fill="${tone}"/><circle cx="${r * 0.55}" cy="${-r * 0.05}" r="${r * 0.72}" fill="${tone}"/><circle cx="${-r * 0.25}" cy="${-r * 0.7}" r="${r * 0.45}" fill="#fff" opacity=".08"/></g>`;
}

function cloud(x: number, y: number, s: number, cls = 'drift') {
  return `<g class="${cls}"><g transform="translate(${x} ${y}) scale(${s})" opacity=".9"><ellipse cx="0" cy="0" rx="26" ry="9" fill="#FFF9EC"/><circle cx="-8" cy="-6" r="10" fill="#FFF9EC"/><circle cx="8" cy="-8" r="12" fill="#FFF9EC"/></g></g>`;
}

function tuft(x: number, y: number, tone: string) {
  return `<path d="M${x - 5} ${y} Q${x - 4} ${y - 7} ${x - 1} ${y - 9} Q${x - 1} ${y - 4} ${x} ${y} Q${x + 1} ${y - 8} ${x + 5} ${y - 10} Q${x + 3} ${y - 4} ${x + 5} ${y}Z" fill="${tone}"/>`;
}

export function backgroundSVG(seed = 7): string {
  const r = rng(seed);
  let tufts = '';
  for (let i = 0; i < 46; i++) {
    const x = Math.round(r() * 400);
    const y = Math.round(200 + r() * 440);
    tufts += tuft(x, y, r() > 0.5 ? '#86BC62' : '#6EA650');
  }
  let flowers = '';
  for (let i = 0; i < 18; i++) {
    const x = Math.round(r() * 400);
    const y = Math.round(330 + r() * 300);
    const col = ['#FFFDF5', '#F6BE3B', '#F59AAA'][i % 3];
    flowers += `<circle cx="${x}" cy="${y}" r="1.8" fill="${col}"/>`;
  }
  const trees = [
    tree(18, 150, 26, '#5E9049'),
    tree(64, 140, 22, '#6FA35A'),
    tree(112, 152, 25, '#5A8C45'),
    tree(372, 142, 26, '#5A8C45'),
    tree(232, 146, 20, '#6FA35A'),
    tree(190, 154, 24, '#5E9049'),
  ].join('');
  let fence = '';
  for (let x = 6; x < 400; x += 26) {
    if (x > 290 && x < 360) continue; // gap where the brook enters
    const tilt = (x * 7) % 5 === 0 ? 8 : 0;
    fence += `<rect x="${x}" y="164" width="7" height="26" rx="2" fill="#B48A62" stroke="${C.woodDark}" stroke-width="1" transform="rotate(${tilt} ${x + 3} 190)"/>`;
  }
  fence += `<path d="M0 172 L290 174 M360 174 L400 172" stroke="${C.woodDark}" stroke-width="3"/>`;
  return `
<rect x="-400" y="-300" width="1200" height="500" fill="url(#gSky)"/>
<circle cx="330" cy="58" r="30" fill="#FFE6A6" opacity=".85"/>
${cloud(80, 52, 1)}${cloud(250, 34, 0.8, 'drift slow')}
<path d="M-400 150 Q-200 110 0 140 Q80 96 170 128 T400 118 Q600 100 800 140 V200 H-400Z" fill="#B9D79A"/>
<path d="M-400 170 Q-200 140 0 160 Q110 128 220 150 T400 146 Q600 140 800 160 V210 H-400Z" fill="#A3CB83"/>
${trees}
<rect x="-400" y="170" width="1200" height="800" fill="url(#gMeadow)"/>
${fence}
<path d="M20 640 C60 600 150 610 200 596 C250 584 330 600 400 580 V640Z" fill="#6EA650" opacity=".35"/>
${tufts}${flowers}`;
}

// ---------------------------------------------------------------- landmarks

const BROOK_A = 'M330 170 C326 196 300 200 296 226 C292 252 236 262 204 264';
const BROOK_B = 'M204 264 C182 266 168 280 160 296';

export function brookSVG(pond: boolean): string {
  const stones = pond
    ? ''
    : `<g transform="translate(206 264)">${shadow(20, 6, 6)}<ellipse cx="-8" cy="2" rx="9" ry="6" fill="#9AA0A0" stroke="#6D7373"/><ellipse cx="6" cy="0" rx="10" ry="7" fill="#AEB4B3" stroke="#6D7373"/><path d="M-16 -6 L18 6" stroke="${C.woodDark}" stroke-width="5" stroke-linecap="round"/><path d="M-10 -10 L-4 -16" stroke="${C.woodDark}" stroke-width="2.5" stroke-linecap="round"/></g>`;
  return `<path d="${BROOK_A}" stroke="#6E8F55" stroke-width="30" fill="none" stroke-linecap="round" opacity=".5"/>
<path d="${BROOK_A}" stroke="${C.waterDark}" stroke-width="22" fill="none" stroke-linecap="round"/>
<path d="${BROOK_A}" stroke="${C.water}" stroke-width="15" fill="none" stroke-linecap="round"/>
<path class="flow" d="${BROOK_A}" stroke="#D4F1F7" stroke-width="2" fill="none" stroke-dasharray="6 18" stroke-linecap="round"/>
${
  pond
    ? `<path class="brook-new" d="${BROOK_B}" stroke="${C.waterDark}" stroke-width="20" fill="none" stroke-linecap="round"/><path class="brook-new" d="${BROOK_B}" stroke="${C.water}" stroke-width="13" fill="none" stroke-linecap="round"/><path class="flow" d="${BROOK_B}" stroke="#D4F1F7" stroke-width="2" fill="none" stroke-dasharray="6 18"/>`
    : `<path d="${BROOK_B}" stroke="#A98A62" stroke-width="16" fill="none" stroke-linecap="round" opacity=".6"/>`
}
${stones}`;
}

export function bridgeSVG(restored: boolean): string {
  // Spans the brook horizontally around (298, 214).
  const x0 = 256;
  const x1 = 340;
  const y = 220;
  const lift = 14;
  const at = (t: number) => ({ x: x0 + (x1 - x0) * t, y: y - lift * Math.sin(Math.PI * t) });
  if (restored) {
    let planks = '';
    for (let i = 0; i <= 12; i++) {
      const p = at(i / 12);
      planks += `<rect class="plank" style="--d:${i * 55}ms" x="${(p.x - 3.6).toFixed(1)}" y="${(p.y - 6).toFixed(1)}" width="7.2" height="13" rx="1.4" fill="${i % 2 ? C.wood : '#C48D5E'}" stroke="${C.woodDark}" stroke-width=".9"/>`;
    }
    let posts = '';
    let rail = '';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = at(t);
      posts += `<rect class="post" x="${(p.x - 1.8).toFixed(1)}" y="${(p.y - 22).toFixed(1)}" width="3.6" height="17" fill="${C.woodDark}"/>`;
    }
    for (let i = 0; i <= 20; i++) {
      const p = at(i / 20);
      rail += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${(p.y - 20).toFixed(1)} `;
    }
    return `<g class="landmark" data-landmark="bridge">${shadow(46, 8, 230, 298)}${planks}${posts}<path class="rail" d="${rail}" stroke="${C.woodDark}" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="246" y="186" width="104" height="56" fill="transparent"/></g>`;
  }
  const a = at(0);
  const b = at(1);
  return `<g class="landmark broken" data-landmark="bridge">
<rect x="${a.x - 2}" y="${a.y - 18}" width="4" height="22" fill="${C.woodDark}"/>
<rect x="${b.x - 2}" y="${b.y - 12}" width="4" height="16" fill="${C.woodDark}" transform="rotate(14 ${b.x} ${b.y})"/>
<rect x="${a.x - 4}" y="${a.y - 6}" width="18" height="12" rx="1.4" fill="${C.wood}" stroke="${C.woodDark}"/>
<rect x="${b.x - 14}" y="${b.y - 4}" width="13" height="11" rx="1.4" fill="${C.wood}" stroke="${C.woodDark}" transform="rotate(-8 ${b.x} ${b.y})"/>
<path d="M${a.x} ${a.y - 16} Q${(a.x + b.x) / 2} ${a.y + 10} ${b.x} ${b.y - 10}" stroke="#8C7A5E" stroke-width="1.6" fill="none" stroke-dasharray="3 2"/>
<rect x="278" y="236" width="18" height="6" rx="1.5" fill="${C.wood}" stroke="${C.woodDark}" transform="rotate(24 287 239)"/>
<rect x="318" y="244" width="16" height="6" rx="1.5" fill="${C.wood}" stroke="${C.woodDark}" transform="rotate(-30 326 247)"/>
<g class="hint-ring"><circle cx="298" cy="214" r="34" fill="none" stroke="${C.cream}" stroke-width="2.5" stroke-dasharray="6 6"/></g>
<rect x="246" y="186" width="104" height="66" fill="transparent"/></g>`;
}

export function pondSVG(restored: boolean): string {
  const cx = 102;
  const cy = 318;
  if (restored) {
    const stones = [
      [-80, 4], [-70, -18], [-44, -32], [-10, -38], [26, -36], [58, -26], [80, -6], [74, 18], [46, 34], [8, 40], [-30, 36], [-62, 24],
    ]
      .map(([x, y], i) => `<ellipse cx="${cx + x}" cy="${cy + y}" rx="${7 + (i % 3)}" ry="5" fill="${i % 2 ? '#B6BCBA' : '#9EA5A4'}" stroke="#727978" stroke-width=".8"/>`)
      .join('');
    let padN = 0;
    const pad = (x: number, y: number, r: number, flower?: string) =>
      `<g transform="translate(${cx + x} ${cy + y})"><g class="pad" style="--d:${padN++ * 140}ms"><path d="M0 0 L${r} -2 A${r} ${r * 0.55} 0 1 1 ${r} 2Z" fill="#5E9E45" stroke="#3F7A3A" stroke-width=".8"/>${
        flower ? `<g transform="translate(-2 -3)"><ellipse cx="-3" cy="0" rx="3" ry="2" fill="${flower}"/><ellipse cx="3" cy="0" rx="3" ry="2" fill="${flower}"/><ellipse cx="0" cy="-2" rx="2.4" ry="3" fill="${flower}"/><circle r="1.3" cx="0" cy="0" fill="#F2B632"/></g>` : ''
      }</g></g>`;
    const ripples = [
      [-18, 4, 0],
      [30, 2, 1.3],
      [-46, -8, 2.4],
    ]
      .map(([x, y, d]) => `<ellipse class="ripple" style="animation-delay:${d}s" cx="${cx + x}" cy="${cy + y}" rx="7" ry="2.6" fill="none" stroke="#E6F7FB" stroke-width="1.4"/>`)
      .join('');
    const reeds = [-70, -62, 66, 72]
      .map((x, i) => `<path d="M${cx + x} ${cy - 14} q${i % 2 ? 3 : -3} -18 ${i % 2 ? 1 : -1} -30" stroke="#4E8A3A" stroke-width="2.4" fill="none"/><rect x="${cx + x - 2 + (i % 2 ? 1 : -1)}" y="${cy - 50}" width="4" height="10" rx="2" fill="#8D6238"/>`)
      .join('');
    return `<g class="landmark" data-landmark="pond">${shadow(90, 44, cy + 6, cx)}<ellipse class="pond-water" cx="${cx}" cy="${cy}" rx="82" ry="38" fill="url(#gWater)" stroke="${C.waterDark}" stroke-width="2"/>${ripples}<g class="shimmer"><path d="M${cx - 40} ${cy - 6} q10 -4 20 0 M${cx + 6} ${cy + 10} q10 -4 20 0 M${cx - 10} ${cy - 18} q8 -3 16 0" stroke="#E6F7FB" stroke-width="2" fill="none" stroke-linecap="round"/></g>${pad(-36, 10, 12, '#F59AAA')}${pad(24, -12, 10)}${pad(40, 14, 11, '#FFFDF5')}${pad(-8, -20, 8)}${stones}${reeds}<rect x="${cx - 86}" y="${cy - 44}" width="172" height="88" fill="transparent"/></g>`;
  }
  let cracks = '';
  const r = rng(3);
  for (let i = 0; i < 9; i++) {
    const x = cx - 50 + r() * 100;
    const y = cy - 14 + r() * 28;
    cracks += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l${(r() * 14 - 7).toFixed(0)} ${(r() * 8 - 4).toFixed(0)} l${(r() * 12 - 6).toFixed(0)} ${(r() * 8 - 4).toFixed(0)}" stroke="#7E5836" stroke-width="1.2" fill="none"/>`;
  }
  const deadReeds = [-66, -58, 62]
    .map((x, i) => `<path d="M${cx + x} ${cy - 10} q${i ? 6 : -6} -14 ${i ? 12 : -10} -18" stroke="#9C7A4C" stroke-width="2" fill="none"/>`)
    .join('');
  return `<g class="landmark broken" data-landmark="pond">${shadow(90, 44, cy + 6, cx)}<ellipse cx="${cx}" cy="${cy}" rx="82" ry="38" fill="#8E6A45"/><ellipse cx="${cx}" cy="${cy + 3}" rx="74" ry="32" fill="url(#gDryPond)"/>${cracks}<ellipse cx="${cx + 18}" cy="${cy + 8}" rx="12" ry="4" fill="${C.water}" opacity=".55"/>${deadReeds}<g class="hint-ring"><ellipse cx="${cx}" cy="${cy}" rx="94" ry="48" fill="none" stroke="${C.cream}" stroke-width="2.5" stroke-dasharray="6 6"/></g><rect x="${cx - 86}" y="${cy - 44}" width="172" height="88" fill="transparent"/></g>`;
}

/** Dry weeds that fade as the garden wakes up. */
export function wildSVG(progress: number): string {
  if (progress >= 1) return '';
  const spots = [
    [30, 236], [158, 214], [376, 260], [372, 376], [20, 396], [384, 500], [12, 612], [380, 616],
  ];
  return `<g opacity="${(1 - progress).toFixed(2)}">${spots
    .map(
      ([x, y]) =>
        `<path d="M${x - 9} ${y} q2 -14 -3 -22 M${x} ${y} q-1 -16 4 -24 M${x + 8} ${y} q3 -10 8 -14" stroke="#A4875A" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    )
    .join('')}</g>`;
}

export function hazeSVG(progress: number): string {
  const o = 0.2 * (1 - progress);
  return o > 0.01 ? `<rect x="-400" y="-300" width="1200" height="1300" fill="#B5AC98" opacity="${o.toFixed(3)}" pointer-events="none"/>` : '';
}

export function lifeSVG(s: GameState): string {
  const p = gardenProgress(s);
  let out = '';
  const butterfly = (cls: string, a: string, b: string) =>
    `<g class="butterfly ${cls}"><g class="wings"><ellipse cx="-4" cy="0" rx="4.5" ry="3.4" fill="${a}" stroke="${C.ink}" stroke-width=".5"/><ellipse cx="4" cy="0" rx="4.5" ry="3.4" fill="${b}" stroke="${C.ink}" stroke-width=".5"/></g><rect x="-.6" y="-3" width="1.2" height="6" rx=".6" fill="${C.ink}"/></g>`;
  if (p > 0.15) out += butterfly('b1', '#F6BE3B', '#F6D16B');
  if (p > 0.45) out += butterfly('b2', '#F59AAA', '#F7B8C3');
  if (s.restored.pond) {
    out += `<g class="fireflies">${[
      [60, 270], [150, 300], [40, 340], [180, 350],
    ]
      .map(([x, y], i) => `<circle class="firefly f${i}" cx="${x}" cy="${y}" r="2" fill="#FFF3A8"/>`)
      .join('')}</g>`;
  }
  return out;
}

// ---------------------------------------------------------------- plots & slots

/** A plant as it stands in a bed: wrapped for the pop (growth) and sway animations. */
export function bedPlant(plant: PlantId, stage: 0 | 1 | 2 | 3, golden: boolean): string {
  const gold = golden && stage >= 3;
  return `${gold ? goldenAura() : ''}<g transform="translate(0 -2) scale(1.35)"><g class="pop"><g class="sway"${gold ? ' filter="url(#fGold)"' : ''}>${plantArt(plant, stage)}</g></g></g>${gold ? goldenSparkles() : ''}`;
}

/**
 * The bed itself (static between state changes). The progress bar lives in plotBarSVG,
 * so the once-a-second update does not restart the plant's animations.
 */
export function plotSVG(s: GameState, i: number, now: number): string {
  const { x, y } = plotPos(i);
  const st = plotStatus(s, i, now);
  const p = s.plots[i];
  const area = plotArea(i);
  let inner = area === 'garden' || area === 'veg' ? plotBed(st === 'growing') : wildBed(st === 'growing', area === 'steppe' ? '#7A5A3A' : area === 'tundra' ? '#6F6A50' : '#5E4A34');
  let badge = '';
  let label = `Грядка ${i + 1}`;
  const bloom = st === 'ready' && p.stage >= 3;
  if (st === 'locked') {
    inner += brambles();
    label += ': заросла';
  } else if (p.plant) {
    inner += bedPlant(p.plant, p.stage, p.golden);
    if (st === 'thirsty') badge = `<g transform="translate(34 -40)">${waterBadge()}</g>`;
    else if (bloom) badge = `<g transform="translate(36 -48)">${readyBadge()}</g>`;
    label += `: ${st === 'thirsty' ? 'хочет пить' : bloom ? (p.golden ? 'золотой цветок, можно собрать' : 'можно собрать') : 'растёт'}`;
  } else {
    label += ': пустая';
  }
  const cls = `plot st-${st}${bloom ? ' bloom' : ''}${bloom && p.golden ? ' golden' : ''}`;
  return `<g class="${cls}" data-plot="${i}" transform="translate(${x} ${y})" role="button" aria-label="${label}"><rect x="-58" y="-96" width="116" height="134" fill="transparent"/>${inner}${badge}</g>`;
}

export function plotBarSVG(s: GameState, i: number, now: number): string {
  const st = plotStatus(s, i, now);
  const p = s.plots[i];
  if (!p.plant || st !== 'growing') return '';
  const { x, y } = plotPos(i);
  // Quantised so the bar only re-renders when it visibly moves.
  const frac = Math.round(stageProgress(p, now) * 50) / 50;
  return `<g transform="translate(${x} ${y + 30})" pointer-events="none">${progressBar(frac)}</g>`;
}

export function slotSVG(s: GameState, i: number, decorMode: boolean, selected: DecoId | null): string {
  const { x, y } = SLOTS[i];
  const id = s.decor.placed[i];
  const content = id ? `<g class="deco-in">${decoArt(id)}</g>` : '';
  const hint =
    decorMode && !id
      ? `<ellipse class="slot-hint${selected ? ' active' : ''}" cx="0" cy="0" rx="24" ry="10" fill="${C.cream}" fill-opacity=".35" stroke="${C.cream}" stroke-width="2.4" stroke-dasharray="5 4"/>`
      : '';
  if (!content && !decorMode) return '';
  return `<g class="slot${decorMode ? ' editable' : ''}" data-slot="${i}" transform="translate(${x} ${y})" role="button" aria-label="Место для украшения ${i + 1}"><rect x="-30" y="-80" width="60" height="96" fill="transparent"/>${hint}${content}</g>`;
}

// ---------------------------------------------------------------- vegetable patch

/** Signpost in the garden that leads to the vegetable patch. */
export function vegSignSVG(open: boolean, available: boolean): string {
  const lock = open
    ? ''
    : `<g transform="translate(20 -50)"><rect x="-6" y="-4" width="12" height="10" rx="2" fill="#E2B94E" stroke="${C.woodDark}" stroke-width="1.2"/><path d="M-3.5 -4 v-3 a3.5 3.5 0 0 1 7 0 v3" stroke="${C.woodDark}" stroke-width="1.6" fill="none"/></g>`;
  return `<g class="signpost${!open && available ? ' ready' : ''}" data-go="veg" transform="translate(372 216)" role="button" aria-label="Указатель: ${open ? 'перейти в огород' : 'заросший огород'}">
<rect x="-30" y="-66" width="56" height="74" fill="transparent"/>
${shadow(12, 4, 1)}<rect x="-2.2" y="-52" width="4.4" height="52" fill="${C.woodDark}"/>
<path d="M-26 -54 H14 L24 -45 L14 -36 H-26Z" fill="#D9A06A" stroke="${C.woodDark}" stroke-width="1.6" stroke-linejoin="round"/>
<text x="-6" y="-41" font-size="10.5" font-weight="800" text-anchor="middle" fill="${C.ink}">Огород</text>
${lock}${!open && available ? `<g class="hint-ring"><circle cx="0" cy="-36" r="34" fill="none" stroke="${C.cream}" stroke-width="2.5" stroke-dasharray="6 6"/></g>` : ''}</g>`;
}

/** Background of the vegetable patch view (static). */
export function vegBackgroundSVG(): string {
  let rows = '';
  for (let y = 360; y <= 620; y += 14) rows += `<path d="M30 ${y} Q200 ${y - 6} 370 ${y}" stroke="#7A5134" stroke-width="1.2" fill="none" opacity=".25"/>`;
  const shed = `<g transform="translate(316 300)">${shadow(54, 10, 2)}<rect x="-46" y="-58" width="92" height="60" fill="#C99A6B" stroke="${C.woodDark}" stroke-width="2"/>${[-34, -18, -2, 14, 30]
    .map((x) => `<path d="M${x} -58 V2" stroke="${C.woodDark}" stroke-width="1" opacity=".5"/>`)
    .join('')}<path d="M-54 -56 L0 -92 L54 -56Z" fill="#B5543F" stroke="#7E3527" stroke-width="2" stroke-linejoin="round"/><rect x="-12" y="-36" width="24" height="38" rx="2" fill="#8D6238" stroke="${C.woodDark}" stroke-width="1.6"/><circle cx="7" cy="-16" r="1.8" fill="#E2B94E"/><rect class="window" x="-38" y="-46" width="18" height="16" rx="2" fill="#BFE3EE" stroke="${C.woodDark}" stroke-width="1.6"/><path d="M-29 -46 v16 M-38 -38 h18" stroke="${C.woodDark}" stroke-width="1.2"/><g transform="translate(36 -2)"><rect x="-4" y="-22" width="3" height="22" fill="${C.woodDark}" transform="rotate(-10)"/><path d="M-12 -24 h14 l-2 6 h-10Z" fill="#9AA0A0" stroke="#6D7373" transform="rotate(-10)"/></g></g>`;
  const barrel = `<g transform="translate(330 380)">${shadow(16, 5, 2)}<rect x="-14" y="-32" width="28" height="32" rx="5" fill="#B47E52" stroke="${C.woodDark}" stroke-width="1.6"/><path d="M-14 -24 h28 M-14 -8 h28" stroke="#6D7373" stroke-width="2.4"/><ellipse cx="0" cy="-32" rx="14" ry="4" fill="${C.water}" stroke="${C.woodDark}" stroke-width="1.4"/></g>`;
  let border = '';
  for (let x = 24; x <= 376; x += 22) border += `<rect x="${x - 3}" y="362" width="6" height="16" rx="2" fill="#B48A62" stroke="${C.woodDark}"/>`;
  return `${backgroundSVG(11)}
<path d="M18 370 Q200 352 382 370 L392 630 Q200 650 8 630Z" fill="#B88A5E" opacity=".5"/>${rows}
<path d="M20 370 Q200 356 380 370" stroke="${C.woodDark}" stroke-width="3" fill="none"/>${border}
${shed}${barrel}`;
}

// ---------------------------------------------------------------- natural zones

function fir(x: number, y: number, h: number, tone: string) {
  const w = h * 0.38;
  return `<g transform="translate(${x} ${y})"><rect x="-1.6" y="-6" width="3.2" height="7" fill="#4A3220"/><path d="M0 ${-h} L${w * 0.55} ${-h * 0.62} L${w * 0.32} ${-h * 0.62} L${w * 0.8} ${-h * 0.3} L${w * 0.5} ${-h * 0.3} L${w} -4 L${-w} -4 L${-w * 0.5} ${-h * 0.3} L${-w * 0.8} ${-h * 0.3} L${-w * 0.32} ${-h * 0.62} L${-w * 0.55} ${-h * 0.62}Z" fill="${tone}"/></g>`;
}

/** Static background of a natural zone. */
export function zoneBackgroundSVG(zone: ZoneId): string {
  const r = rng(zone === 'tundra' ? 23 : zone === 'taiga' ? 29 : 31);
  if (zone === 'tundra') {
    let snow = '';
    for (let i = 0; i < 9; i++) snow += `<ellipse cx="${Math.round(r() * 400)}" cy="${Math.round(230 + r() * 400)}" rx="${10 + Math.round(r() * 18)}" ry="${3 + Math.round(r() * 4)}" fill="#F4F7F8" opacity=".85"/>`;
    let shrubs = '';
    for (let i = 0; i < 26; i++) {
      const x = Math.round(r() * 400);
      const y = Math.round(230 + r() * 410);
      shrubs += `<circle cx="${x}" cy="${y}" r="${2 + Math.round(r() * 2)}" fill="${i % 3 ? '#8E9E6A' : '#B5874A'}"/>`;
    }
    return `<rect x="-400" y="-300" width="1200" height="520" fill="#DCE7EC"/><circle cx="320" cy="70" r="24" fill="#FFF3D6" opacity=".8"/>
<path d="M-400 160 L-40 92 L40 140 L120 80 L210 136 L300 70 L400 128 L800 100 V220 H-400Z" fill="#B8C4C8"/><path d="M110 82 L120 80 L132 92 Z M290 76 L300 70 L312 84Z" fill="#F4F7F8"/>
<path d="M-400 180 Q0 150 400 170 Q600 175 800 170 V230 H-400Z" fill="#AAB58C"/>
<rect x="-400" y="200" width="1200" height="800" fill="#A8B887"/>${snow}<ellipse cx="320" cy="300" rx="44" ry="12" fill="#7FA9B4" opacity=".7"/><ellipse cx="70" cy="390" rx="34" ry="9" fill="#7FA9B4" opacity=".6"/>${shrubs}`;
  }
  if (zone === 'taiga') {
    let far = '';
    for (let x = -20; x < 430; x += 22) far += fir(x, 170 + Math.round(r() * 8), 54 + Math.round(r() * 26), '#3E6B45');
    let near = '';
    for (const [x, y, h] of [[18, 330, 110], [384, 320, 120], [40, 640, 120], [370, 640, 110], [350, 400, 90], [22, 470, 96]]) near += fir(x, y, h, '#2F5A36');
    let moss = '';
    for (let i = 0; i < 22; i++) moss += `<circle cx="${Math.round(r() * 400)}" cy="${Math.round(240 + r() * 400)}" r="${2 + Math.round(r() * 3)}" fill="${i % 4 ? '#5E8C4A' : '#D8303A'}"/>`;
    const log = `<g transform="translate(200 360)"><rect x="-60" y="-9" width="120" height="18" rx="9" fill="#8A6A4A" stroke="#5E4530" stroke-width="1.4"/><ellipse cx="60" cy="0" rx="6" ry="9" fill="#C9A47A" stroke="#5E4530" stroke-width="1.2"/><g transform="translate(-30 -8)"><path d="M-3 0 v-6" stroke="#F1EAD8" stroke-width="2.4"/><ellipse cx="-3" cy="-7" rx="6" ry="3.4" fill="#C9302A"/><circle cx="-5" cy="-8" r=".9" fill="#fff"/><circle cx="-1" cy="-7.4" r=".9" fill="#fff"/></g></g>`;
    return `<rect x="-400" y="-300" width="1200" height="520" fill="#DCEBE0"/>${far}<rect x="-400" y="176" width="1200" height="800" fill="#6E9A55"/>${moss}${log}${near}`;
  }
  let grass = '';
  for (let i = 0; i < 60; i++) {
    const x = Math.round(r() * 400);
    const y = Math.round(220 + r() * 420);
    grass += `<path d="M${x} ${y} q-2 -9 -5 -12 M${x} ${y} q1 -10 3 -14 M${x} ${y} q3 -8 7 -10" stroke="${i % 3 ? '#B39A52' : '#9A8A4A'}" stroke-width="1.4" fill="none"/>`;
  }
  let flowers = '';
  for (let i = 0; i < 14; i++) flowers += `<circle cx="${Math.round(r() * 400)}" cy="${Math.round(260 + r() * 360)}" r="2" fill="${['#E5546B', '#F6D34B', '#B79BE3'][i % 3]}"/>`;
  return `<rect x="-400" y="-300" width="1200" height="520" fill="#F7E8C8"/><circle cx="300" cy="70" r="28" fill="#FFD77A" opacity=".9"/>
<path d="M-400 182 Q100 168 200 176 Q300 160 360 172 Q600 178 800 180 V230 H-400Z" fill="#CDB87A"/><path d="M230 176 Q260 150 292 176Z" fill="#B9A262"/>
<rect x="-400" y="190" width="1200" height="800" fill="#D9C27A"/>${grass}${flowers}`;
}

/** Signpost in a natural zone that leads back home. */
export function zoneBackSignSVG(): string {
  return `<g class="signpost" data-go="garden" transform="translate(52 300)" role="button" aria-label="Указатель: вернуться домой, в сад">
<rect x="-34" y="-66" width="68" height="74" fill="transparent"/>
${shadow(12, 4, 1)}<rect x="-2.2" y="-52" width="4.4" height="52" fill="${C.woodDark}"/>
<path d="M28 -54 H-14 L-24 -45 L-14 -36 H28Z" fill="#D9A06A" stroke="${C.woodDark}" stroke-width="1.6" stroke-linejoin="round"/>
<text x="6" y="-41" font-size="11" font-weight="800" text-anchor="middle" fill="${C.ink}">Домой</text></g>`;
}

/** Signpost in the vegetable patch that leads back to the garden. */
export function backSignSVG(): string {
  return `<g class="signpost" data-go="garden" transform="translate(52 330)" role="button" aria-label="Указатель: вернуться в сад">
<rect x="-34" y="-66" width="68" height="74" fill="transparent"/>
${shadow(12, 4, 1)}<rect x="-2.2" y="-52" width="4.4" height="52" fill="${C.woodDark}"/>
<path d="M26 -54 H-14 L-24 -45 L-14 -36 H26Z" fill="#D9A06A" stroke="${C.woodDark}" stroke-width="1.6" stroke-linejoin="round"/>
<text x="6" y="-41" font-size="11" font-weight="800" text-anchor="middle" fill="${C.ink}">Сад</text></g>`;
}

// ---------------------------------------------------------------- day & night

export type DayPhase = 'day' | 'evening' | 'night';

/** Day phase by the device's local clock. */
export function dayPhase(hour: number): DayPhase {
  if (hour >= 21 || hour < 6) return 'night';
  if (hour >= 18) return 'evening';
  return 'day';
}

/** Tint, stars and moon drawn above the scene (below the lights). */
export function skySVG(phase: DayPhase): string {
  if (phase === 'day') return '';
  if (phase === 'evening') {
    return `<rect x="-400" y="-300" width="1200" height="1300" fill="#F29A4A" opacity=".13" pointer-events="none"/><rect x="-400" y="-300" width="1200" height="460" fill="#F5B0A0" opacity=".18" pointer-events="none"/>`;
  }
  const r = rng(19);
  let stars = '';
  for (let i = 0; i < 26; i++) {
    const x = Math.round(r() * 400);
    const y = Math.round(-140 + r() * 270);
    stars += `<circle class="star${i % 3 ? '' : ' tw'}" style="animation-delay:${(r() * 3).toFixed(1)}s" cx="${x}" cy="${y}" r="${(0.8 + r() * 1.2).toFixed(1)}" fill="#FFF8D6"/>`;
  }
  return `<g pointer-events="none"><rect x="-400" y="-300" width="1200" height="1300" fill="#1C2754" opacity=".46"/>${stars}<g transform="translate(330 64)"><circle r="26" fill="#FFF3B8" opacity=".18"/><circle r="17" fill="#FFF6D8"/><circle cx="6" cy="-4" r="15" fill="#2B3768" opacity=".9"/></g></g>`;
}

/** Warm lights that shine through the night tint. */
export function lightsSVG(spots: { x: number; y: number; r: number; color?: string }[]): string {
  return spots
    .map((p) => `<circle class="night-glow" cx="${p.x}" cy="${p.y}" r="${p.r}" fill="url(#${p.color ?? 'gLampGlow'})" pointer-events="none"/>`)
    .join('');
}

// ---------------------------------------------------------------- order board

export const BOARD = { x: 40, y: 244 };

/** The notice board where guests pin their requests. Appears once orders are unlocked. */
export function boardSVG(s: GameState): string {
  if (!ordersAvailable(s) || !s.order) return '';
  const o = s.order;
  const done = orderComplete(s);
  const have = o.items.reduce((n, it) => n + Math.min(it.have, it.need), 0);
  const need = o.items.reduce((n, it) => n + it.need, 0);
  const badge = done ? `<g transform="translate(22 -70)">${readyBadge()}</g>` : '';
  return `<g class="board${done ? ' done' : ''}" data-board="1" transform="translate(${BOARD.x} ${BOARD.y})" role="button" aria-label="Доска просьб: ${done ? 'просьба выполнена' : `собрано ${have} из ${need}`}">
<rect x="-34" y="-86" width="68" height="96" fill="transparent"/>
${shadow(24, 6, 1)}
<rect x="-20" y="-40" width="4" height="40" fill="${C.woodDark}"/><rect x="16" y="-40" width="4" height="40" fill="${C.woodDark}"/>
<rect x="-26" y="-62" width="52" height="34" rx="3" fill="#C99A6B" stroke="${C.woodDark}" stroke-width="1.6"/>
<path d="M-30 -61 L0 -73 L30 -61Z" fill="#8D6238" stroke="#5E3B26" stroke-width="1.2" stroke-linejoin="round"/>
<g class="note" transform="rotate(-4 0 -45)"><rect x="-19" y="-58" width="38" height="27" rx="2" fill="${C.cream}" stroke="#D9C29A" stroke-width="1"/>
<g transform="translate(-7 -35) scale(.48)">${guestArt(o.from)}</g>
<text x="10" y="-38" font-size="10" font-weight="800" text-anchor="middle" fill="${done ? '#3E8E3A' : C.ink}">${have}/${need}</text>
<circle cx="0" cy="-56" r="2.2" fill="#E5546B"/></g>
${badge}</g>`;
}

// ---------------------------------------------------------------- one-shot effects

/** Watering can tilts above the bed and pours. */
export function wateringFx(x: number, y: number): string {
  const drops = [-16, -8, 0, 8, 16, -4, 4]
    .map(
      (dx, i) =>
        `<path class="pour" style="animation-delay:${(0.28 + i * 0.07).toFixed(2)}s" d="M${dx} -56 q3.5 5 0 8 q-3.5 -3 0 -8Z" fill="${C.water}" stroke="${C.waterDark}" stroke-width=".6"/>`,
    )
    .join('');
  return `<g transform="translate(${x} ${y})"><g transform="translate(-36 -74)"><g class="can-tilt">${wateringCan()}</g></g>${drops}<ellipse class="splash" cx="0" cy="-4" rx="30" ry="9" fill="none" stroke="#A9D9E6" stroke-width="2"/></g>`;
}

/** A seed falls into the bed with a little puff of soil. */
export function plantFx(x: number, y: number): string {
  const puffs = [-1, 1]
    .map((side) => `<circle class="puff" style="--dx:${side * 18}px" cx="${side * 6}" cy="-2" r="4" fill="#B58A62"/>`)
    .join('');
  return `<g transform="translate(${x} ${y})"><ellipse class="seed-fall" cx="0" cy="-60" rx="5" ry="3.4" fill="#E7C78F" stroke="${C.woodDark}" stroke-width="1"/>${puffs}</g>`;
}

/** The picked flower jumps out of the bed and fades. */
export function pluckFx(x: number, y: number, plant: PlantId, golden: boolean): string {
  return `<g transform="translate(${x} ${y})"><g class="pluck">${bedPlant(plant, 3, golden)}</g></g>`;
}

/** Ring of light, used for growth steps and restorations. */
export function ringFx(x: number, y: number, color = '#FFF3B8', r = 40): string {
  return `<g transform="translate(${x} ${y})"><circle class="ring" r="${r}" fill="none" stroke="${color}" stroke-width="4"/></g>`;
}

/** Hearts above a guest the player has just met. */
export function heartsFx(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})">${[-14, 0, 14]
    .map(
      (dx, i) =>
        `<path class="heart" style="--dx:${dx}px;animation-delay:${i * 0.1}s" d="M0 4 C-7 -1 -6 -8 -1.5 -7 Q0 -6.6 0 -5 Q0 -6.6 1.5 -7 C6 -8 7 -1 0 4Z" fill="#F07A8E" stroke="#C25A6E" stroke-width=".8"/>`,
    )
    .join('')}</g>`;
}

/** Sparkle burst shown after an action. */
export function burstSVG(x: number, y: number, kind: 'water' | 'harvest' | 'magic'): string {
  if (kind === 'water') {
    return `<g class="burst" transform="translate(${x} ${y})">${[-14, -4, 6, 16]
      .map((dx, i) => `<path class="drop d${i}" d="M${dx} -60 q4 6 0 9 q-4 -3 0 -9Z" fill="${C.water}" stroke="${C.waterDark}" stroke-width=".6"/>`)
      .join('')}</g>`;
  }
  const col = kind === 'magic' ? '#FFF3B8' : '#F59AAA';
  const n = kind === 'magic' ? 12 : 8;
  return `<g class="burst" transform="translate(${x} ${y - 40})">${Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    return `<g class="spark" style="--dx:${(Math.cos(a) * 34).toFixed(0)}px;--dy:${(Math.sin(a) * 26).toFixed(0)}px">${leaf(0, 0, 8, (a * 180) / Math.PI, col, false)}</g>`;
  }).join('')}</g>`;
}

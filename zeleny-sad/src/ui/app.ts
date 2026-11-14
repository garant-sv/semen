// The game UI: HUD, Listik's quest card, the diorama, bottom navigation and sheets.

import {
  DECORATIONS,
  DECO_IDS,
  AREA_PLANTS,
  FLOWER_IDS,
  ZONE_ATLAS,
  ZONE_IDS,
  areaPlots,
  plotArea,
  GUESTS,
  GUEST_IDS,
  LANDMARKS,
  LISTIK_TIPS,
  PLANTS,
  PLANT_IDS,
  PLOT_COUNT,
  QUESTS,
  SLOT_COUNT,
  TOTAL_PLOTS,
  VEG_IDS,
  TUNDRA_IDS,
  TAIGA_IDS,
  STEPPE_IDS,
  type AreaId,
  type ZoneId,
  STAGE_NAMES,
  type DecoId,
  type Goal,
  type GuestId,
  type Landmark,
  type PlantId,
  type Quest,
} from '../game/data';
import {
  advance,
  buyDecoration,
  advanceFair,
  answerQuiz,
  answerSign,
  checkQuests,
  checkQuiz,
  claimOrder,
  currentQuest,
  ensureOrder,
  meetGuest,
  nextCustomerIn,
  orderComplete,
  pickQuestion,
  serveCustomer,
  type FairResult,
  visitingGuests,
  decorAvailable,
  formatDuration,
  freeDecorations,
  gradeOf,
  setProfile,
  gardenProgress,
  goalDone,
  harvest,
  landmarkAvailable,
  newGame,
  placeDecoration,
  plantSeed,
  plotStatus,
  remainingMs,
  removeDecoration,
  restore,
  water,
  type GameState,
  type GrowthChange,
} from '../game/state';
import { setTelemetryEnabled, setTelemetryGrade, telemetryEnabled, track } from '../telemetry';
import {
  exportSave,
  importSave,
  loadGame,
  saveGame,
  type LoadResult,
  type StorageError,
  type StorageLike,
} from '../game/save';
import { BADGES, earned, newBadges } from '../game/badges';
import type { Question } from '../game/quiz';
import { fairLevel, makeProblem, type MathProblem } from '../game/math';
import { NO_LETTER, RULES, WORDS, viewWord, type RuleId } from '../game/russian';
import { ICONS, SHARED_DEFS, decoIcon, gradeIcon, guestArt, guestIcon, listik, medalIcon, meetScene, petalIcon, plantIcon, starIcon } from './art';
import {
  BOARD,
  PLOTS,
  STALL,
  stallSVG,
  SLOTS,
  VEG_PLOTS,
  backSignSVG,
  backgroundSVG,
  boardSVG,
  frontSVG,
  dayPhase,
  lightsSVG,
  plotPos,
  skySVG,
  vegBackgroundSVG,
  vegSignSVG,
  zoneBackgroundSVG,
  zoneBackSignSVG,
  type DayPhase,
  bridgeSVG,
  brookSVG,
  burstSVG,
  hazeSVG,
  heartsFx,
  lifeSVG,
  plantFx,
  plotBarSVG,
  plotSVG,
  pluckFx,
  pondSVG,
  ringFx,
  slotSVG,
  wateringFx,
  wildSVG,
} from './scene';
import { Depth, requestTilt, tiltNeedsPermission } from './depth';
import { play, setSoundEnabled } from './sound';

export interface AppDeps {
  storage: StorageLike | null;
  storageError?: StorageError;
  now?: () => number;
}

type Mode = 'garden' | 'decor';

/** Where guests may appear, by their favourite place (scene coordinates). */
const GUEST_SPOTS: Record<'meadow' | 'pond', [number, number][]> = {
  meadow: [
    [30, 492],
    [372, 486],
    [140, 506],
    [262, 506],
    [200, 612],
    [372, 588],
    [28, 590],
    [200, 380],
    [330, 250],
  ],
  pond: [
    [44, 360],
    [168, 352],
    [186, 300],
  ],
};

/** Seconds a guest stays before leaving. */
const GUEST_STAY: Partial<Record<GuestId, number>> = {
  ladybug: 14,
  snail: 20,
  bee: 12,
  butterfly: 12,
};

/** Places in a natural zone where its animals may appear. */
const ZONE_SPOTS: [number, number][] = [
  [200, 400],
  [330, 560],
  [70, 580],
  [300, 360],
  [110, 380],
];

const AREA_NAME: Record<AreaId, string> = { garden: 'Сад', veg: 'Огород', tundra: 'Тундра', taiga: 'Тайга', steppe: 'Степь' };

const escapeWord = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const esc = (t: string) => escapeWord(t).replace(/"/g, '&quot;').replace(/>/g, '&gt;');

/** The masked word with the gap filled in and the inserted letter highlighted. */
function highlightWord(masked: string, answer: string): string {
  const k = masked.lastIndexOf('_');
  const ins = answer === NO_LETTER ? '<i class="gap-none">·</i>' : `<i class="gap-fill">${escapeWord(answer)}</i>`;
  return `${escapeWord(masked.slice(0, k))}${ins}${escapeWord(masked.slice(k + 1))}`;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
export const petalsWord = (n: number) => `${n} ${plural(n, 'лепесток', 'лепестка', 'лепестков')}`;

const NEXT_STAGE: Record<number, string> = { 0: 'ростка', 1: 'бутона', 2: 'цветения' };

export class App {
  state: GameState;
  private now: () => number;
  private storage: StorageLike | null;
  private saveError: StorageError | null = null;
  private mode: Mode = 'garden';
  private selectedDeco: DecoId | null = null;
  private questCollapsed = false;
  private cache = new Map<string, string>();
  private wraps = new Map<string, SVGGElement>();
  private sheetOnClose: (() => void) | null = null;
  private tickTimer = 0;
  private hiddenAt = 0;
  private tipIndex = 0;
  /** Plant and stage per bed at the last render: used to animate growth steps. */
  private lastPlots: ({ plant: PlantId; stage: number } | null)[] = [];
  /** Petal counter as shown in the HUD (it counts up while petals fly to it). */
  private shownPetals = 0;
  private flying = 0;
  private guest: { id: GuestId; x: number; y: number; el: SVGGElement; leaveAt: number } | null = null;
  private nextGuestAt = 0;
  private collectionTab: 'plants' | 'guests' | 'words' | 'badges' = 'plants';
  /** Which part of the world is shown: the flower garden or the vegetable patch. */
  private view: AreaId = 'garden';
  private phase: DayPhase = 'day';
  private question: Question | null = null;
  /** The problem of the customer at the front of the queue (kept while the sheet is reopened). */
  private fairTask: { problem: MathProblem; guest: GuestId } | null = null;
  /** Short screens (iPhone SE): the quest card folds itself after the first tap in the garden. */
  private compact = window.innerHeight < 700;
  /** «Живое 2,5D»: parallax of the scene layers. */
  private depth!: Depth;

  constructor(
    private root: HTMLElement,
    deps: AppDeps,
  ) {
    this.now = deps.now ?? (() => Date.now());
    this.storage = deps.storage;
    const loaded = loadGame(this.storage, this.now(), deps.storageError);
    this.state = loaded.state;
    this.shownPetals = this.state.petals;
    this.nextGuestAt = this.now() + 9_000;
    this.mount();
    this.afterLoad(loaded);
  }

  // ------------------------------------------------------------ setup

  private mount() {
    this.root.innerHTML = `${SHARED_DEFS}
<div class="banner" id="banner" role="alert" hidden></div>
<header class="hud">
  <div class="petals" id="petalsBox" aria-label="Лепестки">${petalIcon(26)}<b id="petals">0</b></div>
  <h1 class="title">Зелёный сад</h1>
  <button class="listik-btn" id="listikBtn" type="button" aria-label="Листик: задание">${listik(46)}</button>
</header>
<section class="quest" id="quest" aria-live="polite"></section>
<main class="stage" id="stage">
  <svg id="scene" viewBox="0 0 400 640" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Сад">
    <g id="view-garden"><g id="l-bg">${backgroundSVG()}</g><g id="l-brook"></g><g id="l-pond"></g><g id="l-bridge"></g><g id="l-board"></g><g id="l-stall"></g><g id="l-sign"></g><g id="l-wild"></g><g id="l-haze"></g><g id="l-objects"></g><g id="l-life"></g></g>
    <g id="view-veg" style="display:none"><g id="v-bg">${vegBackgroundSVG()}</g><g id="v-sign">${backSignSVG()}</g><g id="v-objects"></g></g>
    ${ZONE_IDS.map((z) => `<g id="view-${z}" style="display:none"><g>${zoneBackgroundSVG(z)}</g><g>${zoneBackSignSVG()}</g><g id="${z}-objects"></g></g>`).join('')}
    <g id="l-guest"></g>
    <g id="l-front" data-z="near"></g>
    <g id="l-sky"></g><g id="l-lights"></g><g id="l-fx"></g>
  </svg>
  <div class="mode-chip" id="modeChip" hidden></div>
</main>
<nav class="nav" aria-label="Меню игры">
  <button type="button" data-nav="garden" class="active">${ICONS.garden}<span>Сад</span></button>
  <button type="button" data-nav="decor">${ICONS.decor}<span>Украсить</span></button>
  <button type="button" data-nav="map">${ICONS.map}<span>Карта</span></button>
  <button type="button" data-nav="collection">${ICONS.book}<span>Коллекция</span></button>
  <button type="button" data-nav="menu">${ICONS.menu}<span>Меню</span></button>
</nav>
<div class="sheet-backdrop" id="sheetBackdrop" hidden><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<div class="fly-layer" id="flyLayer" aria-hidden="true"></div>
<input type="file" id="importFile" accept="application/json,.json" hidden>`;

    const items = [
      ...PLOTS.map((p, i) => ({ key: `plot-${i}`, y: p.y, layer: '#l-objects' })),
      ...SLOTS.map((p, i) => ({ key: `slot-${i}`, y: p.y, layer: '#l-objects' })),
      ...VEG_PLOTS.map((p, i) => ({ key: `plot-${PLOT_COUNT + i}`, y: p.y, layer: '#v-objects' })),
      ...ZONE_IDS.flatMap((z) => areaPlots(z).map((i) => ({ key: `plot-${i}`, y: plotPos(i).y, layer: `#${z}-objects` }))),
    ].sort((a, b) => a.y - b.y);
    const svgG = () => document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const it of items) {
      const g = svgG();
      g.dataset.wrap = it.key;
      $(this.root, it.layer).appendChild(g);
      this.wraps.set(it.key, g);
      if (it.key.startsWith('plot-')) {
        // Bed and progress bar are separate, so the bar's updates don't restart animations.
        const main = svgG();
        const bar = svgG();
        g.append(main, bar);
        this.wraps.set(`${it.key}-main`, main);
        this.wraps.set(`${it.key}-bar`, bar);
      }
    }

    $(this.root, '#scene').addEventListener('click', (e) => this.onSceneClick(e));
    const stage = $(this.root, '#stage');
    const fit = () => this.fitScene(stage.clientWidth, stage.clientHeight);
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage);
    window.addEventListener('resize', fit);
    fit();
    this.depth = new Depth($(this.root, '#scene') as unknown as SVGSVGElement, stage, reducedMotion);
    this.root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => this.onNav(b.dataset.nav!)),
    );
    $(this.root, '#listikBtn').addEventListener('click', () => {
      if (this.state.quiz.pending) return this.showQuiz();
      this.questCollapsed = !this.questCollapsed;
      play('tap');
      this.renderQuest();
    });
    $(this.root, '#quest').addEventListener('click', (e) => {
      if ((e.target as Element).closest('[data-quest-toggle]')) {
        this.questCollapsed = !this.questCollapsed;
        this.renderQuest();
      }
    });
    $(this.root, '#sheetBackdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeSheet();
    });
    $(this.root, '#importFile').addEventListener('change', (e) => this.onImportFile(e.target as HTMLInputElement));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = this.now();
        this.persist();
      } else {
        this.refresh(this.now() - this.hiddenAt > 30_000);
      }
    });
    window.addEventListener('pagehide', () => this.persist());
    window.addEventListener('focus', () => this.refresh(false));
  }

  /**
   * Fill the stage edge to edge: on short screens crop the sky (never the beds),
   * on very short screens keep the whole garden and let the extended meadow fill the sides.
   */
  private fitScene(w: number, h: number) {
    if (!w || !h) return;
    const visible = (400 * h) / w;
    const MAX_CROP = 150;
    let vb: string;
    if (visible >= 640) vb = `0 ${640 - visible} 400 ${visible}`;
    else if (visible >= 640 - MAX_CROP) vb = `0 ${640 - visible} 400 ${visible}`;
    else vb = `0 ${MAX_CROP} 400 ${640 - MAX_CROP}`;
    $(this.root, '#scene').setAttribute('viewBox', vb);
  }

  private afterLoad(loaded: LoadResult) {
    setSoundEnabled(this.state.settings.sound);
    void this.startTilt(false);
    setTelemetryGrade(this.state.profile.grade);
    track('start', {
      st: loaded.status,
      mig: loaded.status === 'ok' ? loaded.migratedFrom : null,
      q: this.state.questIndex,
      pwa: matchMedia('(display-mode: standalone)').matches,
      w: window.innerWidth,
      ua: /iPhone|iPad/.test(navigator.userAgent) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'other',
      ya: /YaBrowser/.test(navigator.userAgent),
    });
    const now = this.now();
    const changes = advance(this.state, now);
    const done = checkQuests(this.state, now);
    ensureOrder(this.state, Math.random);
    // Badges earned before this version (or offline) are recorded silently.
    newBadges(this.state);
    if (this.compact && this.state.questIndex > 0) this.questCollapsed = true;
    this.render();
    if (loaded.status === 'unavailable') this.setSaveError(loaded.error);
    if (loaded.status === 'corrupt') this.showCorruptSheet(loaded.error);
    else if (loaded.status === 'ok') {
      if (loaded.fromBackup) this.toast('Основное сохранение было повреждено — открыта предыдущая копия.', 'warn');
      if (loaded.migratedFrom) this.toast('Сохранение обновлено для новой версии игры.');
      this.welcomeBack(changes);
    }
    if (loaded.status !== 'corrupt') this.persist();
    const quests = done.length ? () => this.showQuestDone(done) : undefined;
    if (loaded.status !== 'corrupt' && !this.state.profile.grade) this.showProfile(true, quests);
    else quests?.();
    this.tickTimer = window.setInterval(() => this.refresh(false), 1000);
  }

  destroy() {
    clearInterval(this.tickTimer);
  }

  // ------------------------------------------------------------ state flow

  /** Recalculate growth for the current moment; used on every tick and when returning. */
  private refresh(greet: boolean) {
    const now = this.now();
    const changes = advance(this.state, now);
    const queueBefore = this.state.fair.queue;
    advanceFair(this.state, now);
    if (this.state.fair.queue !== queueBefore) this.persist();
    if (changes.length) {
      const done = checkQuests(this.state, now);
      this.persist();
      if (done.length) this.showQuestDone(done);
      if (greet) this.welcomeBack(changes);
    }
    this.render();
    this.tickGuests(now);
  }

  private commit() {
    const now = this.now();
    const done = checkQuests(this.state, now);
    const newOrder = ensureOrder(this.state, Math.random);
    const quiz = checkQuiz(this.state);
    const fairOpened = advanceFair(this.state, now);
    const badges = newBadges(this.state);
    this.persist();
    this.render();
    if (done.length) window.setTimeout(() => this.showQuestDone(done), 650);
    if (quiz) window.setTimeout(() => this.toast('У Листика есть вопрос для тебя! Нажми на Листика вверху.'), done.length ? 1600 : 500);
    for (const b of badges) window.setTimeout(() => this.toast(`Новый значок: «${b.name}»!`), 900);
    if (fairOpened) {
      window.setTimeout(() => {
        this.toast('Листик: у забора открылась Ярмарка урожая! К прилавку приходят покупатели — помоги им посчитать.');
        this.fx(ringFx(STALL.x, STALL.y - 40, '#FFF3B8', 40));
      }, done.length ? 2200 : 600);
    }
    if (newOrder && this.state.ordersDone === 0) {
      window.setTimeout(() => {
        this.toast('Листик: на доске у пруда появилась первая просьба от гостя! Загляни.');
        this.fx(ringFx(BOARD.x, BOARD.y - 40, '#FFF3B8', 34));
      }, done.length ? 1400 : 300);
    }
  }

  private persist() {
    const r = saveGame(this.storage, this.state);
    if (r.ok) {
      if (this.saveError) this.setSaveError(null);
    } else {
      this.setSaveError(r.error);
    }
  }

  private setSaveError(err: StorageError | null) {
    if (err) track('save_error', { kind: err.kind, msg: err.message });
    this.saveError = err;
    const b = $(this.root, '#banner');
    if (!err) {
      b.hidden = true;
      return;
    }
    b.hidden = false;
    b.innerHTML = `<span><b>Прогресс не сохраняется.</b> ${err.message} Сделай резервную копию, чтобы не потерять сад.</span><button type="button" class="btn small" data-act="export">Копия</button>`;
    $(b, '[data-act="export"]').addEventListener('click', () => this.doExport());
  }

  private welcomeBack(changes: GrowthChange[]) {
    if (!changes.length) return;
    const bloomed = [...new Set(changes.filter((c) => c.stage === 3).map((c) => PLANTS[c.plant].name))];
    if (bloomed.length) this.toast(`Пока тебя не было, расцвели: ${bloomed.join(', ')}.`);
    else this.toast('Пока тебя не было, растения подросли и ждут полива.');
  }

  // ------------------------------------------------------------ rendering

  private setLayer(key: string, el: Element, html: string) {
    if (this.cache.get(key) === html) return;
    this.cache.set(key, html);
    el.innerHTML = html;
  }

  render() {
    const s = this.state;
    const now = this.now();
    const progress = gardenProgress(s);
    if (!this.flying) this.shownPetals = s.petals;
    $(this.root, '#petals').textContent = String(this.shownPetals);
    this.setLayer('brook', $(this.root, '#l-brook'), brookSVG(s.restored.pond));
    this.setLayer('board', $(this.root, '#l-board'), boardSVG(s));
    this.setLayer('stall', $(this.root, '#l-stall'), stallSVG(s));
    this.setLayer('sign', $(this.root, '#l-sign'), vegSignSVG(s.restored.veg, landmarkAvailable(s, 'veg')));
    if (this.view !== 'garden' && !s.restored[this.view]) this.view = 'garden';
    for (const a of ['garden', 'veg', ...ZONE_IDS] as AreaId[]) $(this.root, `#view-${a}`).style.display = this.view === a ? '' : 'none';
    $(this.root, '#stage').dataset.area = this.view;
    this.phase = dayPhase(new Date(now).getHours());
    this.setLayer('sky', $(this.root, '#l-sky'), skySVG(this.phase));
    this.setLayer('lights', $(this.root, '#l-lights'), this.phase === 'day' ? '' : lightsSVG(this.lightSpots()));
    $(this.root, '#listikBtn').classList.toggle('has-question', s.quiz.pending);
    this.setLayer('pond', $(this.root, '#l-pond'), pondSVG(s.restored.pond));
    this.setLayer('bridge', $(this.root, '#l-bridge'), bridgeSVG(s.restored.bridge));
    this.setLayer('wild', $(this.root, '#l-wild'), wildSVG(progress));
    this.setLayer('haze', $(this.root, '#l-haze'), hazeSVG(progress));
    this.setLayer('life', $(this.root, '#l-life'), lifeSVG(s));
    this.setLayer('front', $(this.root, '#l-front'), frontSVG(this.view));
    for (let i = 0; i < TOTAL_PLOTS; i++) {
      this.setLayer(`plot-${i}`, this.wraps.get(`plot-${i}-main`)!, plotSVG(s, i, now));
      this.setLayer(`bar-${i}`, this.wraps.get(`plot-${i}-bar`)!, plotBarSVG(s, i, now));
      this.trackGrowth(i);
    }
    for (let i = 0; i < SLOT_COUNT; i++) {
      this.setLayer(`slot-${i}`, this.wraps.get(`slot-${i}`)!, slotSVG(s, i, this.mode === 'decor', this.selectedDeco));
    }
    const scene = $(this.root, '#scene');
    scene.classList.toggle('decor-mode', this.mode === 'decor');
    scene.classList.toggle('bridge-ready', !s.restored.bridge && landmarkAvailable(s, 'bridge'));
    scene.classList.toggle('pond-ready', !s.restored.pond && landmarkAvailable(s, 'pond'));
    this.root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) => {
      b.classList.toggle('active', b.dataset.nav === (this.mode === 'decor' ? 'decor' : 'garden'));
      if (b.dataset.nav === 'decor') b.classList.toggle('dim', !decorAvailable(s));
    });
    this.renderQuest();
    this.renderModeChip();
  }

  private goalLabel(g: Goal): string {
    const s = this.state;
    switch (g.type) {
      case 'plant':
        return `Посадить: ${PLANTS[g.plant].name}`;
      case 'water':
        return 'Полить растение';
      case 'harvest':
        return `Собрать: ${PLANTS[g.plant].name}`;
      case 'restore': {
        const def = LANDMARKS[g.target];
        const verb = {
          bridge: 'Починить мостик',
          pond: 'Наполнить пруд',
          veg: 'Расчистить огород',
          tundra: 'Экспедиция в тундру',
          taiga: 'Экспедиция в тайгу',
          steppe: 'Экспедиция в степь',
        }[g.target];
        return s.restored[g.target] ? verb : `${verb} (${Math.min(s.petals, def.price)}/${def.price} лепестков)`;
      }
      case 'place':
        return 'Поставить украшение';
      case 'collection':
        return `Коллекция: ${PLANT_IDS.filter((id) => s.collection[id]).length} из ${PLANT_IDS.length}`;
      case 'guests':
        return `Встретить гостей: ${Math.min(g.count, Object.keys(s.guests).length)} из ${g.count}`;
      case 'golden':
        return 'Собрать золотой цветок';
      case 'orders':
        return `Выполнить просьбы: ${Math.min(g.count, s.ordersDone)} из ${g.count}`;
      case 'meet':
        return `Познакомиться: ${GUESTS[g.guest].name}`;
    }
  }

  /** Animate a bed when its plant moves to the next stage while the player is watching. */
  private trackGrowth(i: number) {
    const p = this.state.plots[i];
    const prev = this.lastPlots[i];
    const cur = p.plant ? { plant: p.plant, stage: p.stage } : null;
    this.lastPlots[i] = cur;
    if (!prev || !cur || prev.plant !== cur.plant || cur.stage <= prev.stage) return;
    const { x, y } = plotPos(i);
    this.animate(`plot-${i}`, 'anim-grow', 900);
    this.fx(ringFx(x, y - 30, cur.stage === 3 ? '#FFF3B8' : '#E3F5C8', cur.stage === 3 ? 46 : 34));
    if (cur.stage === 3 && p.golden) {
      play('golden');
      this.fx(burstSVG(x, y, 'magic'));
      this.toast(`Ого! Расцвёл золотой цветок: ${PLANTS[cur.plant].name}!`);
    } else play('pop');
  }

  /** Put a one-shot animation class on a scene wrapper. */
  private animate(key: string, cls: string, ms: number) {
    const el = this.wraps.get(key);
    if (!el) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
  }

  private renderQuest() {
    const s = this.state;
    const q = currentQuest(s);
    let html: string;
    if (q) {
      const n = s.questIndex + 1;
      const goals = q.goals
        .map((g) => {
          const ok = goalDone(s, g);
          return `<li class="${ok ? 'done' : ''}">${ok ? ICONS.check : ICONS.circle}<span>${this.goalLabel(g)}</span></li>`;
        })
        .join('');
      html = `<div class="quest-card${this.questCollapsed ? ' collapsed' : ''}">
  <div class="quest-avatar">${listik(42)}</div>
  <div class="quest-body">
    <div class="quest-title">Задание ${n} из ${QUESTS.length} · ${q.title}</div>
    ${this.questCollapsed ? '' : `<p>${q.text}</p>`}
    <ul class="goals">${goals}</ul>
  </div>
  <button type="button" class="quest-toggle" data-quest-toggle aria-label="${this.questCollapsed ? 'Развернуть' : 'Свернуть'} задание">${this.questCollapsed ? '▾' : '▴'}</button>
</div>`;
    } else {
      const tip = LISTIK_TIPS[this.tipIndex % LISTIK_TIPS.length];
      html = `<div class="quest-card${this.questCollapsed ? ' collapsed' : ''}">
  <div class="quest-avatar">${listik(42)}</div>
  <div class="quest-body"><div class="quest-title">Сад проснулся!</div>${this.questCollapsed ? '' : `<p>${tip}</p>`}</div>
  <button type="button" class="quest-toggle" data-quest-toggle aria-label="Свернуть">${this.questCollapsed ? '▾' : '▴'}</button>
</div>`;
    }
    this.setLayer('quest', $(this.root, '#quest'), html);
  }

  private renderModeChip() {
    const chip = $(this.root, '#modeChip');
    if (this.mode !== 'decor') {
      chip.hidden = true;
      this.cache.delete('chip');
      return;
    }
    chip.hidden = false;
    const sel = this.selectedDeco;
    const html = `<span>${
      sel ? `В руках: <b>${DECORATIONS[sel].name}</b>. Нажми на свободное место.` : 'Нажми на место в саду или открой магазин.'
    }</span><button type="button" class="btn small" data-act="shop">Украшения</button><button type="button" class="btn small primary" data-act="done">Готово</button>`;
    if (this.cache.get('chip') !== html) {
      this.cache.set('chip', html);
      chip.innerHTML = html;
      $(chip, '[data-act="shop"]').addEventListener('click', () => this.showDecorSheet(null));
      $(chip, '[data-act="done"]').addEventListener('click', () => this.setMode('garden'));
    }
  }

  // ------------------------------------------------------------ interactions

  private onNav(nav: string) {
    play('tap');
    if (nav === 'garden') {
      this.setMode('garden');
      this.goTo('garden');
    }
    else if (nav === 'decor') {
      if (!decorAvailable(this.state)) {
        this.toast('Украшения откроются, когда ты починишь мостик.');
        return;
      }
      this.goTo('garden');
      this.setMode(this.mode === 'decor' ? 'garden' : 'decor');
    } else if (nav === 'collection') this.showCollection();
    else if (nav === 'map') this.showMap();
    else if (nav === 'menu') this.showMenu();
  }

  private setMode(m: Mode) {
    this.mode = m;
    if (m === 'garden') this.selectedDeco = null;
    this.render();
  }

  private onSceneClick(e: Event) {
    const t = e.target as Element;
    const plot = t.closest<SVGGElement>('[data-plot]');
    const slot = t.closest<SVGGElement>('[data-slot]');
    const lm = t.closest<SVGGElement>('[data-landmark]');
    if (this.compact && !this.questCollapsed && this.state.questIndex > 0) {
      this.questCollapsed = true;
      this.renderQuest();
    }
    if (t.closest('[data-guest]')) return this.onGuest();
    const sign = t.closest<SVGGElement>('[data-sign]');
    if (sign && this.mode === 'garden') return this.showSign(Number(sign.dataset.sign));
    const go = t.closest<SVGGElement>('[data-go]');
    if (go && this.mode === 'garden') return this.onSign(go.dataset.go as AreaId);
    if (slot && this.mode === 'decor') return this.onSlot(Number(slot.dataset.slot));
    if (t.closest('[data-board]') && this.mode === 'garden') return this.showOrderSheet();
    if (t.closest('[data-fair]') && this.mode === 'garden') return this.showFair();
    if (plot) return this.onPlot(Number(plot.dataset.plot));
    if (lm) return this.onLandmark(lm.dataset.landmark as Landmark);
  }

  private onPlot(i: number) {
    const s = this.state;
    const now = this.now();
    advance(s, now);
    const st = plotStatus(s, i, now);
    const p = s.plots[i];
    const { x, y } = plotPos(i);
    if (st === 'locked') {
      play('tap');
      this.toast('Эта грядка заросла колючками. Листик расчистит её, когда ты выполнишь задания.');
    } else if (st === 'empty') {
      play('tap');
      this.showSeedSheet(i);
    } else if (st === 'thirsty') {
      const r = water(s, i, now);
      if (r.ok) {
        play('water');
        this.fx(wateringFx(x, y), 1500);
        this.commit();
      }
    } else if (st === 'ready' && p.plant) {
      const golden = p.golden;
      const r = harvest(s, i, now);
      if (r.ok) {
        play(r.golden ? 'golden' : 'harvest');
        this.fx(pluckFx(x, y, r.plant, golden), 1000);
        this.fx(burstSVG(x, y, PLANTS[r.plant].magic || r.golden ? 'magic' : 'harvest'));
        this.floatText(x, y - 70, `+${r.petals}`);
        this.flyPetals(x, y - 50, r.petals);
        this.commit();
        if (r.golden) this.toast(r.firstGolden ? 'Первый золотой цветок! Он даёт вдвое больше лепестков.' : `Золотой цветок: +${r.petals}!`);
        if (r.first) window.setTimeout(() => this.showDiscovery(r.plant), 500);
      }
    } else if (st === 'growing' && p.plant) {
      play('tap');
      this.toast(
        `${PLANTS[p.plant].name} · ${STAGE_NAMES[p.stage]}. До ${NEXT_STAGE[p.stage]} — ${formatDuration(remainingMs(p, now))}.`,
      );
    }
  }

  private onSlot(i: number) {
    const s = this.state;
    const now = this.now();
    const placed = s.decor.placed[i];
    if (placed) {
      const r = removeDecoration(s, i, now);
      if (r.ok) {
        this.selectedDeco = r.id;
        play('tap');
        this.commit();
      }
      return;
    }
    if (this.selectedDeco && freeDecorations(s, this.selectedDeco) > 0) {
      const r = placeDecoration(s, i, this.selectedDeco, now);
      if (r.ok) {
        play('plant');
        this.selectedDeco = null;
        this.commit();
        this.animate(`slot-${i}`, 'anim-drop', 800);
      } else this.toast(r.reason, 'warn');
      return;
    }
    this.showDecorSheet(i);
  }

  private onLandmark(id: Landmark) {
    const s = this.state;
    play('tap');
    if (s.restored[id]) {
      this.toast(LANDMARKS[id].restoredText);
      return;
    }
    if (!landmarkAvailable(s, id)) {
      this.toast(
        {
          bridge: 'Старый мостик совсем развалился. Листик скоро расскажет, как его починить.',
          pond: 'Пруд давно высох. Сначала нужно разбудить остальной сад.',
          veg: 'Огород совсем зарос. Сначала наполни пруд — тогда хватит воды и для грядок.',
          tundra: 'В экспедицию можно будет отправиться, когда Листик позовёт.',
          taiga: 'Сначала побывай в тундре.',
          steppe: 'Сначала побывай в тайге.',
        }[id],
      );
      return;
    }
    this.showRestoreSheet(id);
  }

  /** Signposts switch between the garden and the vegetable patch. */
  private onSign(to: AreaId) {
    if (to !== 'garden' && !this.state.restored[to]) return this.onLandmark(to);
    play('tap');
    this.goTo(to);
  }

  private goTo(view: AreaId) {
    if (this.view === view) return;
    this.view = view;
    if (this.guest) this.dismissGuest(false);
    const stage = $(this.root, '#stage');
    stage.classList.remove('switching');
    void stage.offsetWidth;
    stage.classList.add('switching');
    this.render();
  }

  /** Where light shines at night in the current view. */
  private lightSpots() {
    const s = this.state;
    const spots: { x: number; y: number; r: number; color?: string }[] = [];
    for (const i of areaPlots(this.view)) {
      const p = s.plots[i];
      if (!p.plant || p.stage < 3) continue;
      const { x, y } = plotPos(i);
      if (p.plant === 'moonflower') spots.push({ x, y: y - 60, r: 60, color: 'gMoonGlow' });
      else if (p.golden) spots.push({ x, y: y - 46, r: 44, color: 'gGold' });
    }
    if (this.view === 'garden') {
      s.decor.placed.forEach((d, i) => {
        if (d === 'lantern') spots.push({ x: SLOTS[i].x, y: SLOTS[i].y - 54, r: 52 });
      });
      if (s.restored.pond) for (const [x, y] of [[60, 290], [150, 300], [40, 345], [175, 345]]) spots.push({ x, y, r: 6 });
    } else if (this.view === 'veg') {
      spots.push({ x: 287, y: 262, r: 34 });
    }
    return spots;
  }

  // ------------------------------------------------------------ sheets

  private openSheet(html: string, onClose?: () => void) {
    const back = $(this.root, '#sheetBackdrop');
    const sheet = $(this.root, '#sheet');
    sheet.innerHTML = `<button type="button" class="sheet-close" aria-label="Закрыть">${ICONS.close}</button>${html}`;
    back.hidden = false;
    this.sheetOnClose = onClose ?? null;
    $(sheet, '.sheet-close').addEventListener('click', () => this.closeSheet());
    return sheet;
  }

  closeSheet() {
    const back = $(this.root, '#sheetBackdrop');
    if (back.hidden) return;
    back.hidden = true;
    $(this.root, '#sheet').innerHTML = '';
    const cb = this.sheetOnClose;
    this.sheetOnClose = null;
    cb?.();
  }

  private showSeedSheet(plot: number) {
    const s = this.state;
    const area = plotArea(plot);
    const kinds = AREA_PLANTS[area];
    const cards = kinds.map((id) => {
      const def = PLANTS[id];
      const open = s.unlockedPlants.includes(id);
      if (!open) {
        return `<div class="card locked" aria-disabled="true">${plantIcon(id, 3, 64, true)}<b>???</b><small>Скоро</small></div>`;
      }
      return `<button type="button" class="card" data-plant="${id}">${plantIcon(id, 3, 64)}<b>${def.name}</b><small>${def.growMinutes} мин · +${def.petals}</small></button>`;
    }).join('');
    const title = { garden: 'Что посадим?', veg: 'Что посадим в огороде?', tundra: 'Что посадим в тундре?', taiga: 'Что посадим в тайге?', steppe: 'Что посадим в степи?' }[area];
    const sheet = this.openSheet(`<h2>${title}</h2><p class="muted">Растение подрастает после каждого полива. Оно не завянет, даже если ты уйдёшь.</p><div class="grid">${cards}</div>`);
    sheet.querySelectorAll<HTMLButtonElement>('[data-plant]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = plantSeed(this.state, plot, b.dataset.plant as PlantId, this.now(), Math.random);
        this.closeSheet();
        if (r.ok) {
          play('plant');
          const { x, y } = plotPos(plot);
          this.fx(plantFx(x, y), 900);
          this.commit();
          this.animate(`plot-${plot}`, 'anim-plant', 900);
          const signs = this.state.plots.filter((x) => x.sign).length;
          if (this.state.plots[plot].sign && this.state.rus.total === 0 && signs === 1) {
            window.setTimeout(() => this.toast('Листик: у грядки появилась табличка, но в слове пропущена буква. Нажми на табличку!'), 900);
          }
        } else this.toast(r.reason, 'warn');
      }),
    );
  }

  private showRestoreSheet(id: Landmark) {
    const s = this.state;
    const def = LANDMARKS[id];
    const enough = s.petals >= def.price;
    const what = {
      bridge: 'Починить мостик',
      pond: 'Наполнить пруд',
      veg: 'Расчистить огород',
      tundra: 'Отправиться в тундру',
      taiga: 'Отправиться в тайгу',
      steppe: 'Отправиться в степь',
    }[id];
    const desc = {
      bridge: 'Старые доски сгнили, а перила упали в ручей. Листик знает, как всё исправить, — нужны только лепестки.',
      pond: 'Ручей завалило камнями и ветками, и пруд высох. Если расчистить ручей, вода вернётся.',
      veg: 'За садом есть старый огород: четыре грядки, сарайчик и бочка для воды. Всё заросло сорняками, но если расчистить, там вырастут морковка, клубника и тыква!',
      tundra: `${ZONE_ATLAS[1].text} Лепестки пойдут на тёплую одежду и снаряжение для экспедиции.`,
      taiga: `${ZONE_ATLAS[2].text} Для экспедиции нужны лепестки.`,
      steppe: `${ZONE_ATLAS[4].text} Для экспедиции нужны лепестки.`,
    }[id];
    const sheet = this.openSheet(`<div class="sheet-hero">${listik(64, 'wow')}</div><h2>${def.brokenName}</h2><p>${desc}</p>
<div class="price">${petalIcon(24)}<b>${def.price}</b><span class="muted">у тебя ${s.petals}</span></div>
<button type="button" class="btn primary wide" data-act="restore" ${enough ? '' : 'disabled'}>${what}</button>
${enough ? '' : `<p class="muted center">Не хватает ${petalsWord(def.price - s.petals)}. Собери ещё цветов!</p>`}`);
    $(sheet, '[data-act="restore"]').addEventListener('click', () => {
      const r = restore(this.state, id, this.now());
      this.closeSheet();
      if (r.ok) {
        play('build');
        this.commit();
        if (id === 'veg' || (ZONE_IDS as readonly string[]).includes(id)) {
          this.toast(def.restoredText);
          this.confetti();
          window.setTimeout(() => this.goTo(id as AreaId), 400);
          return;
        }
        for (const layer of id === 'pond' ? ['pond', 'brook'] : ['bridge']) {
          const lm = $(this.root, `#l-${layer}`);
          lm.classList.remove('just-restored');
          void lm.getBoundingClientRect();
          lm.classList.add('just-restored');
          window.setTimeout(() => lm.classList.remove('just-restored'), 2500);
        }
        const c = id === 'bridge' ? { x: 298, y: 214 } : { x: 102, y: 318 };
        this.fx(burstSVG(c.x, c.y + 40, 'magic'));
        this.fx(ringFx(c.x, c.y, '#FFF3B8', id === 'bridge' ? 50 : 80));
        this.confetti();
        this.toast(def.restoredText);
      } else this.toast(r.reason, 'warn');
    });
  }

  private showDecorSheet(slot: number | null) {
    const s = this.state;
    const cards = DECO_IDS.map((id) => {
      const def = DECORATIONS[id];
      const free = freeDecorations(s, id);
      const action =
        free > 0
          ? `<button type="button" class="btn small primary" data-place="${id}">Поставить</button>`
          : `<button type="button" class="btn small" data-buy="${id}" ${s.petals >= def.price ? '' : 'disabled'}>${petalIcon(16)} ${def.price}</button>`;
      return `<div class="card deco">${decoIcon(id, 64)}<b>${def.name}</b><small>${s.decor.owned[id] ? `есть: ${s.decor.owned[id]}, свободно: ${free}` : 'ещё нет'}</small>${action}</div>`;
    }).join('');
    const sheet = this.openSheet(`<h2>Украшения</h2><p class="muted">У тебя ${petalsWord(s.petals)}. Купленное украшение можно переставлять сколько угодно.</p><div class="grid">${cards}</div>`);
    const choose = (id: DecoId) => {
      this.closeSheet();
      if (slot !== null && !this.state.decor.placed[slot]) {
        const r = placeDecoration(this.state, slot, id, this.now());
        if (r.ok) {
          play('plant');
          this.selectedDeco = null;
          this.commit();
          this.animate(`slot-${slot}`, 'anim-drop', 800);
          return;
        }
      }
      this.selectedDeco = id;
      this.setMode('decor');
      this.selectedDeco = id;
      this.render();
    };
    sheet.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.buy as DecoId;
        const r = buyDecoration(this.state, id, this.now());
        if (!r.ok) {
          play('error');
          this.toast(r.reason, 'warn');
          return;
        }
        play('harvest');
        this.persist();
        choose(id);
      }),
    );
    sheet.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.place as DecoId)));
  }

  private showCollection() {
    const s = this.state;
    const plantsFound = PLANT_IDS.filter((id) => s.collection[id]).length;
    const guestsFound = GUEST_IDS.filter((id) => s.guests[id]).length;
    const goldKinds = PLANT_IDS.filter((id) => s.golden[id]).length;
    let body: string;
    const plantCard = (id: PlantId) => {
        const e = s.collection[id];
        const def = PLANTS[id];
        if (!e) return `<div class="card book locked">${plantIcon(id, 3, 72, true)}<b>???</b><small>Ещё не выращено</small></div>`;
        const gold = s.golden[id] ? `<span class="gold-tag">${starIcon(14)} золотых: ${s.golden[id]}</span>` : '';
        return `<div class="card book${s.golden[id] ? ' has-gold' : ''}">${plantIcon(id, 3, 72)}<b>${def.name}${def.magic ? ' <span class="magic">волшебный</span>' : ''}</b><small>Собрано: ${e.count} ${gold}</small><p>${def.fact}</p></div>`;
    };
    if (this.collectionTab === 'words') {
      const learned = new Set(s.rus.learned);
      const groups = (Object.keys(RULES) as RuleId[])
        .map((rule) => {
          const words = WORDS.filter((w) => w.rule === rule && learned.has(w.id));
          const all = WORDS.filter((w) => w.rule === rule).length;
          const chips = words.map((w) => `<span class="word-chip" title="${w.why.replace(/"/g, '&quot;')}">${viewWord(w).full}</span>`).join('');
          return `<h3 class="sub">${RULES[rule]} <span class="muted small">${words.length}/${all}</span></h3><div class="word-chips">${chips || '<span class="muted small">Пока пусто — заполняй таблички у грядок.</span>'}</div>`;
        })
        .join('');
      body = `<p class="muted">Слова, которые ты правильно вписал на табличках: ${learned.size} из ${WORDS.length}. Таблички появляются у грядок после посадки.</p>${groups}`;
    } else if (this.collectionTab === 'badges') {
      const cards = BADGES.map((b) => {
        const [n, goal] = b.progress(s);
        const got = n >= goal;
        return `<div class="badge-card${got ? ' got' : ''}">${medalIcon(got)}<b>${b.name}</b><small>${b.desc}</small><span class="meter"><i style="width:${Math.round((n / goal) * 100)}%"></i></span><small class="count">${n} / ${goal}</small></div>`;
      }).join('');
      body = `<p class="muted">Получено ${earned(s).length} из ${BADGES.length}.</p><div class="badge-grid">${cards}</div>`;
    } else if (this.collectionTab === 'plants') {
      body = `<p class="muted">Открыто ${plantsFound} из ${PLANT_IDS.length}. Золотые: ${goldKinds} из ${PLANT_IDS.length} видов.</p>${(
        [
          ['Цветы', FLOWER_IDS],
          ['Огород', VEG_IDS],
          ['Тундра', TUNDRA_IDS],
          ['Тайга', TAIGA_IDS],
          ['Степь', STEPPE_IDS],
        ] as [string, readonly PlantId[]][]
      )
        .map(([name, ids]) => `<h3 class="sub">${name}</h3><div class="grid book-grid">${ids.map(plantCard).join('')}</div>`)
        .join('')}`;
    } else {
      const guestCard = (id: GuestId) => {
        const e = s.guests[id];
        const def = GUESTS[id];
        if (!e) return `<div class="card book locked">${guestIcon(id, 72, true)}<b>???</b><small>Ещё не встречали</small><p class="muted">${def.hint}</p></div>`;
        return `<div class="card book">${guestIcon(id, 72)}<b>${def.name}</b><small>Встреч: ${e.count}</small><p>${def.fact}</p></div>`;
      };
      const groups = (['garden', ...ZONE_IDS] as const).map(
        (a) => `<h3 class="sub">${a === 'garden' ? 'Наш сад' : AREA_NAME[a]}</h3><div class="grid book-grid">${GUEST_IDS.filter((id) => GUESTS[id].area === a).map(guestCard).join('')}</div>`,
      );
      body = `<p class="muted">Встречено ${guestsFound} из ${GUEST_IDS.length}. Гости приходят ненадолго — нажми на гостя, чтобы познакомиться.</p>${groups.join('')}`;
    }
    const tab = (id: 'plants' | 'guests' | 'words' | 'badges', label: string, n: number, total: number) =>
      `<button type="button" class="tab${this.collectionTab === id ? ' active' : ''}" data-tab="${id}">${label} <span>${n}/${total}</span></button>`;
    const sheet = this.openSheet(
      `<h2>Коллекция</h2><div class="tabs" role="tablist">${tab('plants', 'Растения', plantsFound, PLANT_IDS.length)}${tab('guests', 'Гости', guestsFound, GUEST_IDS.length)}${tab('words', 'Слова', s.rus.learned.length, WORDS.length)}${tab('badges', 'Значки', earned(s).length, BADGES.length)}</div>${body}`,
    );
    sheet.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.collectionTab = b.dataset.tab as 'plants' | 'guests' | 'words' | 'badges';
        play('tap');
        this.showCollection();
      }),
    );
  }

  private showOrderSheet() {
    const s = this.state;
    const o = s.order;
    if (!o) return;
    play('tap');
    const g = GUESTS[o.from];
    const done = orderComplete(s);
    const items = o.items
      .map((it) => {
        const ok = it.have >= it.need;
        return `<li class="${ok ? 'done' : ''}">${plantIcon(it.plant, 3, 44)}<span><b>${PLANTS[it.plant].name}</b> ${Math.min(it.have, it.need)} из ${it.need}</span>${ok ? ICONS.check : ''}</li>`;
      })
      .join('');
    const sheet = this.openSheet(`<div class="sheet-hero">${guestIcon(o.from, 96)}</div><p class="eyebrow">Просьба на доске</p><h2>${g.name} просит цветы</h2>
<ul class="order-items">${items}</ul>
<p class="muted">Засчитываются цветы, которые ты соберёшь, пока висит просьба. Выполнено просьб: ${s.ordersDone}.</p>
<div class="price">${petalIcon(24)}<b>+${o.reward}</b><span class="muted">награда</span></div>
<button type="button" class="btn primary wide" data-act="claim" ${done ? '' : 'disabled'}>${done ? 'Отдать цветы' : 'Пока не хватает цветов'}</button>`);
    $(sheet, '[data-act="claim"]').addEventListener('click', () => {
      const r = claimOrder(this.state, this.now(), Math.random);
      this.closeSheet();
      if (!r.ok) return this.toast(r.reason, 'warn');
      play('quest');
      this.fx(heartsFx(BOARD.x, BOARD.y - 70), 1400);
      this.flyPetals(BOARD.x, BOARD.y - 50, r.reward);
      this.toast(`${g.name} говорит «спасибо»! +${r.reward}`);
      this.commit();
    });
  }

  // ------------------------------------------------------------ Listik's questions

  private showQuiz() {
    const s = this.state;
    if (!s.quiz.pending) return;
    this.question ??= pickQuestion(s, Math.random);
    const q = this.question;
    play('tap');
    const options = [...q.options].sort(() => Math.random() - 0.5);
    const sheet = this.openSheet(`<div class="sheet-hero hero-hop">${listik(64, 'wow')}</div><p class="eyebrow">Вопрос Листика · ${q.topic}</p><h2>${q.text}</h2>
<div class="answers">${options.map((o, i) => `<button type="button" class="btn wide answer" data-answer="${i}">${o}</button>`).join('')}</div>
<p class="muted small center">Это из «Окружающего мира» за ${gradeOf(this.state)} класс. Ошибиться не страшно — Листик подскажет.</p>`);
    sheet.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((b) =>
      b.addEventListener('click', () => {
        const chosen = options[Number(b.dataset.answer)];
        const r = answerQuiz(this.state, q.id, chosen, this.now());
        if (!r.ok) return;
        track('quiz', { id: q.id, ok: r.correct, pick: r.correct ? null : chosen });
        this.question = null;
        sheet.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((x) => {
          x.disabled = true;
          const opt = options[Number(x.dataset.answer)];
          if (opt === q.options[0]) x.classList.add('right');
          else if (x === b) x.classList.add('wrong');
        });
        play(r.correct ? 'quest' : 'tap');
        if (r.correct) this.confetti();
        const box = document.createElement('div');
        box.className = `explain ${r.correct ? 'ok' : 'try'}`;
        box.innerHTML = `<b>${r.correct ? `Верно! +${r.petals}` : `Почти! Правильный ответ: ${q.options[0]}. +${r.petals} за старание`}</b><p>${q.explain}</p><button type="button" class="btn primary wide" data-act="ok">${r.correct ? 'Ура!' : 'Понятно'}</button>`;
        $(sheet, '.answers').after(box);
        $(box, '[data-act="ok"]').addEventListener('click', () => this.closeSheet());
        box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        this.commit();
        this.bumpPetals();
      }),
    );
  }

  // ------------------------------------------------------------ signs (Russian)

  private showSign(i: number) {
    const sign = this.state.plots[i]?.sign;
    const w = sign && WORDS.find((x) => x.id === sign.id);
    if (!sign || !w) return;
    const v = viewWord(w);
    play('tap');
    if (sign.solved) {
      this.toast(`«${v.full}» — ${RULES[w.rule].toLowerCase()}. ${w.why}`);
      return;
    }
    const options = [...w.options].sort(() => Math.random() - 0.5);
    const sheet = this.openSheet(`<p class="eyebrow">Табличка у грядки · ${RULES[w.rule]}</p><h2>Вставь пропущенную букву</h2>
<div class="word-sign"><span data-word>${escapeWord(v.masked)}</span></div>
<div class="letters">${options.map((o, k) => `<button type="button" class="btn letter${o === NO_LETTER ? ' none' : ''}" data-opt="${k}">${o}</button>`).join('')}</div>
<div data-result></div>`);
    sheet.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) =>
      b.addEventListener('click', () => {
        const choice = options[Number(b.dataset.opt)];
        const r = answerSign(this.state, i, choice, this.now());
        if (!r.ok) return;
        track('sign', { id: w.id, ok: r.correct, pick: r.correct ? null : choice });
        sheet.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((x) => {
          x.disabled = true;
          const opt = options[Number(x.dataset.opt)];
          if (opt === r.answer) x.classList.add('right');
          else if (x === b) x.classList.add('wrong');
        });
        $(sheet, '[data-word]').innerHTML = highlightWord(v.masked, r.answer);
        $(sheet, '.word-sign').classList.add(r.correct ? 'ok' : 'fix');
        const box = document.createElement('div');
        box.className = `explain ${r.correct ? 'ok' : 'try'}`;
        box.innerHTML = `<b>${r.correct ? `Верно! +${r.petals}` : `Правильно: ${r.answer === NO_LETTER ? 'без буквы' : `«${r.answer}»`}. +${r.petals} за старание`}</b><p></p><button type="button" class="btn primary wide" data-act="ok">${r.correct ? 'Ура!' : 'Понятно'}</button>`;
        $(box, 'p').textContent = w.why;
        $(sheet, '[data-result]').replaceChildren(box);
        $(box, '[data-act="ok"]').addEventListener('click', () => this.closeSheet());
        play(r.correct ? 'quest' : 'tap');
        this.commit();
        this.bumpPetals();
      }),
    );
  }

  // ------------------------------------------------------------ fair (math)

  private showFair() {
    const s = this.state;
    const now = this.now();
    advanceFair(s, now);
    play('tap');
    const level = fairLevel(s.fair.solved, gradeOf(s));
    if (s.fair.queue <= 0) {
      this.openSheet(`<div class="sheet-hero">${listik(64)}</div><p class="eyebrow">Ярмарка урожая · уровень ${level}</p><h2>Покупателей пока нет</h2><p>Следующий придёт примерно через ${nextCustomerIn(s, now)} мин. А пока можно поливать и собирать урожай!</p><p class="muted">Решено задач: ${s.fair.solved}, с первой попытки: ${s.fair.firstTry}.</p>`);
      return;
    }
    if (!this.fairTask) {
      const pool = GUEST_IDS.filter((id) => GUESTS[id].area === 'garden' || s.guests[id]);
      const guest = pool[Math.floor(Math.random() * pool.length)];
      this.fairTask = { guest, problem: makeProblem(level, Math.random, GUESTS[guest].name, undefined, gradeOf(s)) };
    }
    const { problem: p, guest } = this.fairTask;
    let tries = 0;
    let hinted = false;
    let done = false;
    const sheet = this.openSheet(`<div class="fair-head">${guestIcon(guest, 84)}<div><p class="eyebrow">Ярмарка урожая · уровень ${level}</p><p class="small muted">Покупателей ждёт: ${s.fair.queue}</p></div></div>
<div class="bubble">${p.text}</div>
<form class="answer-row" data-form>
  <input class="answer-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="Ответ" placeholder="?">
  <span class="unit">${p.unit}</span>
</form>
<div class="fair-buttons"><button type="button" class="btn ghost" data-act="hint">Подсказка</button><button type="button" class="btn primary" data-act="check">Проверить</button></div>
<div data-result></div>`);
    const input = $<HTMLInputElement>(sheet, '.answer-input');
    const result = $(sheet, '[data-result]');
    const finish = (r: FairResult) => {
      done = true;
      const served = serveCustomer(this.state, r, this.now());
      this.fairTask = null;
      track('fair', { k: p.kind, lvl: level, r, hint: hinted });
      if (!served.ok) return;
      input.disabled = true;
      sheet.querySelectorAll<HTMLButtonElement>('.fair-buttons .btn').forEach((b) => (b.disabled = true));
      const more = this.state.fair.queue > 0;
      const title =
        r === 'failed'
          ? `Правильный ответ: ${p.answerText}. +${served.petals} за старание`
          : r === 'first'
            ? `Верно! +${served.petals}`
            : `Верно, со второй попытки! +${served.petals}`;
      result.innerHTML = `<div class="explain ${r === 'failed' ? 'try' : 'ok'}"><b>${title}</b><p>Решение: ${p.solution}</p><button type="button" class="btn primary wide" data-act="next">${more ? 'Следующий покупатель' : 'Готово'}</button></div>`;
      play(r === 'failed' ? 'tap' : 'quest');
      if (r === 'first') this.confetti();
      this.commit();
      this.bumpPetals();
      $(result, '[data-act="next"]').addEventListener('click', () => {
        this.closeSheet();
        if (more) window.setTimeout(() => this.showFair(), 150);
      });
    };
    const showHint = (lead: string) => {
      hinted = true;
      const box = document.createElement('p');
      box.className = 'hint-box';
      box.textContent = `${lead}${p.hint}`;
      result.replaceChildren(box);
    };
    const check = () => {
      if (done) return;
      const raw = input.value.replace(/\s/g, '');
      if (!/^\d+$/.test(raw)) {
        if (raw) track('fair_bad', { k: p.kind, len: raw.length, sep: /[.,]/.test(raw) });
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
        input.focus();
        return;
      }
      if (Number(raw) === p.answer) return finish(tries === 0 && !hinted ? 'first' : 'second');
      track('fair_try', { k: p.kind, lvl: level, ans: Number(raw), want: p.answer });
      tries += 1;
      if (tries >= 2) return finish('failed');
      play('error');
      showHint('Не совсем. Подсказка: ');
      input.select();
    };
    $(sheet, '[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      check();
    });
    $(sheet, '[data-act="check"]').addEventListener('click', check);
    $(sheet, '[data-act="hint"]').addEventListener('click', () => {
      if (!done && !hinted) showHint('Подсказка: ');
      input.focus();
    });
    window.setTimeout(() => input.focus(), 250);
  }

  // ------------------------------------------------------------ photo

  /** Render the garden into a PNG and share or download it. */
  async takePhoto() {
    const scene = $(this.root, '#scene') as unknown as SVGSVGElement;
    const clone = scene.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', '0 0 400 640');
    clone.setAttribute('width', '1200');
    clone.setAttribute('height', '1920');
    clone.setAttribute('style', 'font-family: -apple-system, system-ui, sans-serif');
    // Things that only make sense on screen.
    clone.querySelectorAll('.hint-ring, .slot-hint, .badge, .progress, .guest-glow, #l-fx > *, [style*="display:none"], [style*="display: none"]').forEach((el) => el.remove());
    clone.querySelectorAll('.ripple, .pour, .puff, .splash').forEach((el) => el.remove());
    clone.insertAdjacentHTML('afterbegin', '<rect x="0" y="0" width="400" height="640" fill="#8cbf6a"/>');
    const defsDoc = new DOMParser().parseFromString(SHARED_DEFS.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '), 'image/svg+xml');
    const defs = defsDoc.querySelector('defs');
    if (defs) clone.insertBefore(document.importNode(defs, true), clone.firstChild);
    const date = new Date(this.now()).toLocaleDateString('ru-RU');
    clone.insertAdjacentHTML(
      'beforeend',
      `<g><rect x="0" y="604" width="400" height="36" fill="#FFF6E3" opacity=".92"/><text x="200" y="628" font-size="17" font-weight="800" text-anchor="middle" fill="#3F7A3A">Зелёный сад · ${date}</text></g>`,
    );
    try {
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(img, 0, 0, 1200, 1920);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('no blob');
      const name = `zelyony-sad-foto-${new Date(this.now()).toISOString().slice(0, 10)}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      play('golden');
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Мой Зелёный сад' }).catch(() => undefined);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.toast('Фото сада сохранено!');
      }
    } catch {
      this.toast('Не получилось сделать фото на этом устройстве.', 'warn');
    }
  }

  // ------------------------------------------------------------ map of natural zones

  private showMap() {
    const s = this.state;
    const bandH = 54;
    const bands = ZONE_ATLAS.map((z, i) => {
      const y = i * bandH;
      const zone = (ZONE_IDS as readonly string[]).includes(z.id) ? (z.id as ZoneId) : null;
      const home = z.id === 'mixed';
      const open = zone ? s.restored[zone] : home;
      const status = home ? '★ наш сад' : zone ? (open ? 'открыто' : landmarkAvailable(s, zone) ? 'можно отправиться!' : 'закрыто') : 'скоро';
      const dark = z.id === 'taiga';
      return `<g class="band${open ? ' open' : ''}" data-zone="${z.id}" role="button" aria-label="${z.name}: ${status}"><rect x="0" y="${y}" width="320" height="${bandH}" fill="${z.color}"/><text x="14" y="${y + 24}" font-size="16" font-weight="800" fill="${dark ? '#FFF6E3' : '#3B2E1E'}">${z.name}</text><text x="14" y="${y + 42}" font-size="12" fill="${dark ? '#E3EFD6' : '#6B5A43'}">${status}</text>${zone && !open && landmarkAvailable(s, zone) ? `<circle class="pulse" cx="296" cy="${y + 27}" r="9" fill="#F6BE3B"/>` : ''}</g>`;
    }).join('');
    const sheet = this.openSheet(`<h2>Карта природных зон</h2><p class="muted">Россия с севера на юг. Чем южнее, тем теплее. Нажми на зону, чтобы узнать о ней.</p>
<div class="map-wrap"><svg class="map" viewBox="0 0 320 ${bandH * ZONE_ATLAS.length}" role="group" aria-label="Природные зоны">${bands}<g pointer-events="none"><text x="306" y="16" font-size="11" text-anchor="end" fill="#6B5A43">Север ↑</text><text x="306" y="${bandH * ZONE_ATLAS.length - 6}" font-size="11" text-anchor="end" fill="#6B5A43">Юг ↓</text></g></svg></div>
<div id="zoneCard"></div>`);
    const show = (id: string) => {
      const z = ZONE_ATLAS.find((x) => x.id === id)!;
      const zone = (ZONE_IDS as readonly string[]).includes(id) ? (id as ZoneId) : null;
      let action = '';
      if (id === 'mixed') action = `<button type="button" class="btn primary wide" data-goto="garden">В наш сад</button>`;
      else if (zone && s.restored[zone]) action = `<button type="button" class="btn primary wide" data-goto="${zone}">Отправиться: ${z.name}</button>`;
      else if (zone && landmarkAvailable(s, zone)) action = `<button type="button" class="btn primary wide" data-expedition="${zone}">Снарядить экспедицию</button>`;
      else if (zone) action = `<p class="muted center">Экспедиция откроется позже — Листик расскажет, когда.</p>`;
      else action = `<p class="muted center">Сюда экспедиция пока не ходит — скоро!</p>`;
      const card = $(sheet, '#zoneCard');
      card.innerHTML = `<div class="zone-card" style="border-color:${z.color}"><h3>${z.name}</h3><p>${z.text}</p><p><b>Растения:</b> ${z.plants}<br><b>Животные:</b> ${z.animals}</p>${action}</div>`;
      card.querySelector<HTMLButtonElement>('[data-goto]')?.addEventListener('click', (e) => {
        this.closeSheet();
        this.goTo((e.currentTarget as HTMLElement).dataset.goto as AreaId);
      });
      card.querySelector<HTMLButtonElement>('[data-expedition]')?.addEventListener('click', () => {
        this.closeSheet();
        this.showRestoreSheet(zone!);
      });
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    sheet.querySelectorAll<SVGGElement>('[data-zone]').forEach((g) =>
      g.addEventListener('click', () => {
        play('tap');
        show(g.dataset.zone!);
      }),
    );
    show(this.view === 'garden' || this.view === 'veg' ? 'mixed' : this.view);
  }

  private showGuestDiscovery(id: GuestId, petals: number) {
    const def = GUESTS[id];
    play('quest');
    const sheet = this.openSheet(`<div class="sheet-hero big">${guestIcon(id, 120)}</div><p class="eyebrow">Новый гость</p><h2>Ты встретил ${def.acc}!</h2><p>${def.fact}</p><p class="muted center">За знакомство: +${petals}. Гость добавлен в «Коллекцию».</p><button type="button" class="btn primary wide" data-act="ok">Привет!</button>`);
    $(sheet, '[data-act="ok"]').addEventListener('click', () => this.closeSheet());
  }

  // ------------------------------------------------------------ guests

  /** Spawn and dismiss garden guests. Runs on every tick. */
  private tickGuests(now: number) {
    if (this.guest && now >= this.guest.leaveAt) this.dismissGuest(false);
    if (this.guest || now < this.nextGuestAt) return;
    const sheetOpen = !$(this.root, '#sheetBackdrop').hidden;
    if (sheetOpen || this.mode !== 'garden' || this.view === 'veg' || document.visibilityState === 'hidden') return;
    const options = visitingGuests(this.state, this.view);
    if (!options.length) {
      this.nextGuestAt = now + 10_000;
      return;
    }
    // Guests the player hasn't met yet come more often.
    const weighted = options.flatMap((id) => (this.state.guests[id] ? [id] : [id, id, id]));
    this.spawnGuest(weighted[Math.floor(Math.random() * weighted.length)], now);
  }

  private spawnGuest(id: GuestId, now: number) {
    const def = GUESTS[id];
    let x: number;
    let y: number;
    if (def.home === 'flowers') {
      const beds = this.state.plots.map((p, i) => (i < PLOT_COUNT && p.plant && p.stage >= 3 ? i : -1)).filter((i) => i >= 0);
      const bed = PLOTS[beds[Math.floor(Math.random() * beds.length)] ?? 1];
      x = bed.x + (Math.random() < 0.5 ? -30 : 30);
      y = bed.y - 70;
    } else if (def.area !== 'garden') {
      [x, y] = ZONE_SPOTS[Math.floor(Math.random() * ZONE_SPOTS.length)];
    } else {
      const spots = GUEST_SPOTS[def.home];
      [x, y] = spots[Math.floor(Math.random() * spots.length)];
    }
    const flip = x > 200 ? -1 : 1;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `guest g-${id} enter`);
    g.setAttribute('data-guest', id);
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `Гость: ${def.name}. Нажми, чтобы познакомиться`);
    g.setAttribute('transform', `translate(${x} ${y})`);
    g.innerHTML = `<ellipse class="guest-glow" cx="0" cy="-8" rx="30" ry="22" fill="url(#gGuest)"/><g class="guest-move"><g transform="scale(${1.5 * flip} 1.5)">${guestArt(id)}</g></g><circle cx="0" cy="-10" r="34" fill="transparent"/>`;
    $(this.root, '#l-guest').appendChild(g);
    window.setTimeout(() => g.classList.remove('enter'), 700);
    this.guest = { id, x, y, el: g, leaveAt: now + (GUEST_STAY[id] ?? 15) * 1000 };
  }

  private dismissGuest(met: boolean) {
    const gst = this.guest;
    if (!gst) return;
    this.guest = null;
    gst.el.removeAttribute('data-guest');
    gst.el.classList.add(met ? 'caught' : 'leave');
    window.setTimeout(() => gst.el.remove(), 700);
    this.nextGuestAt = this.now() + (18 + Math.random() * 22) * 1000;
  }

  private onGuest() {
    const gst = this.guest;
    if (!gst) return;
    const r = meetGuest(this.state, gst.id, this.now());
    play('guest');
    this.dismissGuest(true);
    this.fx(heartsFx(gst.x, gst.y - 40), 1400);
    this.floatText(gst.x, gst.y - 50, `+${r.petals}`);
    this.flyPetals(gst.x, gst.y - 20, r.petals);
    this.commit();
    if (r.first) window.setTimeout(() => this.showGuestDiscovery(gst.id, r.petals), 600);
    else this.toast(`${GUESTS[gst.id].name} ${gst.id === 'hedgehog' ? 'рад' : 'рада'} встрече! +${r.petals}`);
  }

  private showDiscovery(id: PlantId) {
    const def = PLANTS[id];
    play('quest');
    const sheet = this.openSheet(`<div class="sheet-hero big">${plantIcon(id, 3, 120)}</div><h2>Новое растение: ${def.name}!</h2><p>${def.fact}</p><p class="muted center">Оно добавлено в коллекцию.</p><button type="button" class="btn primary wide" data-act="ok">Здорово!</button>`);
    $(sheet, '[data-act="ok"]').addEventListener('click', () => this.closeSheet());
  }

  private showQuestDone(quests: Quest[]) {
    if (quests[0]) track('quest', { id: quests[0].id, n: this.state.questIndex });
    const back = $(this.root, '#sheetBackdrop');
    if (!back.hidden) {
      // Wait until the current sheet is closed.
      const prev = this.sheetOnClose;
      this.sheetOnClose = () => {
        prev?.();
        window.setTimeout(() => this.showQuestDone(quests), 200);
      };
      return;
    }
    const q = quests[0];
    const r = q.reward;
    const chips = [
      r.petals ? `<span class="chip">${petalIcon(18)} +${r.petals}</span>` : '',
      ...(r.plants ?? []).map((p) => `<span class="chip">${plantIcon(p, 3, 26)} ${PLANTS[p].name}</span>`),
      r.openPlots ? `<span class="chip">Новая грядка</span>` : '',
    ].join('');
    play('quest');
    this.confetti();
    const hop = $(this.root, '#listikBtn');
    hop.classList.remove('hop');
    void hop.offsetWidth;
    hop.classList.add('hop');
    const sheet = this.openSheet(
      `<div class="sheet-hero hero-hop">${listik(76)}</div><p class="eyebrow">Задание выполнено</p><h2>${q.title}</h2><p>${q.doneText}</p>${chips ? `<div class="chips">${chips}</div>` : ''}<button type="button" class="btn primary wide" data-act="ok">Дальше!</button>`,
      quests.length > 1 ? () => window.setTimeout(() => this.showQuestDone(quests.slice(1)), 200) : undefined,
    );
    $(sheet, '[data-act="ok"]').addEventListener('click', () => this.closeSheet());
    this.questCollapsed = false;
    this.tipIndex++;
  }

  private showMenu() {
    const s = this.state;
    const status = this.saveError
      ? `<p class="status bad">Сохранение не работает: ${this.saveError.message}</p>`
      : `<p class="status ok">Игра сохраняется автоматически на этом устройстве.</p>`;
    const sheet = this.openSheet(`<h2>Меню</h2>${status}
<div class="menu-list">
  <label class="toggle"><input type="checkbox" data-act="sound" ${s.settings.sound ? 'checked' : ''}><span>Звук</span></label>
  <label class="toggle"><input type="checkbox" data-act="tilt" ${s.settings.tilt ? 'checked' : ''}><span>Сад двигается, когда наклоняешь телефон</span></label>
  <label class="toggle"><input type="checkbox" data-act="journal" ${telemetryEnabled() ? 'checked' : ''}><span>Помогать улучшать игру</span></label>
  <button type="button" class="btn wide primary" data-act="photo">Сфотографировать сад</button>
  <button type="button" class="btn wide" data-act="profile">${s.profile.nick ? `${esc(s.profile.nick)} · ` : ''}${gradeOf(s)} класс — изменить</button>
  <button type="button" class="btn wide" data-act="export">Сохранить резервную копию</button>
  <button type="button" class="btn wide" data-act="import">Загрузить из копии</button>
  <button type="button" class="btn wide ghost" data-act="about">Об игре</button>
  <button type="button" class="btn wide danger" data-act="reset">Начать сад заново</button>
</div>
<p class="muted small">Резервная копия — это файл. Сохрани его в «Файлы» и загрузи, если игра потеряется или ты сменишь телефон.</p>`);
    $<HTMLInputElement>(sheet, '[data-act="sound"]').addEventListener('change', (e) => {
      this.state.settings.sound = (e.target as HTMLInputElement).checked;
      setSoundEnabled(this.state.settings.sound);
      play('tap');
      this.persist();
    });
    $<HTMLInputElement>(sheet, '[data-act="tilt"]').addEventListener('change', (e) => {
      const box = e.target as HTMLInputElement;
      this.state.settings.tilt = box.checked;
      play('tap');
      this.persist();
      void this.startTilt(true).then((ok) => {
        if (box.checked && !ok) this.toast('Телефон не разрешил наклон. Сад всё равно двигается за пальцем.', 'warn');
      });
    });
    $<HTMLInputElement>(sheet, '[data-act="journal"]').addEventListener('change', (e) => {
      setTelemetryEnabled((e.target as HTMLInputElement).checked);
      play('tap');
    });
    $(sheet, '[data-act="export"]').addEventListener('click', () => this.doExport());
    $(sheet, '[data-act="import"]').addEventListener('click', () => {
      const input = $<HTMLInputElement>(this.root, '#importFile');
      input.value = '';
      input.click();
    });
    $(sheet, '[data-act="about"]').addEventListener('click', () => this.showAbout());
    $(sheet, '[data-act="profile"]').addEventListener('click', () => this.showProfile(false));
    $(sheet, '[data-act="photo"]').addEventListener('click', () => {
      this.closeSheet();
      void this.takePhoto();
    });
    $(sheet, '[data-act="reset"]').addEventListener('click', () => this.confirmReset());
  }

  /**
   * Turn the phone's tilt on or off for the parallax. On iPhone Safari asks for motion access,
   * and only from a tap: then we ask on the first tap in the garden (or right away from the Menu).
   */
  private async startTilt(fromTap: boolean): Promise<boolean> {
    if (!this.state.settings.tilt) {
      this.depth.setTilt(false);
      return false;
    }
    if (!tiltNeedsPermission()) {
      this.depth.setTilt(true);
      return true;
    }
    if (fromTap) {
      const ok = await requestTilt();
      this.depth.setTilt(ok);
      return ok;
    }
    $(this.root, '#stage').addEventListener(
      'click',
      () => {
        if (this.state.settings.tilt) void this.startTilt(true);
      },
      { once: true },
    );
    return false;
  }

  /** «Кто играет?» — nickname and class. Shown once at the start, then from the Menu. */
  private showProfile(first: boolean, then?: () => void) {
    const s = this.state;
    let grade = s.profile.grade;
    const cards = ([2, 3, 4, 5] as const)
      .map((g) => `<button type="button" class="grade-card${grade === g ? ' on' : ''}" data-grade="${g}" aria-label="${g} класс" aria-pressed="${grade === g}">${gradeIcon(g, 48)}<b>${g}</b><span>класс</span></button>`)
      .join('');
    const sheet = this.openSheet(`<div class="sheet-hero hero-hop meet">${meetScene()}${listik(76)}</div>
<div class="meet-head"><p class="eyebrow">${first ? 'Знакомство' : 'Кто играет'}</p><h2>${first ? 'Привет! Я Листик. <span class="nb">А ты кто?</span>' : 'Имя и класс'}</h2></div>
<form data-form class="profile-form">
  <label class="field"><span class="field-title">Как тебя называть?</span><input class="answer-input name-input" type="text" maxlength="16" autocomplete="off" autocapitalize="words" enterkeyhint="done" placeholder="Например, Сёма" value="${esc(s.profile.nick)}" data-nick></label>
  <p class="field-label field-title">В каком ты классе?</p>
  <div class="grade-row" role="group" aria-label="Класс">${cards}</div>
  <p class="muted small profile-note">По классу Листик подбирает вопросы, задачи на ярмарке и слова на табличках. Имя хранится только на этом устройстве.</p>
  <div class="profile-cta"><button type="submit" class="btn primary wide big" data-act="save" ${grade ? '' : 'disabled'}>${first ? 'Начать играть!' : 'Готово'}</button>
  <p class="pick-hint">Выбери свой класс — и в путь!</p></div>
</form>`, then ? () => window.setTimeout(then, 200) : undefined);
    const save = $<HTMLButtonElement>(sheet, '[data-act="save"]');
    sheet.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach((b) =>
      b.addEventListener('click', () => {
        grade = Number(b.dataset.grade) as 2 | 3 | 4 | 5;
        play('tap');
        sheet.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach((o) => {
          const on = o === b;
          o.classList.toggle('on', on);
          o.setAttribute('aria-pressed', String(on));
        });
        save.disabled = false;
      }),
    );
    $(sheet, '[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!grade) return;
      const nick = $<HTMLInputElement>(sheet, '[data-nick]').value;
      setProfile(this.state, nick, grade, this.now());
      setTelemetryGrade(grade);
      track('profile', { first, named: Boolean(this.state.profile.nick) });
      this.persist();
      this.closeSheet();
      play('quest');
      this.toast(this.state.profile.nick ? `Рад знакомству, ${this.state.profile.nick}!` : 'Отлично, начинаем!');
    });
  }

  private showAbout() {
    this.openSheet(`<h2>Об игре</h2><p>«Зелёный сад» — уютная игра о том, как разбудить заброшенный волшебный сад. Сделана с любовью для юных садоводов.</p>
<ul class="plain"><li>Без рекламы, покупок, регистрации и чатов.</li><li>Пока игра в тестировании, она отправляет обезличенный журнал: какой вопрос или задача попались, верно ли ответ, и ошибки программы. Имя и сад не отправляются. Выключить можно в Меню: «Помогать улучшать игру».</li><li>Растения не погибают, если долго не заходить.</li><li>Работает без интернета после первой загрузки.</li></ul>
<p class="muted small">Вся графика нарисована кодом специально для этой игры, звуки синтезируются в браузере. Сторонних картинок, шрифтов и звуков нет.</p>`);
  }

  private confirmReset() {
    const sheet = this.openSheet(`<div class="sheet-hero">${listik(64, 'wow')}</div><h2>Начать заново?</h2><p>Весь сад, лепестки и коллекция пропадут. Лучше сначала сохранить резервную копию.</p>
<button type="button" class="btn wide" data-act="export">Сохранить копию</button>
<button type="button" class="btn wide danger" data-act="yes">Да, начать заново</button>`);
    $(sheet, '[data-act="export"]').addEventListener('click', () => this.doExport());
    $(sheet, '[data-act="yes"]').addEventListener('click', () => {
      const profile = this.state.profile;
      this.state = newGame(this.now());
      this.state.profile = profile;
      this.mode = 'garden';
      this.selectedDeco = null;
      this.closeSheet();
      this.commit();
      this.toast('Новый сад ждёт тебя!');
    });
  }

  private showCorruptSheet(error: string) {
    const sheet = this.openSheet(`<div class="sheet-hero">${listik(64, 'wow')}</div><h2>Сохранение повреждено</h2><p>Не получилось открыть сохранённый сад: ${error}</p><p class="muted">Повреждённые данные мы отложили отдельно и не стёрли. Можно загрузить резервную копию или начать новый сад.</p>
<button type="button" class="btn primary wide" data-act="import">Загрузить из копии</button>
<button type="button" class="btn wide" data-act="new">Начать новый сад</button>`);
    $(sheet, '[data-act="import"]').addEventListener('click', () => $<HTMLInputElement>(this.root, '#importFile').click());
    $(sheet, '[data-act="new"]').addEventListener('click', () => {
      this.closeSheet();
      this.persist();
    });
  }

  // ------------------------------------------------------------ export / import

  private doExport() {
    const now = this.now();
    const text = exportSave(this.state, now);
    const date = new Date(now).toISOString().slice(0, 10);
    const name = `zelyony-sad-${date}.json`;
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      this.toast('Резервная копия готова. Сохрани файл в надёжное место.');
    } catch {
      this.toast('Не получилось создать файл копии.', 'warn');
    }
  }

  private onImportFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      this.toast('Файл слишком большой для копии сада.', 'warn');
      return;
    }
    file
      .text()
      .then((text) => {
        const { state } = importSave(text, this.now());
        const found = PLANT_IDS.filter((id) => state.collection[id]).length;
        const sheet = this.openSheet(`<h2>Загрузить копию?</h2><p>В копии: ${petalsWord(state.petals)}, растений в коллекции — ${found}, задание ${Math.min(state.questIndex + 1, QUESTS.length)} из ${QUESTS.length}.</p><p class="muted">Текущий сад будет заменён.</p><button type="button" class="btn primary wide" data-act="yes">Загрузить</button><button type="button" class="btn wide" data-act="no">Отмена</button>`);
        $(sheet, '[data-act="yes"]').addEventListener('click', () => {
          this.state = state;
          setSoundEnabled(state.settings.sound);
          this.mode = 'garden';
          this.selectedDeco = null;
          this.closeSheet();
          advance(this.state, this.now());
          this.commit();
          this.toast('Сад загружен из копии!');
        });
        $(sheet, '[data-act="no"]').addEventListener('click', () => this.closeSheet());
      })
      .catch((e: Error) => {
        play('error');
        this.toast(e.message || 'Не удалось прочитать файл.', 'warn');
      });
  }

  // ------------------------------------------------------------ feedback

  toast(text: string, kind: 'info' | 'warn' = 'info') {
    const box = $(this.root, '#toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild?.remove();
    window.setTimeout(() => el.classList.add('out'), 3600);
    window.setTimeout(() => el.remove(), 4000);
  }

  private fx(svg: string, ms = 1300) {
    const layer = $(this.root, '#l-fx');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = svg;
    layer.appendChild(g);
    window.setTimeout(() => g.remove(), ms);
  }

  /** Petals fly from a point of the scene to the HUD counter, which counts up. */
  private flyPetals(sx: number, sy: number, amount: number) {
    const svg = $(this.root, '#scene') as unknown as SVGSVGElement;
    const target = $(this.root, '#petalsBox .petal-icon') ?? $(this.root, '#petalsBox');
    const ctm = svg.getScreenCTM?.();
    if (reducedMotion() || !ctm || typeof document.body.animate !== 'function') {
      this.bumpPetals();
      return;
    }
    const pt = svg.createSVGPoint();
    pt.x = sx;
    pt.y = sy;
    const from = pt.matrixTransform(ctm);
    const t = target.getBoundingClientRect();
    const to = { x: t.left + t.width / 2, y: t.top + t.height / 2 };
    const layer = $(this.root, '#flyLayer');
    const n = Math.max(1, Math.min(8, amount));
    const start = this.state.petals - amount;
    let arrived = 0;
    this.flying++;
    this.shownPetals = Math.max(0, start);
    $(this.root, '#petals').textContent = String(this.shownPetals);
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'fly-petal';
      el.innerHTML = petalIcon(22);
      el.style.left = `${from.x - 11}px`;
      el.style.top = `${from.y - 11}px`;
      layer.appendChild(el);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const spread = (i - (n - 1) / 2) * 16;
      const anim = el.animate(
        [
          { transform: 'translate(0, 0) scale(.6) rotate(0deg)', opacity: 0 },
          { transform: `translate(${spread}px, -40px) scale(1.15) rotate(${spread * 4}deg)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${dx}px, ${dy}px) scale(.8) rotate(${spread * 10}deg)`, opacity: 1 },
        ],
        { duration: 750 + i * 70, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' },
      );
      anim.onfinish = () => {
        el.remove();
        arrived++;
        this.shownPetals = arrived === n ? this.state.petals : start + Math.round((amount * arrived) / n);
        $(this.root, '#petals').textContent = String(this.shownPetals);
        play('tick');
        this.bumpPetals();
        if (arrived === n) {
          this.flying = Math.max(0, this.flying - 1);
          if (!this.flying) this.render();
        }
      };
    }
  }

  private bumpPetals() {
    const box = $(this.root, '#petalsBox');
    box.classList.remove('bump');
    void box.offsetWidth;
    box.classList.add('bump');
  }

  /** A short burst of falling leaves and petals over the whole screen. */
  private confetti() {
    if (reducedMotion()) return;
    const layer = $(this.root, '#flyLayer');
    const colors = ['#F59AAA', '#F6BE3B', '#93C76B', '#8C92E6', '#6EC1D9', '#FFFDF5'];
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('i');
      el.className = `confetti${i % 3 === 0 ? ' leafy' : ''}`;
      el.style.left = `${Math.random() * 100}%`;
      el.style.background = colors[i % colors.length];
      el.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
      el.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      el.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
      el.style.animationDelay = `${Math.random() * 0.25}s`;
      layer.appendChild(el);
      window.setTimeout(() => el.remove(), 3200);
    }
  }

  private floatText(x: number, y: number, text: string) {
    this.fx(`<g class="float" transform="translate(${x} ${y})"><path d="M-14 4 C-24 -2 -22 -12 -14 -13 C-6 -12 -4 -2 -14 4Z" fill="#F59AAA" stroke="#C25A6E" stroke-width="1.2"/><text x="-2" y="0" font-size="20" font-weight="800" fill="#7A2E44" stroke="#FFF6E3" stroke-width="4" paint-order="stroke">${text}</text></g>`);
  }
}

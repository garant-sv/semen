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
  bigTextOn,
  voiceOn,
  voiceWanted,
  soundOn,
  youngMode,
  nextTap,
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
  HATS,
  HAT_NAMES,
  OUTFITS,
  PETS,
  SKINS,
  START_SEEDS,
  collectStartSeed,
  seedLeft,
  gardenerByDefault,
  randomGardener,
  setGardener,
  type Gardener,
} from '../game/state';
import { setTelemetryEnabled, setTelemetryGrade, telemetryEnabled, track, trackQuest } from '../telemetry';
import {
  exportSave,
  importSave,
  loadGame,
  saveGame,
  SAVE_KEY,
  type LoadResult,
  type StorageError,
  type StorageLike,
} from '../game/save';
import { BADGES, earned, newBadges } from '../game/badges';
import type { Question } from '../game/quiz';
import { fairKind, fairLevel, makeProblem, type MathProblem } from '../game/math';
import { NO_LETTER, RULES, WORDS, viewWord, wordsForGrade, type RuleId } from '../game/russian';
import {
  ICONS,
  SHARED_DEFS,
  decoIcon,
  fairPicHTML,
  fingerSVG,
  gardenerArt,
  gardenerIcon,
  gradeIcon,
  guestArt,
  guestIcon,
  hatIcon,
  listik,
  medalIcon,
  meetScene,
  petArt,
  petalIcon,
  plantIcon,
  seedArt,
  starIcon,
} from './art';
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
  GARDENER_HOME,
  START_SEED_SPOTS,
  gardenerSpotNear,
  walkable,
} from './scene';
import { isSpeaking, onVoiceIdle, russianVoiceMissing, say, speechText, stopSpeaking, voiceSupported } from './voice';
import { loadVoicePack } from './voice-pack';
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

/** The hint finger shows up after this much quiet time. */
const FINGER_AFTER_MS = 8000;
/** Grades 4–5: the finger helps only in the first quests and waits longer. */
const FINGER_OLDER_AFTER_MS = 15_000;
const FINGER_OLDER_QUESTS = 5;
/** The scene stops its endless animations after this much quiet time (battery, warm phone). */
const SLEEPY_AFTER_MS = 30_000;

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
  /** The open sheet must be answered: no close button, a tap outside does nothing. */
  private sheetLocked = false;
  /** Last touch or key press, by the page's own clock (for the update restart). */
  private lastInputAt = 0;
  /** Whether the request on the board already had all its flowers (to announce it only once). */
  private orderWasReady = false;
  /** Where the focus was before a window opened (it goes back there when the window closes). */
  private sheetReturnFocus: HTMLElement | null = null;
  /** Garden news waiting for the open window to close (see announce). */
  private pendingNews: string[] = [];
  private newsTimer = 0;
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
  /** Where the gardener stands (scene units) and which way they look. */
  private gd: { x: number; y: number; face: number; walkTimer: number } = { x: GARDENER_HOME.garden.x, y: GARDENER_HOME.garden.y, face: 1, walkTimer: 0 };
  /** Seeds the gardener is on the way to (hidden at once so a second tap does nothing). */
  private seedsPicking = new Set<number>();
  private phase: DayPhase = 'day';
  private question: Question | null = null;
  /** The problem of the customer at the front of the queue (kept while the sheet is reopened). */
  private fairTask: { problem: MathProblem; guest: GuestId; tries: number; hinted: boolean } | null = null;
  /**
   * Nothing is written to the device: the save belongs to a newer version, the damaged-save
   * window is still waiting for an answer, or the garden is open in another tab.
   */
  private readOnly = false;
  /** Garden news that happened while the game was in the background (shown on return). */
  private awayChanges: GrowthChange[] = [];
  /** Short screens (iPhone SE): the quest card folds itself after the first tap in the garden. */
  // iPhone 13 in Safari has 664 px: the quest text must stay there, only really short screens fold it.
  private compact = window.innerHeight < 600;
  /** Last touch anywhere: the hint finger waits for a quiet moment. */
  private lastTouchAt = 0;
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
  <div class="petals" id="petalsBox"><span class="sr-only">Лепестки:</span>${petalIcon(26)}<b id="petals">0</b></div>
  <h1 class="title">Зелёный сад</h1>
  <div class="hud-right">
    <button class="mute-btn" id="muteBtn" type="button" aria-pressed="false" aria-label="Выключить звук">${ICONS.speaker}<svg class="mute-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
    <button class="listik-btn" id="listikBtn" type="button" aria-label="Листик: задание">${listik(46)}</button>
  </div>
</header>
<section class="quest" id="quest" aria-live="polite"></section>
<main class="stage" id="stage">
  <svg id="scene" viewBox="0 0 400 640" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Сад">
    <g id="view-garden"><g id="l-bg">${backgroundSVG()}</g><g id="l-brook"></g><g id="l-pond"></g><g id="l-bridge"></g><g id="l-board"></g><g id="l-stall"></g><g id="l-sign"></g><g id="l-wild"></g><g id="l-haze"></g><g id="l-objects"></g><g id="l-life"></g><g id="l-seeds"></g></g>
    <g id="view-veg" style="display:none"><g id="v-bg">${vegBackgroundSVG()}</g><g id="v-sign">${backSignSVG()}</g><g id="v-objects"></g></g>
    ${ZONE_IDS.map((z) => `<g id="view-${z}" style="display:none"><g>${zoneBackgroundSVG(z)}</g><g>${zoneBackSignSVG()}</g><g id="${z}-objects"></g></g>`).join('')}
    <g id="l-guest"></g>
    <g id="l-gardener" aria-hidden="true"></g>
    <g id="l-front" data-z="near"></g>
    <g id="l-hint"></g>
    <g id="l-sky"></g><g id="l-lights"></g><g id="l-fx"></g>
  </svg>
  <div class="mode-chip" id="modeChip" hidden></div>
  <div class="toasts" id="toasts" aria-live="polite"></div>
</main>
<nav class="nav" aria-label="Меню игры">
  <button type="button" data-nav="garden" class="active">${ICONS.garden}<span>Сад</span></button>
  <button type="button" data-nav="decor">${ICONS.decor}<span>Украсить</span></button>
  <button type="button" data-nav="map">${ICONS.map}<span>Карта</span></button>
  <button type="button" data-nav="collection">${ICONS.book}<span>Коллекция</span></button>
  <button type="button" data-nav="menu">${ICONS.menu}<span>Меню</span></button>
</nav>
<div class="sheet-backdrop" id="sheetBackdrop" hidden><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>
<div class="fly-layer" id="flyLayer" aria-hidden="true"></div>
<div class="fly-layer confetti-layer" id="confettiLayer" aria-hidden="true"></div>
<div class="rotate-hint" aria-hidden="true">${listik(72)}<p>Поверни телефон —<br>сад живёт вертикально</p></div>
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
    // Keyboard: Enter or Space on a bed, a sign, a seed… works like a tap.
    $(this.root, '#scene').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = (e.target as Element).closest('[role="button"]');
      if (!el) return;
      e.preventDefault();
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Esc closes a window that may be closed.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$(this.root, '#sheetBackdrop').hidden && !this.sheetLocked) this.closeSheet();
    });
    this.lastTouchAt = this.now();
    const wake = () => {
      this.lastTouchAt = this.now();
      this.lastInputAt = performance.now();
      $(this.root, '#stage').classList.remove('sleepy');
    };
    this.root.addEventListener(
      'pointerdown',
      () => {
        wake();
        if (this.cache.get('hint')) this.setLayer('hint', $(this.root, '#l-hint'), '');
      },
      { capture: true, passive: true },
    );
    this.root.addEventListener('keydown', wake, { capture: true, passive: true });
    $(this.root, '#muteBtn').addEventListener('click', () => this.toggleMute());
    // The speaker button: the first tap reads, a tap while Listik reads stops him.
    onVoiceIdle(() => this.markSpeaking(null));
    this.root.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-say]');
      if (!b) return;
      e.stopPropagation();
      e.preventDefault();
      if (b.classList.contains('speaking') && isSpeaking()) {
        stopSpeaking();
        return;
      }
      if (say(b.dataset.say ?? '', youngMode(this.state))) this.markSpeaking(b.dataset.say ?? '');
    });
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
      if (e.target === e.currentTarget && !this.sheetLocked) this.closeSheet();
    });
    $(this.root, '#importFile').addEventListener('change', (e) => this.onImportFile(e.target as HTMLInputElement));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = this.now();
        this.persist();
        // Nobody sees the garden: no need to redraw it every second in the background.
        clearInterval(this.tickTimer);
      } else {
        if (!this.readOnly) {
          clearInterval(this.tickTimer);
          this.tickTimer = window.setInterval(() => this.refresh(false), 1000);
        }
        const greet = this.now() - this.hiddenAt > 30_000;
        this.refresh(greet);
        if (!greet) this.awayChanges = [];
      }
    });
    window.addEventListener('pagehide', () => this.persist());
    window.addEventListener('focus', () => this.refresh(false));
    // Another tab saved the garden: this copy is old now, so it must not write over it.
    window.addEventListener('storage', (e) => {
      if (e.key === SAVE_KEY && e.newValue !== null && !this.readOnly) this.showOtherTab();
    });
  }

  private showOtherTab() {
    this.readOnly = true;
    clearInterval(this.tickTimer);
    stopSpeaking();
    const sheet = this.openSheet(
      `<div class="sheet-hero">${listik(64, 'wow')}</div><h2>Сад открыт в другом окне</h2><p>Играть можно только в одном окне, иначе сад запутается. Здесь он остановлен.</p>
<button type="button" class="btn primary wide" data-act="here">Играть здесь</button>`,
      undefined,
      { locked: true },
    );
    $(sheet, '[data-act="here"]').addEventListener('click', () => location.reload());
  }

  private showNewerSave() {
    this.readOnly = true;
    const sheet = this.openSheet(
      `<div class="sheet-hero">${listik(64, 'wow')}</div><h2>Игра обновилась</h2><p>Твой сад сохранён в новой версии игры. Нажми «Обновить», и он откроется.</p>
<button type="button" class="btn primary wide" data-act="reload">Обновить</button>`,
      undefined,
      { locked: true },
    );
    $(sheet, '[data-act="reload"]').addEventListener('click', () => {
      const go = () => location.reload();
      if (!('serviceWorker' in navigator)) return go();
      navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.update())
        .catch(() => {})
        .finally(() => window.setTimeout(go, 1500));
    });
  }

  /**
   * Fill the stage edge to edge: on short screens crop the sky (never the beds),
   * on very short screens keep the whole garden and let the extended meadow fill the sides.
   */
  private fitScene(w: number, h: number) {
    if (!w || !h) return;
    const visible = (400 * h) / w;
    // Wide screens (tablet, computer) lose less sky, so the treetops along the fence stay whole.
    const MAX_CROP = w / h > 0.9 ? 90 : 150;
    let vb: string;
    if (visible >= 640) vb = `0 ${640 - visible} 400 ${visible}`;
    else if (visible >= 640 - MAX_CROP) vb = `0 ${640 - visible} 400 ${visible}`;
    else vb = `0 ${MAX_CROP} 400 ${640 - MAX_CROP}`;
    $(this.root, '#scene').setAttribute('viewBox', vb);
  }

  private afterLoad(loaded: LoadResult) {
    setSoundEnabled(soundOn(this.state));
    void this.startTilt(false);
    this.applyTextSize();
    this.prepareVoice();
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
    if (loaded.status === 'newer') {
      this.showNewerSave();
      return;
    }
    if (loaded.status === 'corrupt') this.showCorruptSheet(loaded.error);
    else if (loaded.status === 'ok') {
      if (loaded.fromBackup) this.toast('Основное сохранение было повреждено — открыта предыдущая копия.', 'warn');
      if (loaded.migratedFrom) this.toast('Сохранение обновлено для новой версии игры.');
      this.welcomeBack(changes);
    }
    if (loaded.status !== 'corrupt') this.persist();
    const quests = done.length ? () => this.showQuestDone(done) : undefined;
    if (loaded.status !== 'corrupt' && !this.state.profile.grade) this.showProfile(true, quests);
    else if (loaded.status !== 'corrupt' && gardenerByDefault(this.state) && !this.state.gardener) this.showGardener(true, quests);
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
    // In the background the browser may still tick (Android, computers): keep the news for
    // the «while you were away» card instead of using it up unseen.
    const hidden = document.visibilityState === 'hidden';
    if (hidden) this.awayChanges.push(...changes);
    if (changes.length) {
      const done = checkQuests(this.state, now);
      this.persist();
      if (done.length) this.showQuestDone(done);
    }
    if (greet && !hidden) {
      const all = [...this.awayChanges, ...changes];
      this.awayChanges = [];
      if (all.length) this.welcomeBack(all);
    }
    if (this.awayChanges.length > 60) this.awayChanges = this.awayChanges.slice(-60);
    this.render();
    this.tickGuests(now);
    // «Sleepy garden»: after a quiet half minute the grass and leaves stop swaying (they kept the
    // phone busy and warm for nothing); the first touch wakes everything up again.
    $(this.root, '#stage').classList.toggle('sleepy', now - this.lastTouchAt > SLEEPY_AFTER_MS);
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
    if (quiz) window.setTimeout(() => this.announce('У Листика есть вопрос для тебя! Нажми на Листика вверху.'), done.length ? 1600 : 500);
    for (const b of badges) window.setTimeout(() => this.announce(`Новый значок: «${b.name}»!`), 900);
    if (fairOpened) {
      this.prepareVoice();
      window.setTimeout(() => {
        this.announce('Листик: у забора открылась Ярмарка урожая! К прилавку приходят покупатели — помоги им посчитать.');
        this.fx(ringFx(STALL.x, STALL.y - 40, '#FFF3B8', 40));
      }, done.length ? 2200 : 600);
    }
    // The guest's request is fulfilled: say so once, so the child knows to go to the board.
    const ready = orderComplete(this.state);
    if (ready && !this.orderWasReady) window.setTimeout(() => this.announce('Листик: цветов для просьбы хватает! Отнеси их гостю — нажми на доску у ручья.'), 400);
    this.orderWasReady = ready;
    if (newOrder && this.state.ordersDone === 0) {
      window.setTimeout(() => {
        this.announce('Листик: на доске у ручья появилась первая просьба от гостя! Загляни.');
        this.fx(ringFx(BOARD.x, BOARD.y - 40, '#FFF3B8', 34));
      }, done.length ? 1400 : 300);
    }
  }

  private persist() {
    if (this.readOnly) return;
    const r = saveGame(this.storage, this.state);
    if (r.ok) {
      if (this.saveError) this.setSaveError(null);
    } else if (r.error.kind === 'newer') {
      this.showNewerSave();
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
    if (bloomed.length) this.announce(`Пока тебя не было, расцвели: ${bloomed.join(', ')}.`);
    else this.announce('Пока тебя не было, растения подросли и ждут полива.');
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
    this.applyTextSize();
    this.renderMute();
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
    $(this.root, '#listikBtn').setAttribute('aria-label', s.quiz.pending ? 'Листик: у меня вопрос!' : 'Листик: задание');
    this.setLayer('pond', $(this.root, '#l-pond'), pondSVG(s.restored.pond));
    this.setLayer('bridge', $(this.root, '#l-bridge'), bridgeSVG(s.restored.bridge));
    this.setLayer('wild', $(this.root, '#l-wild'), wildSVG(progress));
    this.setLayer('haze', $(this.root, '#l-haze'), hazeSVG(progress));
    this.setLayer('life', $(this.root, '#l-life'), lifeSVG(s));
    this.setLayer('seeds', $(this.root, '#l-seeds'), this.seedsSVG());
    this.renderGardener();
    this.setLayer('front', $(this.root, '#l-front'), frontSVG(this.view));
    this.setLayer('hint', $(this.root, '#l-hint'), this.fingerHint(now));
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
      const on = b.dataset.nav === (this.mode === 'decor' ? 'decor' : 'garden');
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
      if (b.dataset.nav === 'decor') {
        b.classList.toggle('dim', !decorAvailable(s));
        b.setAttribute('aria-disabled', String(!decorAvailable(s)));
      }
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
      this.announce(`Ого! Расцвёл золотой цветок: ${PLANTS[cur.plant].name}!`);
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
  <div class="quest-avatar">${listik(42)}${this.speakBtn(`${q.title}. ${q.text} ${q.goals.map((g) => this.goalLabel(g)).join('. ')}.`)}</div>
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
  <div class="quest-avatar">${listik(42)}${this.speakBtn(`Сад проснулся! ${tip}`)}</div>
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
    const seed = t.closest<SVGGElement>('[data-seed]');
    if (seed && this.mode === 'garden') return this.onSeed(Number(seed.dataset.seed));
    const sign = t.closest<SVGGElement>('[data-sign]');
    if (sign && this.mode === 'garden') return this.showSign(Number(sign.dataset.sign));
    const go = t.closest<SVGGElement>('[data-go]');
    if (go && this.mode === 'garden') return this.onSign(go.dataset.go as AreaId);
    if (slot && this.mode === 'decor') return this.onSlot(Number(slot.dataset.slot));
    if (t.closest('[data-board]') && this.mode === 'garden') return this.showOrderSheet();
    if (t.closest('[data-fair]') && this.mode === 'garden') return this.showFair();
    if (plot) {
      const i = Number(plot.dataset.plot);
      const spot = gardenerSpotNear(plotPos(i));
      this.walkTo(spot.x, spot.y);
      return this.onPlot(i);
    }
    if (lm) return this.onLandmark(lm.dataset.landmark as Landmark);
    // Grass: the gardener walks to where the child tapped.
    if (this.mode === 'garden' && e instanceof MouseEvent) {
      const pt = this.scenePoint(e.clientX, e.clientY);
      if (pt && walkable(pt.x, pt.y)) this.walkTo(pt.x, pt.y);
    }
  }

  // ------------------------------------------------------------ gardener

  /** Scene coordinates (viewBox units) of a point on the screen. */
  private scenePoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = $(this.root, '#scene') as unknown as SVGSVGElement;
    const m = svg.getScreenCTM?.();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  /** The gardener and the pet: the look is drawn once, the position is a CSS transform (so it glides). */
  private renderGardener() {
    const g = this.state.gardener;
    const layer = $(this.root, '#l-gardener');
    const html = g
      ? `<g class="gd-pet" data-pet="${g.pet}"><g class="gd-flip">${petArt(g.pet)}</g></g><g class="gd-me"><g class="gd-flip"><g class="gd-body">${gardenerArt(g)}</g></g></g>`
      : '';
    this.setLayer('gardener', layer, html);
    if (g) this.placeGardener();
  }

  private placeGardener() {
    const layer = $(this.root, '#l-gardener');
    const me = layer.querySelector<SVGGElement>('.gd-me');
    const pet = layer.querySelector<SVGGElement>('.gd-pet');
    if (!me || !pet) return;
    const { x, y, face } = this.gd;
    // The transform attribute keeps the photo right; the style makes the move animate on screen.
    const at = (el: SVGGElement, px: number, py: number) => {
      el.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
      el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    };
    at(me, x, y);
    at(pet, x - face * 26, y + 3);
    layer.querySelectorAll<SVGGElement>('.gd-flip').forEach((f) => {
      f.setAttribute('transform', `scale(${face} 1)`);
      f.style.transform = `scaleX(${face})`;
    });
  }

  /** Walk to a point (instantly when nothing is there yet). Returns how long the walk takes, ms. */
  private walkTo(x: number, y: number): number {
    if (!this.state.gardener) return 0;
    const dist = Math.hypot(x - this.gd.x, y - this.gd.y);
    if (dist < 4) return 0;
    if (Math.abs(x - this.gd.x) > 3) this.gd.face = x < this.gd.x ? -1 : 1;
    this.gd.x = x;
    this.gd.y = y;
    const layer = $(this.root, '#l-gardener');
    const ms = Math.round(Math.min(650, 220 + dist * 1.4));
    layer.style.setProperty('--walk', `${ms}ms`);
    layer.classList.add('walking');
    this.placeGardener();
    clearTimeout(this.gd.walkTimer);
    this.gd.walkTimer = window.setTimeout(() => layer.classList.remove('walking'), ms);
    return ms;
  }

  /** Put the gardener at the home spot of the current view without walking. */
  private homeGardener() {
    const h = GARDENER_HOME[this.view === 'garden' ? 'garden' : 'other'];
    const layer = $(this.root, '#l-gardener');
    layer.classList.add('jump');
    this.gd = { ...this.gd, x: h.x, y: h.y, face: 1 };
    this.placeGardener();
    void (layer as unknown as HTMLElement).getBoundingClientRect();
    window.setTimeout(() => layer.classList.remove('jump'), 50);
  }

  /** Seeds the wind scattered at the start (only in the garden). */
  private seedsSVG(): string {
    return START_SEED_SPOTS.map((p, k) =>
      !seedLeft(this.state, k)
        ? ''
        : `<g class="start-seed" data-seed="${k}" transform="translate(${p.x} ${p.y})" role="button" tabindex="0" aria-label="Семечко на траве"><rect x="-30" y="-42" width="60" height="60" fill="transparent"/>${seedArt()}</g>`,
    ).join('');
  }

  private onSeed(k: number) {
    const spot = START_SEED_SPOTS[k];
    if (!spot || this.seedsPicking.has(k)) return;
    // Quick taps on several seeds all count: each seed is picked when the gardener gets there.
    this.seedsPicking.add(k);
    const ms = this.walkTo(spot.x + (spot.x > 200 ? -20 : 20), spot.y + 4);
    window.setTimeout(() => {
      this.seedsPicking.delete(k);
      const r = collectStartSeed(this.state, k, this.now());
      if (!r.ok) return;
      play('harvest');
      this.fx(burstSVG(spot.x, spot.y - 6, 'magic'));
      this.floatText(spot.x, spot.y - 40, `+${r.petals}`);
      this.flyPetals(spot.x, spot.y - 20, r.petals);
      this.persist();
      this.render();
      if (r.left === 0) {
        track('seeds', { n: START_SEEDS });
        this.toast('Все семена собраны! Теперь посади ромашку.');
      }
    }, Math.max(150, ms - 80));
  }

  /** «Твой садовник»: choose the look and a pet. First time (3–5 class) it starts the game. */
  private showGardener(first: boolean, then?: () => void) {
    const s = this.state;
    const g: Gardener = s.gardener ? { ...s.gardener } : randomGardener(Math.random);
    const row = (title: string, items: string[]) =>
      `<p class="field-title gd-row-title">${title}</p><div class="gd-row" role="group" aria-label="${title}">${items.join('')}</div>`;
    const btn = (key: string, val: string | number, inner: string, label: string) =>
      `<button type="button" class="gd-opt" data-k="${key}" data-v="${val}" aria-label="${label}">${inner}</button>`;
    const html = `<p class="eyebrow">${first ? 'Новый садовник' : 'Мой садовник'}</p><h2>${first ? 'Каким будет твой садовник?' : 'Твой садовник'}</h2>
<div class="gd-preview" data-preview></div>
${row('Лицо', SKINS.map((c, i) => btn('skin', i, `<span class="swatch" style="background:${c}"></span>`, `Лицо: ${['светлое', 'смуглое', 'тёмное'][i] ?? i + 1}`)))}
${row('Шляпа', HATS.map((h) => btn('hat', h, hatIcon(h, OUTFITS[g.outfit], 46), HAT_NAMES[h])))}
${row('Одежда', OUTFITS.map((c, i) => btn('outfit', i, `<span class="swatch" style="background:${c}"></span>`, `Одежда: ${['зелёная', 'синяя', 'оранжевая', 'фиолетовая', 'малиновая'][i] ?? i + 1}`)))}
${row('Питомец', PETS.map((p) => btn('pet', p, guestIcon(p, 46), GUESTS[p].name)))}
<div class="gd-actions"><button type="button" class="btn wide" data-act="random">Случайно</button><button type="button" class="btn primary wide big" data-act="ok">${first ? 'В сад!' : 'Готово'}</button></div>`;
    const sheet = this.openSheet(html, then ? () => window.setTimeout(then, 200) : undefined);
    sheet.classList.add('gardener-sheet');
    const sync = () => {
      $(sheet, '[data-preview]').innerHTML = gardenerIcon(g, 150);
      sheet.querySelectorAll<HTMLButtonElement>('.gd-opt').forEach((b) => {
        const on = String(g[b.dataset.k as keyof Gardener]) === b.dataset.v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        if (b.dataset.k === 'hat') b.innerHTML = hatIcon(b.dataset.v as Gardener['hat'], OUTFITS[g.outfit], 46);
      });
    };
    sheet.querySelectorAll<HTMLButtonElement>('.gd-opt').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k as keyof Gardener;
        const v = b.dataset.v ?? '';
        if (k === 'skin' || k === 'outfit') g[k] = Number(v);
        else if (k === 'hat') g.hat = v as Gardener['hat'];
        else g.pet = v as Gardener['pet'];
        play('tap');
        sync();
      }),
    );
    $(sheet, '[data-act="random"]').addEventListener('click', () => {
      Object.assign(g, randomGardener(Math.random));
      play('tap');
      sync();
    });
    $(sheet, '[data-act="ok"]').addEventListener('click', () => {
      const wasNew = this.state.gardener === null;
      const r = setGardener(this.state, g, this.now());
      track('gardener', { first: wasNew, hat: g.hat, pet: g.pet });
      this.persist();
      this.closeSheet();
      play('quest');
      if (this.view !== 'garden') this.goTo('garden');
      this.homeGardener();
      this.render();
      const hi = this.state.profile.nick ? `${this.state.profile.nick}, ветер` : 'Ветер';
      if (r.scattered) {
        window.setTimeout(() => this.toast(`${hi} раскидал семена! Нажми на каждое — садовник соберёт.`), 400);
      } else if (wasNew) this.toast('Садовник в саду! Нажимай на траву — он пойдёт туда.');
    });
    sync();
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
    this.homeGardener();
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

  /**
   * Open a sheet over the garden. A `locked` sheet has no close button and does not close on a tap
   * outside: it is used where a choice must be made (the first «Кто играет?»).
   */
  private openSheet(html: string, onClose?: () => void, opts: { locked?: boolean } = {}) {
    const back = $(this.root, '#sheetBackdrop');
    const sheet = $(this.root, '#sheet');
    this.sheetLocked = Boolean(opts.locked);
    // Messages from before belong to the garden: they must not cover the window's title and «×».
    $(this.root, '#toasts').replaceChildren();
    if (back.hidden) this.sheetReturnFocus = document.activeElement as HTMLElement | null;
    sheet.innerHTML = `${this.sheetLocked ? '' : `<button type="button" class="sheet-close" aria-label="Закрыть">${ICONS.close}</button>`}${html}`;
    back.hidden = false;
    // For screen readers and the keyboard: the window has a name, the focus moves into it and
    // the garden behind it cannot be reached until it is closed.
    const title = sheet.querySelector('h2');
    if (title) {
      title.id = 'sheetTitle';
      title.tabIndex = -1;
      sheet.setAttribute('aria-labelledby', 'sheetTitle');
    } else sheet.removeAttribute('aria-labelledby');
    this.setBehindInert(true);
    (title ?? sheet).focus({ preventScroll: true });
    this.sheetOnClose = onClose ?? null;
    sheet.querySelector('.sheet-close')?.addEventListener('click', () => this.closeSheet());
    return sheet;
  }

  private setBehindInert(on: boolean) {
    for (const sel of ['header.hud', '#quest', '#stage', 'nav.nav']) {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (el) el.inert = on;
    }
  }

  /** True when nothing is open on top of the garden, so the game may restart itself to update. */
  isIdle(): boolean {
    // Not while Listik reads aloud, and not right under the finger of a child who is playing.
    return $(this.root, '#sheetBackdrop').hidden && !isSpeaking() && performance.now() - this.lastInputAt > 3000;
  }

  closeSheet() {
    const back = $(this.root, '#sheetBackdrop');
    if (back.hidden) return;
    back.hidden = true;
    this.sheetLocked = false;
    this.setBehindInert(false);
    const ret = this.sheetReturnFocus;
    this.sheetReturnFocus = null;
    if (ret && ret.isConnected) ret.focus({ preventScroll: true });
    stopSpeaking();
    this.flushNews();
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
      return `<button type="button" class="card" data-plant="${id}">${plantIcon(id, 3, 64)}<b>${def.name}</b><small>${formatDuration(def.growSeconds * 1000)} · ${petalIcon(14)} +${def.petals}</small></button>`;
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
            window.setTimeout(() => this.announce('Листик: у грядки появилась табличка, но в слове пропущена буква. Нажми на табличку!'), 900);
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
      // Only the words of the child's class: «0 из 99» could never be reached in the 2nd class.
      const gradeWords = wordsForGrade(gradeOf(s));
      const learned = new Set(s.rus.learned.filter((id) => gradeWords.some((w) => w.id === id)));
      const groups = (Object.keys(RULES) as RuleId[])
        .map((rule) => {
          const words = gradeWords.filter((w) => w.rule === rule && learned.has(w.id));
          const all = gradeWords.filter((w) => w.rule === rule).length;
          const chips = words.map((w) => `<span class="word-chip" title="${w.why.replace(/"/g, '&quot;')}">${viewWord(w).full}</span>`).join('');
          return `<h3 class="sub">${RULES[rule]} <span class="muted small">${words.length}/${all}</span></h3><div class="word-chips">${chips || '<span class="muted small">Пока пусто — заполняй таблички у грядок.</span>'}</div>`;
        })
        .join('');
      body = `<p class="muted">Слова, вписанные на табличках без ошибки: ${learned.size} из ${gradeWords.length}. Таблички появляются у грядок после посадки.</p>${groups}`;
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
      `<button type="button" role="tab" aria-selected="${this.collectionTab === id}" class="tab${this.collectionTab === id ? ' active' : ''}" data-tab="${id}">${label} <span>${n}/${total}</span></button>`;
    const sheet = this.openSheet(
      `<h2>Коллекция</h2><div class="tabs" role="tablist">${tab('plants', 'Растения', plantsFound, PLANT_IDS.length)}${tab('guests', 'Гости', guestsFound, GUEST_IDS.length)}${tab('words', 'Слова', wordsForGrade(gradeOf(s)).filter((w) => s.rus.learned.includes(w.id)).length, wordsForGrade(gradeOf(s)).length)}${tab('badges', 'Значки', earned(s).length, BADGES.length)}</div>${body}`,
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
<p class="muted">Считаются только цветы, собранные после того, как появилась эта просьба. Выполнено просьб: ${s.ordersDone}.</p>
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
    const spoken = `${q.text} ${options.join('? ')}?`;
    // 2–3 class: options with pictures where the question has them.
    const pics = youngMode(s) && q.pics ? q.pics : null;
    const sheet = this.openSheet(`<div class="sheet-hero hero-hop">${listik(64, 'wow')}</div><p class="eyebrow">Вопрос Листика · ${q.topic}</p><h2>${q.text}${this.speakBtn(spoken)}</h2>
<div class="answers${pics ? ' with-pics' : ''}">${options
      .map((o, i) => `<button type="button" class="btn wide answer" data-answer="${i}">${pics ? `<span class="pic" aria-hidden="true">${pics[q.options.indexOf(o)]}</span>` : ''}<span>${o}</span></button>`)
      .join('')}</div>
<p class="muted small center">${gradeOf(this.state) >= 5 ? 'Вопрос о природе, как на уроках биологии.' : 'Вопрос из «Окружающего мира».'} Ошибиться не страшно — Листик подскажет.</p>`);
    this.autoSay(spoken);
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
        const said = `${r.correct ? 'Верно!' : `Почти! Правильный ответ: ${q.options[0]}.`} ${q.explain}`;
        box.setAttribute('role', 'status');
        box.innerHTML = `<b>${r.correct ? `Верно! +${r.petals}` : `Почти! Правильный ответ: ${q.options[0]}. +${r.petals} за старание`}${this.speakBtn(said)}</b><p>${q.explain}</p><button type="button" class="btn primary wide" data-act="ok">${r.correct ? 'Ура!' : 'Понятно'}</button>`;
        box.querySelector<HTMLElement>('[data-act="ok"]')?.focus({ preventScroll: true });
        $(sheet, '.answers').after(box);
        this.autoSay(said);
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
      // The explanation already names the word, so it is not said twice.
      this.toast(w.why.toLowerCase().includes(v.full.toLowerCase()) ? w.why : `«${v.full}». ${w.why}`);
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
        const said = `${r.correct ? 'Верно!' : `Правильно: ${r.answer === NO_LETTER ? 'без буквы' : `буква ${r.answer}`}.`} ${v.full}. ${w.why}`;
        box.innerHTML = `<b>${r.correct ? `Верно! +${r.petals}` : `Правильно: ${r.answer === NO_LETTER ? 'без буквы' : `«${r.answer}»`}. +${r.petals} за старание`}${this.speakBtn(said)}</b><p></p><button type="button" class="btn primary wide" data-act="ok">${r.correct ? 'Ура!' : 'Понятно'}</button>`;
        $(box, 'p').textContent = w.why;
        $(sheet, '[data-result]').replaceChildren(box);
        this.autoSay(said);
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
    const level = fairLevel(s.fair.solved, gradeOf(s), s.fair.ease);
    if (s.fair.queue <= 0) {
      this.openSheet(`<div class="sheet-hero">${listik(64)}</div><p class="eyebrow">Ярмарка урожая · уровень ${level}</p><h2>Покупателей пока нет</h2><p>Следующий придёт через ${formatDuration(nextCustomerIn(s, now), true)}. А пока можно поливать и собирать урожай!</p><p class="muted">Решено задач: ${s.fair.solved}, с первой попытки: ${s.fair.firstTry}.</p>`);
      return;
    }
    if (!this.fairTask) {
      const pool = GUEST_IDS.filter((id) => GUESTS[id].area === 'garden' || s.guests[id]);
      const guest = pool[Math.floor(Math.random() * pool.length)];
      this.fairTask = { guest, problem: makeProblem(level, Math.random, GUESTS[guest].name, fairKind(s.fair.solved, gradeOf(s)), gradeOf(s)), tries: 0, hinted: false };
    }
    // Tries and the hint belong to this customer: closing and reopening the window keeps them.
    const task = this.fairTask;
    const { problem: p, guest } = task;
    let done = false;
    const sheet = this.openSheet(`<div class="fair-head">${guestIcon(guest, 84)}<div><p class="eyebrow">Ярмарка урожая · уровень ${level}</p><p class="small muted">Покупателей ждёт: ${s.fair.queue}</p></div></div>
<div class="bubble">${p.text}${this.speakBtn(p.text)}</div>
${youngMode(s) && p.pic ? fairPicHTML(p.pic) : ''}
<form class="answer-row" data-form>
  <input class="answer-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="Ответ" placeholder="?">
  <span class="unit">${p.unit}</span>
</form>
<div class="fair-buttons"><button type="button" class="btn ghost" data-act="hint">Подсказка</button><button type="button" class="btn primary" data-act="check">Проверить</button></div>
<div data-result></div>`);
    const input = $<HTMLInputElement>(sheet, '.answer-input');
    const result = $(sheet, '[data-result]');
    this.autoSay(p.text);
    const finish = (r: FairResult) => {
      done = true;
      const served = serveCustomer(this.state, r, this.now());
      this.fairTask = null;
      track('fair', { k: p.kind, lvl: level, r, hint: task.hinted });
      if (!served.ok) return;
      input.disabled = true;
      sheet.querySelectorAll<HTMLButtonElement>('.fair-buttons .btn').forEach((b) => (b.disabled = true));
      const more = this.state.fair.queue > 0;
      const title =
        r === 'failed'
          ? `Правильный ответ: ${p.answerText}. +${served.petals} за старание`
          : r === 'first'
            ? `Верно! +${served.petals}`
            : task.tries === 0
              ? `Верно, с подсказкой! +${served.petals}`
              : `Верно, со второй попытки! +${served.petals}`;
      const said = `${r === 'failed' ? `Правильный ответ: ${p.answerText}.` : 'Верно!'} Решение: ${p.solution}`;
      result.innerHTML = `<div class="explain ${r === 'failed' ? 'try' : 'ok'}" role="status"><b>${title}${this.speakBtn(said)}</b><p>Решение: ${p.solution}</p><button type="button" class="btn primary wide" data-act="next">${more ? 'Следующий покупатель' : 'Готово'}</button></div>`;
      play(r === 'failed' ? 'tap' : 'quest');
      if (r === 'first') this.confetti();
      this.commit();
      this.bumpPetals();
      $(result, '[data-act="next"]').focus({ preventScroll: true });
      $(result, '[data-act="next"]').addEventListener('click', () => {
        this.closeSheet();
        if (more) window.setTimeout(() => this.showFair(), 150);
      });
    };
    const showHint = (lead: string) => {
      task.hinted = true;
      const box = document.createElement('p');
      box.className = 'hint-box';
      box.textContent = `${lead}${p.hint}`;
      result.replaceChildren(box);
      this.autoSay(box.textContent ?? '');
    };
    const check = () => {
      if (done) return;
      const raw = input.value.replace(/\s/g, '');
      if (!/^\d+$/.test(raw)) {
        if (raw) track('fair_bad', { k: p.kind, len: raw.length, sep: /[.,]/.test(raw) });
        // Say it in words too: the shake alone is invisible with «reduce motion» and tells nothing.
        let note = sheet.querySelector<HTMLElement>('[data-format]');
        if (!note) {
          note = document.createElement('p');
          note.className = 'muted small center';
          note.dataset.format = '';
          result.before(note);
        }
        note.textContent = raw ? 'Напиши ответ только цифрами, например: 25.' : 'Сначала напиши ответ в окошко.';
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
        input.focus();
        return;
      }
      if (Number(raw) === p.answer) return finish(task.tries === 0 && !task.hinted ? 'first' : 'second');
      track('fair_try', { k: p.kind, lvl: level, ans: Number(raw), want: p.answer });
      task.tries += 1;
      if (task.tries >= 2) return finish('failed');
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
      if (!done && !task.hinted) showHint('Подсказка: ');
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
      return `<g class="band${open ? ' open' : ''}" data-zone="${z.id}" role="button" tabindex="0" aria-label="${z.name}: ${status}"><rect x="0" y="${y}" width="320" height="${bandH}" fill="${z.color}"/><text x="14" y="${y + 24}" font-size="16" font-weight="800" fill="${dark ? '#FFF6E3' : '#3B2E1E'}">${z.name}</text><text x="14" y="${y + 42}" font-size="12" fill="${dark ? '#E3EFD6' : '#6B5A43'}">${status}</text>${zone && !open && landmarkAvailable(s, zone) ? `<circle class="pulse" cx="296" cy="${y + 27}" r="9" fill="#F6BE3B"/>` : ''}</g>`;
    }).join('');
    const sheet = this.openSheet(`<h2>Карта природных зон</h2><p class="muted">Россия с севера на юг. Чем южнее, тем теплее. Нажми на зону, чтобы узнать о ней.</p>
<div class="map-wrap"><svg class="map" viewBox="0 0 320 ${bandH * ZONE_ATLAS.length}" role="group" aria-label="Природные зоны">${bands}<g pointer-events="none"><text x="306" y="16" font-size="11" text-anchor="end" fill="#6B5A43">Север ↑</text><text x="306" y="${bandH * ZONE_ATLAS.length - 6}" font-size="11" text-anchor="end" fill="#6B5A43">Юг ↓</text></g></svg></div>
<div id="zoneCard"></div>`);
    const show = (id: string, scroll = true) => {
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
      // Only when the child picked a zone: on opening, the map's title must stay in sight.
      if (scroll) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    sheet.querySelectorAll<SVGGElement>('[data-zone]').forEach((g) =>
      g.addEventListener('click', () => {
        play('tap');
        show(g.dataset.zone!);
      }),
    );
    show(this.view === 'garden' || this.view === 'veg' ? 'mixed' : this.view, false);
  }

  private showGuestDiscovery(id: GuestId, petals: number) {
    const def = GUESTS[id];
    play('quest');
    const sheet = this.openSheet(`<div class="sheet-hero big">${guestIcon(id, 120)}</div><p class="eyebrow">Новый гость</p><h2>В гостях: ${def.name}!</h2><p>${def.fact}${this.speakBtn(def.fact)}</p><p class="muted center">За знакомство: +${petals}. Гость добавлен в «Коллекцию».</p><button type="button" class="btn primary wide" data-act="ok">Привет!</button>`);
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
    else this.toast(`${GUESTS[gst.id].name}: «Спасибо, что заметили!» +${r.petals}`);
  }

  private showDiscovery(id: PlantId) {
    const def = PLANTS[id];
    play('quest');
    const sheet = this.openSheet(`<div class="sheet-hero big">${plantIcon(id, 3, 120)}</div><h2>Новое растение: ${def.name}!</h2><p>${def.fact}${this.speakBtn(def.fact)}</p><p class="muted center">Оно добавлено в коллекцию.</p><button type="button" class="btn primary wide" data-act="ok">Здорово!</button>`);
    $(sheet, '[data-act="ok"]').addEventListener('click', () => this.closeSheet());
  }

  private showQuestDone(quests: Quest[]) {
    if (quests[0]) trackQuest(quests[0].id, QUESTS.indexOf(quests[0]) + 1 || this.state.questIndex);
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
    if (quests.length > 1) {
      // Several at once (they were done before they were shown): one window, not four in a row.
      for (const x of quests.slice(1)) trackQuest(x.id, QUESTS.indexOf(x) + 1 || this.state.questIndex);
      const petals = quests.reduce((n, x) => n + (x.reward.petals ?? 0), 0);
      const plants = quests.flatMap((x) => x.reward.plants ?? []);
      const plots = quests.reduce((n, x) => n + (x.reward.openPlots ?? 0), 0);
      const chips = [
        petals ? `<span class="chip">${petalIcon(18)} +${petals}</span>` : '',
        ...plants.map((p) => `<span class="chip">${plantIcon(p, 3, 26)} ${PLANTS[p].name}</span>`),
        plots ? `<span class="chip">${plots > 1 ? `Новые грядки: ${plots}` : 'Новая грядка'}</span>` : '',
      ].join('');
      play('quest');
      this.confetti();
      const sheet = this.openSheet(
        `<div class="sheet-hero hero-hop">${listik(76)}</div><p class="eyebrow">Заданий выполнено: ${quests.length}</p><h2>Ты молодец!</h2><ul class="plain done-list">${quests.map((x) => `<li>✓ ${x.title}</li>`).join('')}</ul>${chips ? `<div class="chips">${chips}</div>` : ''}<button type="button" class="btn primary wide" data-act="ok">Дальше!</button>`,
      );
      $(sheet, '[data-act="ok"]').addEventListener('click', () => this.closeSheet());
      this.questCollapsed = false;
      this.tipIndex++;
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
  ${voiceSupported() ? `<label class="toggle"><input type="checkbox" data-act="voice" ${voiceWanted(s) ? 'checked' : ''}><span>Листик читает вслух</span></label>` : ''}
  <label class="toggle"><input type="checkbox" data-act="bigtext" ${bigTextOn(s) ? 'checked' : ''}><span>Крупный текст</span></label>
  <label class="toggle"><input type="checkbox" data-act="tilt" ${s.settings.tilt ? 'checked' : ''}><span>Наклон телефона двигает сад</span></label>
  <label class="toggle"><input type="checkbox" data-act="journal" ${telemetryEnabled() ? 'checked' : ''}><span>Помогать улучшать игру</span></label>
  <button type="button" class="btn wide primary" data-act="photo">Сфотографировать сад</button>
  <button type="button" class="btn wide" data-act="gardener">${s.gardener ? 'Мой садовник' : 'Позвать садовника'}</button>
  <button type="button" class="btn wide" data-act="profile">${s.profile.nick ? `${esc(s.profile.nick)} · ` : ''}${gradeOf(s)} класс — изменить</button>
  <button type="button" class="btn wide" data-act="export">Сохранить резервную копию</button>
  <button type="button" class="btn wide" data-act="import">Загрузить из копии</button>
  <button type="button" class="btn wide ghost" data-act="about">Об игре</button>
  <button type="button" class="btn wide danger" data-act="reset">Начать сад заново</button>
</div>
<p class="muted small">Резервная копия — это файл. Сохрани его в «Файлы» и загрузи, если игра потеряется или ты сменишь телефон.</p>
<p class="muted small app-version">Версия игры ${__APP_VERSION__}</p>`);
    $<HTMLInputElement>(sheet, '[data-act="sound"]').addEventListener('change', (e) => {
      this.state.settings.sound = (e.target as HTMLInputElement).checked;
      if (this.state.settings.sound) this.state.settings.muted = false;
      setSoundEnabled(soundOn(this.state));
      this.renderMute();
      play('tap');
      this.persist();
    });
    sheet.querySelector<HTMLInputElement>('[data-act="voice"]')?.addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this.state.settings.voice = on;
      if (on) this.state.settings.muted = false;
      setSoundEnabled(soundOn(this.state));
      this.renderMute();
      this.persist();
      this.renderQuest();
      if (!on) return stopSpeaking();
      this.prepareVoice();
      say('Привет! Теперь я буду читать тебе вслух. Нажми на кнопку с динамиком, чтобы послушать ещё раз.', youngMode(this.state));
      if (russianVoiceMissing()) this.toast('На этом телефоне не нашёлся русский голос. Его можно скачать в настройках телефона, в разделе про синтез речи.', 'warn');
    });
    $<HTMLInputElement>(sheet, '[data-act="bigtext"]').addEventListener('change', (e) => {
      this.state.settings.bigText = (e.target as HTMLInputElement).checked;
      this.applyTextSize();
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
    $(sheet, '[data-act="gardener"]').addEventListener('click', () => this.showGardener(this.state.gardener === null));
    $(sheet, '[data-act="photo"]').addEventListener('click', () => {
      this.closeSheet();
      void this.takePhoto();
    });
    $(sheet, '[data-act="reset"]').addEventListener('click', () => this.confirmReset());
  }

  /**
   * «Подсказывающий пальчик» (2–3 class): after a few quiet seconds in the garden, a finger
   * taps the bed the child could use next. Any touch hides it.
   */
  private fingerHint(now: number): string {
    const s = this.state;
    if (this.mode !== 'garden' || !$(this.root, '#sheetBackdrop').hidden) return '';
    // Grades 2–3 get the finger all the time; older children only in the first quests and after a longer pause.
    const young = youngMode(s);
    if (!young && s.questIndex >= FINGER_OLDER_QUESTS) return '';
    if (now - this.lastTouchAt < (young ? FINGER_AFTER_MS : FINGER_OLDER_AFTER_MS)) return '';
    const i = nextTap(s, now, this.view);
    if (i === null) return '';
    const pos = plotPos(i);
    return fingerSVG(pos.x + 6, pos.y - 14);
  }

  /** «Послушать» button: Listik reads the text aloud. Empty when reading aloud is off. */
  private speakBtn(html: string): string {
    if (!voiceOn(this.state) || !voiceSupported()) return '';
    return `<button type="button" class="speak" data-say="${esc(speechText(html))}" aria-label="Послушать">${ICONS.speaker}<svg class="stop-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/></svg></button>`;
  }

  /** Read aloud right away (called from a tap, which phones require for speech). */
  private autoSay(html: string) {
    if (voiceOn(this.state) && say(html, youngMode(this.state))) this.markSpeaking(speechText(html));
  }

  /** «Тихо»: one tap silences the game (sounds and Listik); another tap brings them back. */
  private toggleMute() {
    const s = this.state;
    s.settings.muted = !s.settings.muted;
    if (s.settings.muted) stopSpeaking();
    setSoundEnabled(soundOn(s));
    if (!s.settings.muted) {
      play('tap');
      this.prepareVoice();
    }
    this.renderMute();
    this.renderQuest();
    this.persist();
    this.toast(s.settings.muted ? 'Звук выключен. Включить снова — та же кнопка.' : 'Звук включён.');
  }

  private renderMute() {
    const b = $(this.root, '#muteBtn');
    const m = this.state.settings.muted;
    b.classList.toggle('muted', m);
    b.setAttribute('aria-pressed', String(m));
    b.setAttribute('aria-label', m ? 'Включить звук' : 'Выключить звук');
  }

  /** Show which speaker buttons are reading now (their text), so a tap on them stops Listik. */
  private markSpeaking(text: string | null) {
    this.root.querySelectorAll<HTMLElement>('.speak[data-say]').forEach((b) => {
      const on = text !== null && b.dataset.say === text;
      b.classList.toggle('speaking', on);
      b.setAttribute('aria-label', on ? 'Остановить' : 'Послушать');
    });
  }

  /** Download Listik's recorded voice in the background (once) when reading aloud is on. */
  private prepareVoice() {
    // The numbers for the fair (the second, bigger part) only once the fair is open.
    if (voiceOn(this.state)) void loadVoicePack(this.state.fair.lastAt > 0);
  }

  /** Large text for 2–3 class (or by the player's choice). */
  private applyTextSize() {
    this.root.classList.toggle('big-text', bigTextOn(this.state));
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
</form>`, then ? () => window.setTimeout(then, 200) : undefined, { locked: first });
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
      this.applyTextSize();
      this.prepareVoice();
      track('profile', { first, named: Boolean(this.state.profile.nick) });
      this.persist();
      // 3–5 class: the gardener sheet comes next (and the finished quests after it), so no «let's go» yet.
      const gardenerNext = gardenerByDefault(this.state) && !this.state.gardener;
      if (gardenerNext) this.sheetOnClose = null;
      this.closeSheet();
      play('quest');
      if (gardenerNext) window.setTimeout(() => this.showGardener(true, then), 350);
      else this.toast(this.state.profile.nick ? `Рад знакомству, ${this.state.profile.nick}!` : 'Отлично, начинаем!');
    });
  }

  private showAbout() {
    this.openSheet(`<h2>Об игре</h2><p>«Зелёный сад» — уютная игра о том, как разбудить заброшенный волшебный сад. Сделана с любовью для юных садоводов.</p>
<ul class="plain"><li>Без рекламы, покупок, регистрации и чатов.</li><li>Пока игра в тестировании, она отправляет обезличенный журнал: какой вопрос или задача попались, верный ли ответ, и ошибки программы. Имя и сад не отправляются. Выключить можно в Меню: «Помогать улучшать игру».</li><li>Растения не погибают, если долго не заходить.</li><li>Работает без интернета после первой загрузки.</li></ul>
<p class="muted small">Вся графика нарисована кодом специально для этой игры, звуки синтезируются в браузере. Сторонних картинок и шрифтов нет.</p>
<p class="muted small">Голос Листика записан заранее нейросетью Vosk TTS (модель vosk-model-tts-ru-0.10-multi, голос № 1, Alpha Cephei, лицензия Apache 2.0); ударения — silero-stress (Silero Team, лицензия MIT). Если запись ещё не скачалась, читает голос телефона.</p>`);
  }

  private confirmReset() {
    const sheet = this.openSheet(`<div class="sheet-hero">${listik(64, 'wow')}</div><h2>Начать заново?</h2><p>Весь сад, лепестки и коллекция пропадут. Лучше сначала сохранить резервную копию.</p>
<button type="button" class="btn wide" data-act="export">Сохранить копию</button>
<button type="button" class="btn wide danger" data-act="yes">Да, начать заново</button>`);
    $(sheet, '[data-act="export"]').addEventListener('click', () => this.doExport());
    $(sheet, '[data-act="yes"]').addEventListener('click', () => {
      const profile = this.state.profile;
      const next = newGame(this.now());
      next.profile = profile;
      this.startOver(next, 'Новый сад ждёт тебя!');
    });
  }

  /**
   * A whole new garden (start over, or a backup loaded): forget everything the screen held for the
   * old one — a guest from a closed zone, a fair problem, a question — and greet it like a fresh start.
   */
  private startOver(next: GameState, message: string) {
    this.sheetOnClose = null;
    this.closeSheet();
    this.state = next;
    this.readOnly = false;
    this.dismissGuest(false);
    this.fairTask = null;
    this.question = null;
    this.seedsPicking.clear();
    this.lastPlots = [];
    this.awayChanges = [];
    this.mode = 'garden';
    this.selectedDeco = null;
    setSoundEnabled(soundOn(next));
    void this.startTilt(false);
    this.applyTextSize();
    this.prepareVoice();
    setTelemetryGrade(next.profile.grade);
    advance(this.state, this.now());
    if (this.view !== 'garden') this.goTo('garden');
    this.commit();
    this.homeGardener();
    this.toast(message);
    if (!this.state.profile.grade) this.showProfile(true);
    else if (gardenerByDefault(this.state) && !this.state.gardener) this.showGardener(true);
  }

  private showCorruptSheet(error: string) {
    const sheet = this.openSheet(`<div class="sheet-hero">${listik(64, 'wow')}</div><h2>Сохранение повреждено</h2><p>Не получилось открыть сохранённый сад: ${error}</p><p class="muted">Повреждённые данные мы отложили отдельно и не стёрли. Можно загрузить резервную копию или начать новый сад.</p>
<button type="button" class="btn primary wide" data-act="import">Загрузить из копии</button>
<button type="button" class="btn wide" data-act="new">Начать новый сад</button>`);
    this.readOnly = true;
    $(sheet, '[data-act="import"]').addEventListener('click', () => $<HTMLInputElement>(this.root, '#importFile').click());
    $(sheet, '[data-act="new"]').addEventListener('click', () => {
      this.readOnly = false;
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
        $(sheet, '[data-act="yes"]').addEventListener('click', () => this.startOver(state, 'Сад загружен из копии!'));
        $(sheet, '[data-act="no"]').addEventListener('click', () => this.closeSheet());
      })
      .catch((e: Error) => {
        play('error');
        this.toast(e.message || 'Не удалось прочитать файл.', 'warn');
      });
  }

  // ------------------------------------------------------------ feedback

  /**
   * News from the garden (a badge, a question from Listik, the fair has opened…). While a window is
   * open it waits and comes after it is closed, so it never covers the window's title and close button.
   */
  announce(text: string) {
    if (!$(this.root, '#sheetBackdrop').hidden) {
      if (!this.pendingNews.includes(text)) this.pendingNews.push(text);
      return;
    }
    this.toast(text);
  }

  /** Show the news that waited for a window, one by one, once no window is open. */
  private flushNews() {
    window.clearTimeout(this.newsTimer);
    if (!this.pendingNews.length) return;
    this.newsTimer = window.setTimeout(() => {
      // Another window may have opened right after (a finished quest): wait for that one too.
      if (!$(this.root, '#sheetBackdrop').hidden) return;
      const text = this.pendingNews.shift();
      if (text) this.toast(text);
      if (this.pendingNews.length) this.flushNews();
    }, 900);
  }

  toast(text: string, kind: 'info' | 'warn' = 'info') {
    // Garden news waits for the open window (warnings are about that window, so they show at once).
    if (kind === 'info' && !$(this.root, '#sheetBackdrop').hidden) {
      if (!this.pendingNews.includes(text)) this.pendingNews.push(text);
      return;
    }
    const box = $(this.root, '#toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 2) box.firstElementChild?.remove();
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
    // Another bunch may still be flying: then the counter goes on from where it is.
    if (!this.flying) this.shownPetals = Math.max(0, start);
    this.flying++;
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
        const share = Math.round((amount * arrived) / n) - Math.round((amount * (arrived - 1)) / n);
        this.shownPetals = Math.min(this.state.petals, this.shownPetals + share);
        if (arrived === n && this.flying === 1) this.shownPetals = this.state.petals;
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
    // Under the windows: confetti must not fly across the text of the reward.
    const layer = $(this.root, '#confettiLayer');
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

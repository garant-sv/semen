// Lists every sentence Listik can say aloud, for recording the voice clips.
// Run: npx vite-node scripts/voice-phrases.ts > voice/phrases.json
// The texts are built exactly the way the game builds them (src/ui/app.ts), then split with
// speechUnits(): one recorded clip per unit. Fair problems are made by the real generator
// with many random seeds until no new sentence appears.

import { GUESTS, GUEST_IDS, LANDMARKS, LISTIK_TIPS, PLANTS, PLANT_IDS, QUESTS, type Goal } from '../src/game/data';
import { KINDS_BY_GRADE, LEVELS_BY_GRADE, makeProblem } from '../src/game/math';
import { QUESTIONS, questionGrades } from '../src/game/quiz';
import { NO_LETTER, WORDS, viewWord, wordsForGrade } from '../src/game/russian';
import { speechText } from '../src/ui/voice';
import { pieceKey, speechPieces } from '../src/ui/voice-units';

interface Unit {
  key: string;
  text: string;
  /** Lowest class that can hear it (2 = the young mode, where reading aloud is on by default). */
  grade: number;
  kind: string;
}

const units = new Map<string, Unit>();
const add = (html: string, kind: string, grade = 2) => {
  for (const { text: u } of speechPieces(speechText(html))) {
    const key = pieceKey(u);
    const old = units.get(key);
    if (!old) units.set(key, { key, text: u, grade, kind });
    else if (grade < old.grade) old.grade = grade;
  }
};

// Menu: reading aloud switched on.
add('Привет! Теперь я буду читать тебе вслух. Нажми на кнопку с динамиком, чтобы послушать ещё раз.', 'menu');

// Quests: title, text and every state of every goal.
const RESTORE_VERB: Record<string, string> = {
  bridge: 'Починить мостик',
  pond: 'Наполнить пруд',
  veg: 'Расчистить огород',
  tundra: 'Экспедиция в тундру',
  taiga: 'Экспедиция в тайгу',
  steppe: 'Экспедиция в степь',
};
const goalLabels = (g: Goal): string[] => {
  switch (g.type) {
    case 'plant':
      return [`Посадить: ${PLANTS[g.plant].name}`];
    case 'water':
      return ['Полить растение'];
    case 'harvest':
      return [`Собрать: ${PLANTS[g.plant].name}`];
    case 'restore': {
      const verb = RESTORE_VERB[g.target];
      const price = LANDMARKS[g.target].price;
      return [verb, ...Array.from({ length: price + 1 }, (_, n) => `${verb} (${n}/${price} лепестков)`)];
    }
    case 'place':
      return ['Поставить украшение'];
    case 'collection':
      return Array.from({ length: PLANT_IDS.length + 1 }, (_, n) => `Коллекция: ${n} из ${PLANT_IDS.length}`);
    case 'guests':
      return Array.from({ length: g.count + 1 }, (_, n) => `Встретить гостей: ${n} из ${g.count}`);
    case 'golden':
      return ['Собрать золотой цветок'];
    case 'orders':
      return Array.from({ length: g.count + 1 }, (_, n) => `Выполнить просьбы: ${n} из ${g.count}`);
    case 'meet':
      return [`Познакомиться: ${GUESTS[g.guest].name}`];
  }
};
for (const q of QUESTS) {
  add(`${q.title}. ${q.text}`, 'quest');
  for (const g of q.goals) for (const l of goalLabels(g)) add(`${l}.`, 'quest');
}
add('Сад проснулся!', 'tip');
for (const tip of LISTIK_TIPS) add(tip, 'tip');

// Listik's questions: the question, each option as «…?», the answer and the explanation.
for (const q of QUESTIONS) {
  const grade = Math.min(...questionGrades(q));
  add(q.text, 'quiz', grade);
  for (const o of q.options) add(`${o}?`, 'quiz', grade);
  add(`Верно! Почти! Правильный ответ: ${q.options[0]}.`, 'quiz', grade);
  add(q.explain, 'quiz', grade);
}

// Signs at the beds (Russian).
const lowestWordGrade = (id: string) => [2, 3, 4, 5].find((g) => wordsForGrade(g).some((w) => w.id === id)) ?? 4;
for (const w of WORDS) {
  const grade = lowestWordGrade(w.id);
  const v = viewWord(w);
  add(`Верно! Правильно: ${v.answer === NO_LETTER ? 'без буквы' : `буква ${v.answer}`}.`, 'sign', grade);
  add(`${v.full}. ${w.why}`, 'sign', grade);
}

// New guests and plants.
for (const id of GUEST_IDS) add(GUESTS[id].fact, 'guest');
for (const id of PLANT_IDS) add(PLANTS[id].fact, 'plant');

// The fair: generated problems, by class and level, until nothing new turns up.
let seed = 1;
const rand = () => {
  // mulberry32: fast and reproducible.
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const fairOnly = process.argv.includes('--young') ? [2, 3] : [2, 3, 4, 5];
for (const grade of fairOnly) {
  const [lo, hi] = LEVELS_BY_GRADE[grade];
  for (let level = lo; level <= hi; level++) {
    for (const kind of KINDS_BY_GRADE[grade]) {
      for (const id of GUEST_IDS) {
        let quiet = 0;
        while (quiet < 3000) {
          const before = units.size;
          const p = makeProblem(level, rand, GUESTS[id].name, kind, grade);
          add(p.text, 'fair', grade);
          add(`Подсказка: ${p.hint}`, 'fair', grade);
          add(`Не совсем. Подсказка: ${p.hint}`, 'fair', grade);
          add(`Правильный ответ: ${p.answerText}. Верно! Решение: ${p.solution}`, 'fair', grade);
          quiet = units.size === before ? quiet + 1 : 0;
        }
      }
    }
  }
}

const list = [...units.values()].sort((a, b) => a.grade - b.grade || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
process.stdout.write(JSON.stringify(list, null, 1));

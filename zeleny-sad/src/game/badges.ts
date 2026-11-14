// Badges: computed from the game state, announced once (ids kept in state.badges).

import { DECO_IDS, FLOWER_IDS, GUEST_IDS, PLANT_IDS, VEG_IDS } from './data';
import type { GameState } from './state';

export interface Badge {
  id: string;
  name: string;
  desc: string;
  /** Progress towards the badge: [current, goal]. */
  progress: (s: GameState) => [number, number];
}

const count = (n: number, goal: number): [number, number] => [Math.min(n, goal), goal];

export const BADGES: Badge[] = [
  { id: 'first-harvest', name: 'Первый урожай', desc: 'Собери первый цветок', progress: (s) => count(s.stats.harvested, 1) },
  { id: 'gardener', name: 'Садовод', desc: 'Собери 25 растений', progress: (s) => count(s.stats.harvested, 25) },
  { id: 'master', name: 'Мастер-садовод', desc: 'Собери 100 растений', progress: (s) => count(s.stats.harvested, 100) },
  {
    id: 'flowers',
    name: 'Цветочный знаток',
    desc: 'Вырасти все 6 цветов',
    progress: (s) => count(FLOWER_IDS.filter((id) => s.collection[id]).length, FLOWER_IDS.length),
  },
  {
    id: 'veg',
    name: 'Огородник',
    desc: 'Вырасти все овощи и ягоды',
    progress: (s) => count(VEG_IDS.filter((id) => s.collection[id]).length, VEG_IDS.length),
  },
  {
    id: 'gold',
    name: 'Золотые руки',
    desc: 'Собери золотые растения трёх разных видов',
    progress: (s) => count(PLANT_IDS.filter((id) => s.golden[id]).length, 3),
  },
  {
    id: 'friends',
    name: 'Друг природы',
    desc: 'Познакомься со всеми гостями',
    progress: (s) => count(GUEST_IDS.filter((id) => s.guests[id]).length, GUEST_IDS.length),
  },
  { id: 'neighbour', name: 'Добрый сосед', desc: 'Выполни 10 просьб', progress: (s) => count(s.ordersDone, 10) },
  {
    id: 'builder',
    name: 'Мастер на все руки',
    desc: 'Почини мостик, наполни пруд и расчисти огород',
    progress: (s) => count(Object.values(s.restored).filter(Boolean).length, 3),
  },
  {
    id: 'decor',
    name: 'Дизайнер',
    desc: 'Собери все 6 украшений',
    progress: (s) => count(DECO_IDS.filter((id) => s.decor.owned[id] > 0).length, DECO_IDS.length),
  },
  { id: 'scholar', name: 'Знаток природы', desc: 'Правильно ответь Листику 15 раз', progress: (s) => count(s.quiz.correct, 15) },
];

export const BADGE_IDS = BADGES.map((b) => b.id);

export function earned(s: GameState): Badge[] {
  return BADGES.filter((b) => {
    const [n, goal] = b.progress(s);
    return n >= goal;
  });
}

/** Badges earned but not yet announced; marks them as announced. */
export function newBadges(s: GameState): Badge[] {
  const fresh = earned(s).filter((b) => !s.badges.includes(b.id));
  s.badges.push(...fresh.map((b) => b.id));
  return fresh;
}

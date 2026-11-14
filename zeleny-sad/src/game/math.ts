// «Ярмарка урожая»: задачи по математике 4 класса (Федеральная рабочая программа):
// цена — количество — стоимость, сдача, деление с остатком, деление поровну,
// площадь и периметр прямоугольника, единицы времени, доли, скорость — время — расстояние.
// Задачи генерируются, поэтому не кончаются; числа растут вместе с уровнем.

export type MathKind = 'cost' | 'change' | 'canBuy' | 'share' | 'area' | 'perimeter' | 'bushes' | 'minutes' | 'fraction' | 'distance';

export interface MathProblem {
  kind: MathKind;
  text: string;
  answer: number;
  /** Word after the answer field: «лепестков», «м²», «мин»… */
  unit: string;
  /** The answer with its unit, in proper Russian: «4 лепестка», «240 кустов». */
  answerText: string;
  hint: string;
  solution: string;
  /** 0.8: a picture for 2–3 class — what is bought and for how much, or the bed's sides. */
  pic?: { kind: 'goods'; art: FairArt; count: number; price: number } | { kind: 'bed'; a: number; b: number };
}

/** Plants drawn on the fair's picture cards (ids from the game's own art). */
export type FairArt = 'carrot' | 'pumpkin' | 'strawberry' | 'daisy' | 'tulip' | 'lavender' | 'sunflower';

export interface FairGood {
  /** Accusative after a number: 1, 2–4, 5+. */
  forms: [string, string, string];
  /** Price range at the first level. */
  price: [number, number];
  art: FairArt;
}

export const FAIR_GOODS: FairGood[] = [
  { forms: ['морковку', 'морковки', 'морковок'], price: [2, 6], art: 'carrot' },
  { forms: ['тыкву', 'тыквы', 'тыкв'], price: [7, 9], art: 'pumpkin' },
  { forms: ['корзинку клубники', 'корзинки клубники', 'корзинок клубники'], price: [4, 8], art: 'strawberry' },
  { forms: ['букет ромашек', 'букета ромашек', 'букетов ромашек'], price: [3, 7], art: 'daisy' },
  { forms: ['тюльпан', 'тюльпана', 'тюльпанов'], price: [3, 8], art: 'tulip' },
  { forms: ['пучок лаванды', 'пучка лаванды', 'пучков лаванды'], price: [4, 9], art: 'lavender' },
  { forms: ['подсолнух', 'подсолнуха', 'подсолнухов'], price: [3, 9], art: 'sunflower' },
];

export const plural = (n: number, [one, few, many]: [string, string, string]) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const PETALS: [string, string, string] = ['лепесток', 'лепестка', 'лепестков'];
const pet = (n: number) => `${n} ${plural(n, PETALS)}`;
/** «по N …»: по 21 лепестку, по 3 лепестка, по 5 лепестков. */
const perPet = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? `${n} лепестку` : pet(n));

const FRACTIONS: Record<number, [string, string]> = {
  2: ['половина', 'половину'],
  3: ['треть', 'треть'],
  4: ['четверть', 'четверть'],
  5: ['пятая часть', 'пятую часть'],
};

/** Level range by school class: the 2nd grade stays easy, the 5th starts with big numbers. */
export const LEVELS_BY_GRADE: Record<number, [number, number]> = { 2: [1, 1], 3: [1, 2], 4: [1, 4], 5: [3, 4] };

/** Level from the number of solved problems, kept within the class's range. */
export const fairLevel = (solved: number, grade = 4) => {
  const [lo, hi] = LEVELS_BY_GRADE[grade] ?? LEVELS_BY_GRADE[4];
  return Math.min(hi, lo + Math.floor(solved / 6));
};

/** Problem kinds a class has already studied. */
export const KINDS_BY_GRADE: Record<number, MathKind[]> = {
  2: ['cost', 'change', 'perimeter', 'minutes'],
  3: ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'minutes', 'fraction'],
  4: ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'bushes', 'minutes', 'fraction', 'distance'],
  5: ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'bushes', 'minutes', 'fraction', 'distance'],
};

export const KINDS_BY_LEVEL: Record<number, MathKind[]> = {
  1: ['cost', 'change', 'area', 'minutes', 'fraction', 'distance'],
  2: ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'minutes', 'fraction', 'distance'],
  3: ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'bushes', 'minutes', 'fraction', 'distance'],
  4: ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'bushes', 'minutes', 'fraction', 'distance'],
};

/**
 * Make one problem. `who` is the customer's name (nominative), used as the speaker.
 * `rand` returns numbers in [0, 1).
 */
const UNIT_FORMS: Record<string, [string, string, string]> = {
  лепестков: PETALS,
  кустов: ['куст', 'куста', 'кустов'],
  цветов: ['цветок', 'цветка', 'цветов'],
};

export function makeProblem(level: number, rand: () => number, who: string, kind?: MathKind, grade = 4): MathProblem {
  let k = kind;
  if (!k) {
    const allowed = KINDS_BY_LEVEL[Math.max(1, Math.min(4, level))].filter((x) => (KINDS_BY_GRADE[grade] ?? KINDS_BY_GRADE[4]).includes(x));
    const list = allowed.length ? allowed : KINDS_BY_GRADE[grade] ?? KINDS_BY_LEVEL[1];
    k = list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  }
  const p = grade === 2 ? buildEasy(rand, who, k) : buildProblem(level, rand, who, k);
  const forms = UNIT_FORMS[p.unit];
  return { ...p, answerText: `${p.answer} ${forms ? plural(p.answer, forms) : p.unit}` };
}

/** 2nd grade: adding and subtracting within 100, the first multiplication table, hours and minutes. */
function buildEasy(rand: () => number, who: string, kind: MathKind): Omit<MathProblem, 'answerText'> {
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const good = FAIR_GOODS[Math.min(FAIR_GOODS.length - 1, Math.floor(rand() * FAIR_GOODS.length))];
  if (kind === 'change') {
    const a = int(12, 45);
    const paid = (Math.floor(a / 10) + int(1, 3)) * 10;
    return {
      kind,
      text: `${who}: «Покупка стоит ${pet(a)}. Вот ${pet(paid)}. Сколько сдачи?»`,
      answer: paid - a,
      unit: 'лепестков',
      hint: 'Из того, что дали, вычти стоимость покупки.',
      solution: `${paid} − ${a} = ${paid - a}`,
    };
  }
  if (kind === 'perimeter') {
    const a = int(2, 9);
    const b = int(2, 9);
    return {
      kind,
      text: `${who}: «Грядка — прямоугольник: длина ${a} м, ширина ${b} м. Сколько метров заборчика нужно вокруг неё?»`,
      answer: 2 * (a + b),
      unit: 'м',
      hint: 'Сложи длины всех четырёх сторон: две длины и две ширины.',
      solution: `${a} + ${b} + ${a} + ${b} = ${2 * (a + b)} м`,
      pic: { kind: 'bed', a, b },
    };
  }
  if (kind === 'minutes') {
    const m = int(1, 8) * 5;
    return {
      kind,
      text: `${who}: «Дорога до ярмарки заняла 1 ч ${m} мин. Сколько это всего минут?»`,
      answer: 60 + m,
      unit: 'мин',
      hint: 'В 1 часе 60 минут.',
      solution: `60 + ${m} = ${60 + m}`,
    };
  }
  const n = int(2, 3);
  const p = int(2, 5);
  return {
    kind: 'cost',
    text: `${who}: «Мне, пожалуйста, ${n} ${plural(n, good.forms)} по ${perPet(p)}. Сколько с меня?»`,
    answer: n * p,
    unit: 'лепестков',
    hint: 'Цена × количество. Можно и сложением: сложи цену столько раз, сколько покупок.',
    solution: `${p} × ${n} = ${n * p}`,
    pic: { kind: 'goods', art: good.art, count: n, price: p },
  };
}

function buildProblem(level: number, rand: () => number, who: string, kind?: MathKind): Omit<MathProblem, 'answerText'> {
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const pick = <T>(arr: readonly T[]) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
  const L = Math.max(1, Math.min(4, level));
  const k: MathKind = kind ?? pick(KINDS_BY_LEVEL[L]);
  const good = pick(FAIR_GOODS);
  // Prices and amounts grow with the level (4th grade: multiplying by two-digit numbers).
  const price = () => (L === 1 ? int(good.price[0], good.price[1]) : L === 2 ? int(6, 25) : L === 3 ? int(12, 45) : int(25, 99));
  const count = () => (L === 1 ? int(2, 5) : L === 2 ? int(3, 9) : L === 3 ? int(11, 25) : int(12, 48));
  const side = () => (L === 1 ? int(2, 6) : L === 2 ? int(3, 9) : L === 3 ? int(8, 25) : int(12, 40));

  switch (k) {
    case 'cost': {
      const n = count();
      const p = price();
      return {
        kind: k,
        text: `${who}: «Мне, пожалуйста, ${n} ${plural(n, good.forms)} по ${perPet(p)} за штуку. Сколько с меня?»`,
        answer: n * p,
        unit: 'лепестков',
        hint: 'Стоимость = цена × количество.',
        solution: `${p} × ${n} = ${n * p}`,
        ...(L <= 2 ? { pic: { kind: 'goods' as const, art: good.art, count: n, price: p } } : {}),
      };
    }
    case 'change': {
      const n = count();
      const p = price();
      const cost = n * p;
      const step = L <= 2 ? 10 : 100;
      const paid = (Math.floor(cost / step) + int(1, 3)) * step;
      return {
        kind: k,
        text: `${who}: «Возьму ${n} ${plural(n, good.forms)} по ${perPet(p)}. Вот ${pet(paid)}. Сколько сдачи?»`,
        answer: paid - cost,
        unit: 'лепестков',
        hint: 'Сначала найди стоимость покупки, потом вычти её из того, что тебе дали.',
        solution: `${p} × ${n} = ${cost}; ${paid} − ${cost} = ${paid - cost}`,
        ...(L <= 2 ? { pic: { kind: 'goods' as const, art: good.art, count: n, price: p } } : {}),
      };
    }
    case 'canBuy': {
      const p = price();
      const n = count();
      const rest = int(0, p - 1);
      const money = n * p + rest;
      return {
        kind: k,
        text: `${who}: «У меня ${pet(money)}. Сколько ${good.forms[2]} по ${perPet(p)} я смогу купить?»`,
        answer: n,
        unit: 'шт.',
        hint: 'Раздели все лепестки на цену. Остатка на ещё одну покупку не хватит.',
        solution: rest ? `${money} : ${p} = ${n} (ост. ${rest})` : `${money} : ${p} = ${n}`,
      };
    }
    case 'share': {
      const friends = L <= 2 ? int(3, 5) : int(3, 9);
      const each = L <= 2 ? int(3, 12) : int(12, 99);
      const total = friends * each;
      return {
        kind: k,
        text: `${who}: «Мы с друзьями — нас ${friends} — заработали на ярмарке ${pet(total)}. Делим поровну. Сколько лепестков достанется каждому?»`,
        answer: each,
        unit: 'лепестков',
        hint: `Раздели все лепестки поровну на ${friends}.`,
        solution: `${total} : ${friends} = ${each}`,
      };
    }
    case 'area': {
      const a = side();
      const b = side();
      return {
        kind: k,
        text: `${who}: «Хочу новую грядку: длина ${a} м, ширина ${b} м. Какая у неё будет площадь?»`,
        answer: a * b,
        unit: 'м²',
        hint: 'Площадь прямоугольника = длина × ширина.',
        solution: `${a} × ${b} = ${a * b} м²`,
        ...(L <= 2 ? { pic: { kind: 'bed' as const, a, b } } : {}),
      };
    }
    case 'perimeter': {
      const a = side();
      const b = side();
      return {
        kind: k,
        text: `${who}: «Надо огородить грядку ${a} м на ${b} м заборчиком. Сколько метров заборчика нужно?»`,
        answer: 2 * (a + b),
        unit: 'м',
        hint: 'Периметр прямоугольника = (длина + ширина) × 2.',
        solution: `(${a} + ${b}) × 2 = ${2 * (a + b)} м`,
        ...(L <= 2 ? { pic: { kind: 'bed' as const, a, b } } : {}),
      };
    }
    case 'bushes': {
      const a = int(3, L >= 4 ? 15 : 9);
      const b = int(2, L >= 4 ? 12 : 8);
      const per = int(2, 6);
      return {
        kind: k,
        text: `${who}: «На 1 м² сажают ${per} ${plural(per, ['куст', 'куста', 'кустов'])} клубники. Сколько кустов поместится на грядке ${a} м на ${b} м?»`,
        answer: a * b * per,
        unit: 'кустов',
        hint: 'Сначала найди площадь грядки, потом умножь её на число кустов на 1 м².',
        solution: `${a} × ${b} = ${a * b} м²; ${a * b} × ${per} = ${a * b * per}`,
      };
    }
    case 'minutes': {
      const h = L === 1 ? int(1, 2) : int(1, 5);
      const m = int(0, 11) * 5;
      return {
        kind: k,
        text: `${who}: «Дорога до ярмарки заняла ${h} ч ${m} мин. Сколько это всего минут?»`,
        answer: h * 60 + m,
        unit: 'мин',
        hint: 'В 1 часе 60 минут.',
        solution: `${h} × 60 + ${m} = ${h * 60 + m}`,
      };
    }
    case 'fraction': {
      const d = L === 1 ? 2 : int(2, 5);
      const part = L <= 2 ? int(2, 12) : int(8, 60);
      const total = d * part;
      const [, acc] = FRACTIONS[d];
      return {
        kind: k,
        text: `${who}: «У меня ${total} ${plural(total, ['цветок', 'цветка', 'цветов'])}, ${acc} из них я отдам бабушке. Сколько цветов получит бабушка?»`,
        answer: part,
        unit: 'цветов',
        hint: `Чтобы найти ${acc} числа, раздели его на ${d}.`,
        solution: `${total} : ${d} = ${part}`,
      };
    }
    case 'distance': {
      const v = int(2, L <= 2 ? 5 : 9);
      const t = L === 1 ? int(3, 10) : L === 2 ? int(6, 20) : int(12, 60);
      return {
        kind: k,
        text: `${who}: «Загадка! Заяц бежит ${v} м в секунду. Сколько метров он пробежит за ${t} ${plural(t, ['секунду', 'секунды', 'секунд'])}?»`,
        answer: v * t,
        unit: 'м',
        hint: 'Расстояние = скорость × время.',
        solution: `${v} × ${t} = ${v * t} м`,
      };
    }
  }
}

/** Minutes between new customers; at most FAIR_QUEUE wait at the stall. */
export const FAIR_EVERY_MIN = 8;
export const FAIR_QUEUE = 3;
export const FAIR_FROM_QUEST = 3;

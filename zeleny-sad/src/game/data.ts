// Static game data: plants, decorations, landmarks and Listik's quest chain.
// All texts are in Russian; the player is ~10 years old.

export const FLOWER_IDS = ['daisy', 'sunflower', 'bellflower', 'tulip', 'lavender', 'moonflower'] as const;
export const VEG_IDS = ['carrot', 'strawberry', 'pumpkin'] as const;
export const PLANT_IDS = [...FLOWER_IDS, ...VEG_IDS] as const;
export type PlantId = (typeof PLANT_IDS)[number];
export type VegId = (typeof VEG_IDS)[number];
export const isVeg = (p: PlantId): p is VegId => (VEG_IDS as readonly string[]).includes(p);

export const DECO_IDS = ['lantern', 'birdhouse', 'pinwheel', 'bench', 'scarecrow', 'arch'] as const;
export type DecoId = (typeof DECO_IDS)[number];

export const LANDMARK_IDS = ['bridge', 'pond', 'veg'] as const;
export type Landmark = (typeof LANDMARK_IDS)[number];

export const GUEST_IDS = ['ladybug', 'snail', 'bee', 'butterfly', 'hedgehog', 'frog'] as const;
export type GuestId = (typeof GUEST_IDS)[number];

/** Flower beds in the garden. */
export const PLOT_COUNT = 6;
/** Vegetable beds in the vegetable patch; they follow the flower beds in `plots`. */
export const VEG_PLOT_COUNT = 4;
export const TOTAL_PLOTS = PLOT_COUNT + VEG_PLOT_COUNT;
export const isVegPlot = (i: number) => i >= PLOT_COUNT;
export const SLOT_COUNT = 6;

/** Stage 0 — seed in the soil, 1 — sprout, 2 — bud, 3 — bloom (ready to collect). */
export type Stage = 0 | 1 | 2 | 3;
export const STAGE_NAMES: Record<Stage, string> = {
  0: 'Семечко',
  1: 'Росток',
  2: 'Бутон',
  3: 'Цветёт',
};

export interface PlantDef {
  id: PlantId;
  name: string;
  /** Total growing time in minutes (split equally between the three watered stages). */
  growMinutes: number;
  /** Petals received when the bloom is collected. */
  petals: number;
  fact: string;
  magic?: boolean;
}

export const PLANTS: Record<PlantId, PlantDef> = {
  daisy: {
    id: 'daisy',
    name: 'Ромашка',
    growMinutes: 3,
    petals: 3,
    fact: 'Жёлтая серединка ромашки — это сотни крошечных цветков, собранных в одну корзинку.',
  },
  sunflower: {
    id: 'sunflower',
    name: 'Подсолнух',
    growMinutes: 6,
    petals: 5,
    fact: 'Молодой подсолнух поворачивает головку вслед за солнцем, а взрослый обычно смотрит на восток.',
  },
  bellflower: {
    id: 'bellflower',
    name: 'Колокольчик',
    growMinutes: 9,
    petals: 7,
    fact: 'Цветки колокольчика смотрят вниз, как маленькие колокола, — так дождь не смывает пыльцу.',
  },
  tulip: {
    id: 'tulip',
    name: 'Тюльпан',
    growMinutes: 12,
    petals: 9,
    fact: 'Тюльпаны продолжают немного расти даже в вазе, уже после того, как их срезали.',
  },
  lavender: {
    id: 'lavender',
    name: 'Лаванда',
    growMinutes: 18,
    petals: 12,
    fact: 'Лаванду очень любят пчёлы и бабочки, а засушенные цветки пахнут ещё долгие месяцы.',
  },
  moonflower: {
    id: 'moonflower',
    name: 'Лунный цветок',
    growMinutes: 30,
    petals: 20,
    magic: true,
    fact: 'Волшебный цветок этого сада. Его настоящий родственник, луноцвет, раскрывается вечером и пахнет ночью.',
  },
  carrot: {
    id: 'carrot',
    name: 'Морковка',
    growMinutes: 4,
    petals: 4,
    fact: 'Морковка — корнеплод: мы едим её корень, в котором растение запасает питательные вещества на зиму.',
  },
  strawberry: {
    id: 'strawberry',
    name: 'Клубника',
    growMinutes: 8,
    petals: 7,
    fact: 'Маленькие «семечки» на клубнике — это и есть настоящие плоды-орешки, а сладкая мякоть — разросшаяся серединка цветка.',
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Тыква',
    growMinutes: 20,
    petals: 15,
    fact: 'Тыква растёт на длинной плети. Самые большие тыквы на конкурсах весят больше тонны — как маленький автомобиль!',
  },
};

/** Chance that a planted seed grows into a golden flower (after the first quests). */
export const GOLDEN_CHANCE = 0.12;
/** After this many ordinary plantings in a row the next one is golden for sure. */
export const GOLDEN_PITY = 8;
/** Quest index from which golden flowers can appear. */
export const GOLDEN_FROM_QUEST = 3;
/** Quest index from which garden guests ask for flowers (orders). */
export const ORDERS_FROM_QUEST = 4;

export interface GuestDef {
  id: GuestId;
  name: string;
  /** Accusative form: «Ты встретил …». */
  acc: string;
  /** Petals for every meeting (the first meeting gives a bonus). */
  petals: number;
  fact: string;
  /** Where the guest likes to be: 'meadow', 'flowers' (hovers over beds) or 'pond'. */
  home: 'meadow' | 'flowers' | 'pond';
  /** How the guest appears in the garden, for the player. */
  hint: string;
}

export const GUESTS: Record<GuestId, GuestDef> = {
  ladybug: {
    id: 'ladybug',
    name: 'Божья коровка',
    acc: 'божью коровку',
    petals: 1,
    home: 'meadow',
    hint: 'Заглядывает в сад с самого начала.',
    fact: 'Божьи коровки едят тлю — крошечных жучков, которые портят растения. Садовники им очень рады.',
  },
  snail: {
    id: 'snail',
    name: 'Улитка',
    acc: 'улитку',
    petals: 1,
    home: 'meadow',
    hint: 'Медленно ползёт по траве — не пропусти.',
    fact: 'Улитка всю жизнь носит домик на спине, и домик растёт вместе с ней.',
  },
  bee: {
    id: 'bee',
    name: 'Пчела',
    acc: 'пчелу',
    petals: 2,
    home: 'flowers',
    hint: 'Прилетает, когда в саду цветут цветы.',
    fact: 'Пчёлы рассказывают друг другу, где растут цветы, особым танцем.',
  },
  butterfly: {
    id: 'butterfly',
    name: 'Бабочка',
    acc: 'бабочку',
    petals: 2,
    home: 'flowers',
    hint: 'Любит сад, где собрано много разных цветов.',
    fact: 'Бабочки пробуют еду на вкус ногами: вкусовые датчики у них на лапках.',
  },
  hedgehog: {
    id: 'hedgehog',
    name: 'Ёжик',
    acc: 'ёжика',
    petals: 3,
    home: 'meadow',
    hint: 'Приходит по мостику, когда его починят.',
    fact: 'У ежа несколько тысяч иголок, а когда он пугается, то сворачивается в колючий шар.',
  },
  frog: {
    id: 'frog',
    name: 'Лягушка',
    acc: 'лягушку',
    petals: 3,
    home: 'pond',
    hint: 'Живёт у пруда, когда в нём есть вода.',
    fact: 'Лягушки почти не пьют ртом: воду они впитывают прямо через кожу.',
  },
};

export interface DecoDef {
  id: DecoId;
  name: string;
  price: number;
}

export const DECORATIONS: Record<DecoId, DecoDef> = {
  lantern: { id: 'lantern', name: 'Фонарик', price: 6 },
  pinwheel: { id: 'pinwheel', name: 'Вертушка', price: 7 },
  birdhouse: { id: 'birdhouse', name: 'Скворечник', price: 8 },
  bench: { id: 'bench', name: 'Скамейка', price: 10 },
  scarecrow: { id: 'scarecrow', name: 'Пугало', price: 12 },
  arch: { id: 'arch', name: 'Цветочная арка', price: 20 },
};

export interface LandmarkDef {
  id: Landmark;
  name: string;
  brokenName: string;
  price: number;
  /** Quest index from which the restoration becomes available. */
  availableFromQuest: number;
  restoredText: string;
}

export const LANDMARKS: Record<Landmark, LandmarkDef> = {
  bridge: {
    id: 'bridge',
    name: 'Мостик',
    brokenName: 'Сломанный мостик',
    price: 15,
    availableFromQuest: 4,
    restoredText: 'Мостик снова целый! По нему можно перейти ручей.',
  },
  pond: {
    id: 'pond',
    name: 'Пруд',
    brokenName: 'Высохший пруд',
    price: 40,
    availableFromQuest: 7,
    restoredText: 'В пруду снова вода, а на ней — кувшинки!',
  },
  veg: {
    id: 'veg',
    name: 'Огород',
    brokenName: 'Заросший огород',
    price: 50,
    availableFromQuest: 8,
    restoredText: 'Огород расчищен! Держи семена морковки и клубники.',
  },
};

export const landmarkName = (id: Landmark) => LANDMARKS[id].name;

export type Goal =
  | { type: 'plant'; plant: PlantId }
  | { type: 'water' }
  | { type: 'harvest'; plant: PlantId }
  | { type: 'restore'; target: Landmark }
  | { type: 'place' }
  | { type: 'collection' }
  | { type: 'guests'; count: number }
  | { type: 'golden' }
  | { type: 'orders'; count: number };

export interface Reward {
  petals?: number;
  plants?: PlantId[];
  openPlots?: number;
}

export interface Quest {
  id: string;
  title: string;
  /** What Listik says while the quest is active. */
  text: string;
  goals: Goal[];
  reward: Reward;
  /** What Listik says when the quest is completed. */
  doneText: string;
}

export const QUESTS: Quest[] = [
  {
    id: 'first-seed',
    title: 'Первое семечко',
    text: 'Привет! Я Листик. Этот сад давно уснул… Давай разбудим его! Нажми на пустую грядку и посади ромашку.',
    goals: [{ type: 'plant', plant: 'daisy' }],
    reward: {},
    doneText: 'Отлично! Семечко уже в земле.',
  },
  {
    id: 'first-water',
    title: 'Глоток воды',
    text: 'Над грядкой появилась капля — значит, растение хочет пить. Нажми на грядку, чтобы полить её.',
    goals: [{ type: 'water' }],
    reward: {},
    doneText: 'Слышишь, как земля впитывает воду? Растение начало расти.',
  },
  {
    id: 'first-bloom',
    title: 'Первый цветок',
    text: 'Растения растут, даже если ты закроешь игру, и никогда не погибают. Поливай каждую новую стадию, а когда ромашка расцветёт — собери её.',
    goals: [{ type: 'harvest', plant: 'daisy' }],
    reward: { petals: 5, plants: ['sunflower'] },
    doneText: 'Ура, первый цветок! Лепестки пригодятся, чтобы чинить сад. А ещё я нашёл семена подсолнуха!',
  },
  {
    id: 'sunflower',
    title: 'Солнечный гость',
    text: 'Посади подсолнух и вырасти его. Можно растить несколько цветов одновременно на разных грядках.',
    goals: [{ type: 'harvest', plant: 'sunflower' }],
    reward: { plants: ['bellflower'], openPlots: 4 },
    doneText: 'Я расчистил ещё одну грядку и нашёл семена колокольчика!',
  },
  {
    id: 'bridge',
    title: 'Мостик через ручей',
    text: 'Видишь сломанный мостик через ручей? Собери 15 лепестков, нажми на мостик и почини его.',
    goals: [{ type: 'restore', target: 'bridge' }],
    reward: { plants: ['tulip'], openPlots: 5 },
    doneText: 'Мостик как новый! За ручьём я нашёл луковицы тюльпанов и ещё одну грядку.',
  },
  {
    id: 'decorate',
    title: 'Красота!',
    text: 'Теперь сад можно украсить. Открой «Украсить», выбери украшение и поставь его на свободное место.',
    goals: [{ type: 'place' }],
    reward: { petals: 5 },
    doneText: 'Как уютно стало! Украшения можно переставлять, когда захочешь.',
  },
  {
    id: 'two-flowers',
    title: 'Колокольчик и тюльпан',
    text: 'Вырасти и собери колокольчик и тюльпан. Они растут дольше — пока можно заняться чем-нибудь другим.',
    goals: [
      { type: 'harvest', plant: 'bellflower' },
      { type: 'harvest', plant: 'tulip' },
    ],
    reward: { plants: ['lavender'] },
    doneText: 'Чудесно! Держи семена лаванды — её обожают пчёлы.',
  },
  {
    id: 'pond',
    title: 'Живая вода',
    text: 'Старый пруд совсем высох. Собери 40 лепестков, нажми на пруд и наполни его водой.',
    goals: [{ type: 'restore', target: 'pond' }],
    reward: { plants: ['moonflower'], openPlots: 6 },
    doneText: 'Пруд ожил! У самой воды я нашёл светящееся семечко… Это лунный цветок!',
  },
  {
    id: 'moon',
    title: 'Лунный цветок',
    text: 'Лунный цветок растёт долго, но он того стоит. Вырасти его и лаванду.',
    goals: [
      { type: 'harvest', plant: 'lavender' },
      { type: 'harvest', plant: 'moonflower' },
    ],
    reward: { petals: 10 },
    doneText: 'Какое сияние! Волшебство возвращается в сад.',
  },
  {
    id: 'collection',
    title: 'Весь сад',
    text: 'Загляни в «Коллекцию»: там все растения, которые ты вырастил. Собери все шесть!',
    goals: [{ type: 'collection' }],
    reward: { petals: 20 },
    doneText: 'Сад проснулся! Спасибо тебе! Но это ещё не всё: в саду начали появляться гости…',
  },
  // Quests 11–13 were added later; appending keeps old saves valid.
  {
    id: 'guests',
    title: 'Гости сада',
    text: 'Иногда в сад заглядывают гости: божья коровка, улитка, пчела… Нажми на гостя, чтобы познакомиться. Встреть троих!',
    goals: [{ type: 'guests', count: 3 }],
    reward: { petals: 10 },
    doneText: 'Какие милые соседи! Все, с кем ты познакомился, есть в «Коллекции» на вкладке «Гости».',
  },
  {
    id: 'golden',
    title: 'Золотой цветок',
    text: 'Говорят, иногда из обычного семечка вырастает золотой цветок. Он даёт вдвое больше лепестков! Сажай цветы — и однажды повезёт.',
    goals: [{ type: 'golden' }],
    reward: { petals: 15 },
    doneText: 'Сияет как солнышко! Попробуй собрать золотые цветы всех видов.',
  },
  {
    id: 'orders',
    title: 'Добрый сосед',
    text: 'Гости просят цветы — их просьбы висят на доске у ручья. Выполни три просьбы.',
    goals: [{ type: 'orders', count: 3 }],
    reward: { petals: 25 },
    doneText: 'Все соседи тебя знают и любят! Просьбы будут появляться и дальше, а я буду рядом.',
  },
  // Quests 14–15: the vegetable patch (added in 0.3).
  {
    id: 'veg',
    title: 'Свой огород',
    text: 'За садом есть старый заросший огород. Нажми на указатель «Огород», расчисти его за 50 лепестков и вырасти морковку.',
    goals: [
      { type: 'restore', target: 'veg' },
      { type: 'harvest', plant: 'carrot' },
    ],
    reward: { plants: ['pumpkin'], petals: 10 },
    doneText: 'Хрустящая морковка! А вот и семена тыквы — она растёт долго, зато какая вырастет!',
  },
  {
    id: 'pumpkin',
    title: 'Большая тыква',
    text: 'Вырасти в огороде клубнику и тыкву.',
    goals: [
      { type: 'harvest', plant: 'strawberry' },
      { type: 'harvest', plant: 'pumpkin' },
    ],
    reward: { petals: 25 },
    doneText: 'Вот это урожай! Гости теперь будут просить и овощи тоже.',
  },
];

export const LISTIK_TIPS = [
  'Ночью сад засыпает, зажигаются фонарики, а лунный цветок светится ярче.',
  'Сфотографируй свой сад в «Меню» и покажи друзьям.',
  'Гости приходят ненадолго. Заметил гостя — нажми на него!',
  'Ёжик приходит по мостику, а лягушка живёт у пруда.',
  'Из любого семечка может вырасти золотой цветок.',
  'Если закрыть игру, растения подождут тебя и не завянут.',
  'Украшения можно переставлять: в режиме «Украсить» нажми на украшение, а потом на новое место.',
  'Сделай резервную копию сада в «Меню», чтобы он никогда не потерялся.',
  'Лунный цветок — самый волшебный. Он растёт дольше всех.',
  'За каждый собранный цветок ты получаешь лепестки.',
];

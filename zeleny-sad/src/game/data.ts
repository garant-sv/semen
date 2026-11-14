// Static game data: plants, decorations, landmarks and Listik's quest chain.
// All texts are in Russian; the player is ~10 years old.

export const FLOWER_IDS = ['daisy', 'sunflower', 'bellflower', 'tulip', 'lavender', 'moonflower'] as const;
export const VEG_IDS = ['carrot', 'strawberry', 'pumpkin'] as const;
export const TUNDRA_IDS = ['cloudberry', 'dwarfbirch', 'lichen'] as const;
export const TAIGA_IDS = ['lingonberry', 'cedar', 'blueberry'] as const;
export const STEPPE_IDS = ['feathergrass', 'steppetulip', 'wormwood'] as const;
export const PLANT_IDS = [...FLOWER_IDS, ...VEG_IDS, ...TUNDRA_IDS, ...TAIGA_IDS, ...STEPPE_IDS] as const;
export type PlantId = (typeof PLANT_IDS)[number];
export type VegId = (typeof VEG_IDS)[number];
export const isVeg = (p: PlantId): p is VegId => (VEG_IDS as readonly string[]).includes(p);

/** Parts of the world: the home garden (mixed forest zone), the vegetable patch and three natural zones. */
export const ZONE_IDS = ['tundra', 'taiga', 'steppe'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];
export type AreaId = 'garden' | 'veg' | ZoneId;
export const AREA_PLANTS: Record<AreaId, readonly PlantId[]> = {
  garden: FLOWER_IDS,
  veg: VEG_IDS,
  tundra: TUNDRA_IDS,
  taiga: TAIGA_IDS,
  steppe: STEPPE_IDS,
};
export const plantArea = (p: PlantId): AreaId =>
  (Object.keys(AREA_PLANTS) as AreaId[]).find((a) => AREA_PLANTS[a].includes(p)) ?? 'garden';

export const DECO_IDS = ['lantern', 'birdhouse', 'pinwheel', 'bench', 'scarecrow', 'arch'] as const;
export type DecoId = (typeof DECO_IDS)[number];

export const LANDMARK_IDS = ['bridge', 'pond', 'veg', 'tundra', 'taiga', 'steppe'] as const;
export type Landmark = (typeof LANDMARK_IDS)[number];

export const GUEST_IDS = [
  'ladybug',
  'snail',
  'bee',
  'butterfly',
  'hedgehog',
  'frog',
  'reindeer',
  'arcticfox',
  'lemming',
  'squirrel',
  'chipmunk',
  'bear',
  'saiga',
  'gopher',
  'eagle',
] as const;
export type GuestId = (typeof GUEST_IDS)[number];

/** Flower beds in the garden. */
export const PLOT_COUNT = 6;
/** Vegetable beds in the vegetable patch; they follow the flower beds in `plots`. */
export const VEG_PLOT_COUNT = 4;
/** Beds in each natural zone. */
export const ZONE_PLOT_COUNT = 3;
/** Plot index ranges per area: [first, count]. */
export const AREA_PLOTS: Record<AreaId, [number, number]> = {
  garden: [0, PLOT_COUNT],
  veg: [PLOT_COUNT, VEG_PLOT_COUNT],
  tundra: [10, ZONE_PLOT_COUNT],
  taiga: [13, ZONE_PLOT_COUNT],
  steppe: [16, ZONE_PLOT_COUNT],
};
export const TOTAL_PLOTS = 19;
export const plotArea = (i: number): AreaId =>
  (Object.keys(AREA_PLOTS) as AreaId[]).find((a) => i >= AREA_PLOTS[a][0] && i < AREA_PLOTS[a][0] + AREA_PLOTS[a][1]) ?? 'garden';
export const areaPlots = (a: AreaId) => Array.from({ length: AREA_PLOTS[a][1] }, (_, k) => AREA_PLOTS[a][0] + k);
export const isVegPlot = (i: number) => plotArea(i) === 'veg';
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
  cloudberry: {
    id: 'cloudberry',
    name: 'Морошка',
    growMinutes: 6,
    petals: 6,
    fact: 'Морошка растёт на болотах тундры. Ягода сначала красная, а когда созреет — становится янтарно-жёлтой.',
  },
  dwarfbirch: {
    id: 'dwarfbirch',
    name: 'Карликовая берёза',
    growMinutes: 9,
    petals: 8,
    fact: 'В тундре берёзка растёт всего по колено и стелется по земле — так ей легче пережить холод и ветер.',
  },
  lichen: {
    id: 'lichen',
    name: 'Ягель',
    growMinutes: 14,
    petals: 12,
    fact: 'Ягель — это лишайник, а не мох. Он растёт всего на несколько миллиметров в год, а зимой его едят северные олени.',
  },
  lingonberry: {
    id: 'lingonberry',
    name: 'Брусника',
    growMinutes: 7,
    petals: 7,
    fact: 'Брусника — вечнозелёный кустик: её кожистые листья зимуют зелёными прямо под снегом.',
  },
  cedar: {
    id: 'cedar',
    name: 'Кедр',
    growMinutes: 16,
    petals: 14,
    fact: 'Сибирскую кедровую сосну все зовут кедром. Её шишки с орешками созревают больше года.',
  },
  blueberry: {
    id: 'blueberry',
    name: 'Черника',
    growMinutes: 9,
    petals: 9,
    fact: 'Черника любит тень хвойного леса. От её ягод синеют язык и губы!',
  },
  feathergrass: {
    id: 'feathergrass',
    name: 'Ковыль',
    growMinutes: 7,
    petals: 7,
    fact: 'Ковыль — главная трава степи. Его семена с пушистыми «пёрышками» ветер уносит далеко-далеко.',
  },
  steppetulip: {
    id: 'steppetulip',
    name: 'Тюльпан Шренка',
    growMinutes: 12,
    petals: 12,
    fact: 'Дикий степной тюльпан цветёт весной всего несколько недель. Он редкий и занесён в Красную книгу России.',
  },
  wormwood: {
    id: 'wormwood',
    name: 'Полынь',
    growMinutes: 8,
    petals: 8,
    fact: 'Серебристый пушок на листьях полыни защищает её от жаркого солнца и помогает беречь воду.',
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
  /** Where the guest lives; zone animals appear only in their zone. */
  area: 'garden' | ZoneId;
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
    area: 'garden',
    hint: 'Заглядывает в сад с самого начала.',
    fact: 'Божьи коровки едят тлю — крошечных жучков, которые портят растения. Садовники им очень рады.',
  },
  snail: {
    id: 'snail',
    name: 'Улитка',
    acc: 'улитку',
    petals: 1,
    home: 'meadow',
    area: 'garden',
    hint: 'Медленно ползёт по траве — не пропусти.',
    fact: 'Улитка всю жизнь носит домик на спине, и домик растёт вместе с ней.',
  },
  bee: {
    id: 'bee',
    name: 'Пчела',
    acc: 'пчелу',
    petals: 2,
    home: 'flowers',
    area: 'garden',
    hint: 'Прилетает, когда в саду цветут цветы.',
    fact: 'Пчёлы рассказывают друг другу, где растут цветы, особым танцем.',
  },
  butterfly: {
    id: 'butterfly',
    name: 'Бабочка',
    acc: 'бабочку',
    petals: 2,
    home: 'flowers',
    area: 'garden',
    hint: 'Любит сад, где собрано много разных цветов.',
    fact: 'Бабочки пробуют еду на вкус ногами: вкусовые датчики у них на лапках.',
  },
  hedgehog: {
    id: 'hedgehog',
    name: 'Ёжик',
    acc: 'ёжика',
    petals: 3,
    home: 'meadow',
    area: 'garden',
    hint: 'Приходит по мостику, когда его починят.',
    fact: 'У ежа несколько тысяч иголок, а когда он пугается, то сворачивается в колючий шар.',
  },
  frog: {
    id: 'frog',
    name: 'Лягушка',
    acc: 'лягушку',
    petals: 3,
    home: 'pond',
    area: 'garden',
    hint: 'Живёт у пруда, когда в нём есть вода.',
    fact: 'Лягушки почти не пьют ртом: воду они впитывают прямо через кожу.',
  },
  reindeer: {
    id: 'reindeer',
    name: 'Северный олень',
    acc: 'северного оленя',
    petals: 4,
    home: 'meadow',
    area: 'tundra',
    hint: 'Живёт в тундре.',
    fact: 'Рога у северных оленей растут и у самцов, и у самок. Широкие копыта не дают им проваливаться в снег.',
  },
  arcticfox: {
    id: 'arcticfox',
    name: 'Песец',
    acc: 'песца',
    petals: 4,
    home: 'meadow',
    area: 'tundra',
    hint: 'Живёт в тундре.',
    fact: 'Зимой шубка песца белоснежная, а летом становится бурой — так его труднее заметить.',
  },
  lemming: {
    id: 'lemming',
    name: 'Лемминг',
    acc: 'лемминга',
    petals: 3,
    home: 'meadow',
    area: 'tundra',
    hint: 'Живёт в тундре.',
    fact: 'Лемминги не впадают в спячку: зимой они роют ходы и гнёзда прямо под снегом.',
  },
  squirrel: {
    id: 'squirrel',
    name: 'Белка',
    acc: 'белку',
    petals: 3,
    home: 'meadow',
    area: 'taiga',
    hint: 'Живёт в тайге.',
    fact: 'Белка запасает на зиму орехи и грибы, а грибы сушит, развешивая их на ветках.',
  },
  chipmunk: {
    id: 'chipmunk',
    name: 'Бурундук',
    acc: 'бурундука',
    petals: 3,
    home: 'meadow',
    area: 'taiga',
    hint: 'Живёт в тайге.',
    fact: 'Бурундук носит запасы в защёчных мешках, а зиму проводит в норе, во сне.',
  },
  bear: {
    id: 'bear',
    name: 'Бурый медведь',
    acc: 'бурого медведя',
    petals: 5,
    home: 'meadow',
    area: 'taiga',
    hint: 'Живёт в тайге.',
    fact: 'Зимой бурый медведь спит в берлоге, а летом ест ягоды, корешки, орехи и рыбу.',
  },
  saiga: {
    id: 'saiga',
    name: 'Сайгак',
    acc: 'сайгака',
    petals: 5,
    home: 'meadow',
    area: 'steppe',
    hint: 'Живёт в степи.',
    fact: 'Нос-хоботок сайгака согревает морозный воздух зимой и задерживает пыль летом.',
  },
  gopher: {
    id: 'gopher',
    name: 'Суслик',
    acc: 'суслика',
    petals: 3,
    home: 'meadow',
    area: 'steppe',
    hint: 'Живёт в степи.',
    fact: 'Суслики встают столбиком, чтобы осмотреться, и свистом предупреждают друг друга об опасности.',
  },
  eagle: {
    id: 'eagle',
    name: 'Степной орёл',
    acc: 'степного орла',
    petals: 5,
    home: 'meadow',
    area: 'steppe',
    hint: 'Живёт в степи.',
    fact: 'Степной орёл вьёт гнездо прямо на земле или на холмике. Он занесён в Красную книгу России.',
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
  tundra: {
    id: 'tundra',
    name: 'Тундра',
    brokenName: 'Экспедиция в тундру',
    price: 60,
    availableFromQuest: 15,
    restoredText: 'Мы в тундре! Здесь прохладно даже летом. Держи семена тундровых растений.',
  },
  taiga: {
    id: 'taiga',
    name: 'Тайга',
    brokenName: 'Экспедиция в тайгу',
    price: 80,
    availableFromQuest: 16,
    restoredText: 'Добро пожаловать в тайгу — бескрайний хвойный лес!',
  },
  steppe: {
    id: 'steppe',
    name: 'Степь',
    brokenName: 'Экспедиция в степь',
    price: 100,
    availableFromQuest: 17,
    restoredText: 'Вот она, степь: простор, ветер и травы до горизонта!',
  },
};

export interface ZoneInfo {
  id: ZoneId | 'arctic' | 'mixed' | 'desert';
  name: string;
  /** Climate and nature in two short sentences (4th grade «Окружающий мир»). */
  text: string;
  plants: string;
  animals: string;
  color: string;
}

/** Natural zones of Russia from north to south — the map and the atlas. */
export const ZONE_ATLAS: ZoneInfo[] = [
  {
    id: 'arctic',
    name: 'Арктическая пустыня',
    text: 'Самая северная зона: почти круглый год лёд и снег, зимой — полярная ночь.',
    plants: 'мхи, лишайники, полярный мак',
    animals: 'белый медведь, морж, тюлень',
    color: '#E8F1F7',
  },
  {
    id: 'tundra',
    name: 'Тундра',
    text: 'Холодно, лето короткое, под землёй вечная мерзлота. Деревья низенькие и стелются по земле.',
    plants: 'карликовая берёза, морошка, ягель',
    animals: 'северный олень, песец, лемминг',
    color: '#C9D3B0',
  },
  {
    id: 'taiga',
    name: 'Тайга',
    text: 'Бескрайние хвойные леса: ель, пихта, сосна, лиственница, кедр. Зима долгая и снежная.',
    plants: 'кедр, брусника, черника',
    animals: 'белка, бурундук, бурый медведь',
    color: '#5E8C5A',
  },
  {
    id: 'mixed',
    name: 'Смешанный лес',
    text: 'Растут и хвойные, и лиственные деревья. Так выглядит природа вокруг Москвы — здесь наш сад!',
    plants: 'дуб, липа, клён, ель, берёза',
    animals: 'ёжик, лиса, заяц',
    color: '#8CBF6A',
  },
  {
    id: 'steppe',
    name: 'Степь',
    text: 'Тепло и сухо, деревьев почти нет — одни травы. Плодородные чернозёмы, поэтому много полей.',
    plants: 'ковыль, тюльпан Шренка, полынь',
    animals: 'сайгак, суслик, степной орёл',
    color: '#E3C77A',
  },
  {
    id: 'desert',
    name: 'Полупустыня',
    text: 'Жарко и очень сухо, растения редкие и выносливые.',
    plants: 'полынь, верблюжья колючка',
    animals: 'тушканчик, сайгак, ящерицы',
    color: '#F0D9A8',
  },
];

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
  | { type: 'orders'; count: number }
  | { type: 'meet'; guest: GuestId };

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
    doneText: 'Вот это урожай! А теперь — в путешествие по природным зонам России. Открой «Карту»!',
  },
  // Quests 16–18: natural zones (added in 0.4).
  {
    id: 'tundra',
    title: 'Экспедиция в тундру',
    text: 'Открой «Карту» и отправься в тундру — самую холодную зону, где растут деревья. Вырасти там морошку.',
    goals: [
      { type: 'restore', target: 'tundra' },
      { type: 'harvest', plant: 'cloudberry' },
    ],
    reward: { petals: 20 },
    doneText: 'Морошка — настоящее северное золото! Следующая остановка — тайга.',
  },
  {
    id: 'taiga',
    title: 'Хвойный лес',
    text: 'Отправься в тайгу и вырасти бруснику и кедр.',
    goals: [
      { type: 'restore', target: 'taiga' },
      { type: 'harvest', plant: 'lingonberry' },
      { type: 'harvest', plant: 'cedar' },
    ],
    reward: { petals: 25 },
    doneText: 'Белки будут рады кедровым орешкам! А теперь на юг — в степь.',
  },
  {
    id: 'steppe',
    title: 'Степные просторы',
    text: 'Отправься в степь, вырасти редкий тюльпан Шренка и познакомься с сайгаком.',
    goals: [
      { type: 'restore', target: 'steppe' },
      { type: 'harvest', plant: 'steppetulip' },
      { type: 'meet', guest: 'saiga' },
    ],
    reward: { petals: 40 },
    doneText: 'Ты прошёл Россию с севера на юг: тундра, тайга, смешанный лес, степь! Настоящий путешественник.',
  },
];

export const LISTIK_TIPS = [
  'На ярмарке у забора покупатели просят посчитать. Чем больше задач решишь, тем сложнее и интереснее они становятся!',
  'На «Карте» природные зоны идут с севера на юг: тундра, тайга, смешанный лес, степь.',
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

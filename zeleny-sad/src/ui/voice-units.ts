// Splitting what Listik says into short pieces, one recorded clip each.
// The same function runs in the game and in the script that lists the phrases to record
// (scripts/voice-phrases.ts), so the keys always match the recorded files.
//
// Sentences without numbers are recorded whole, so they sound natural. Sentences with numbers
// (the fair's problems, solutions, scores) would need a clip for every number, so they are cut
// at natural breaks: «Возьму 3 морковки | по 5 лепестков.», «6 | умножить на 3 | равно 18».

export interface SpeechPiece {
  text: string;
  /** Silence before this piece, ms. */
  pause: number;
}

const SENTENCE_PAUSE = 320;
const PHRASE_PAUSE = 70;

/** Breaks inside a sentence that has numbers. */
const PHRASE_BREAK = new RegExp(
  [
    '(?<=^[^\\d:]{3,40}:) ', // «Решение: …», «Правильный ответ: …», «Коллекция: …»
    ' (?=по \\d)', // «Возьму 3 морковки | по 5 лепестков.»
    ' (?=равно )',
    ' (?=(?:плюс|минус|умножить на|разделить на) [\\d(])',
    '(?<=(?:друзьями|\\d) —) ', // «Мы с друзьями — | нас 3 — | заработали …»
    ', (?=остаток )',
    ' (?=из \\d+ лепестков)', // quest progress: «Починить мостик: | 5 | из 15 лепестков.»
    '(?<=^У меня) (?=\\d)',
    '(?<=^Дорога до ярмарки заняла) (?=\\d)',
    '(?<=\\d м,) (?=ширина)',
  ].join('|'),
);

/**
 * One spoken text (already plain, see speechText) → its pieces.
 * «Ёжик: «Покупка стоит 23 лепестка. Сколько сдачи?»» → 'Ёжик:', 'Покупка стоит 23 лепестка.', 'Сколько сдачи?'
 */
export function speechPieces(text: string): SpeechPiece[] {
  let t = text.replace(/\s+/g, ' ').trim();
  const out: SpeechPiece[] = [];
  const push = (s: string, pause: number) => {
    const u = s.trim();
    if (u) out.push({ text: u, pause: out.length ? pause : 0 });
  };
  // A customer at the fair speaks: «Name: «…»».
  const who = /^([^:«»]{1,30}): «/.exec(t);
  if (who) {
    push(`${who[1]}:`, 0);
    t = t.slice(who[0].length - 1);
  }
  t = t.replace(/[«»"]/g, '').trim();
  for (const sentence of t.split(/(?<=[.!?…;])\s+/)) {
    if (!/\d/.test(sentence)) {
      push(sentence, SENTENCE_PAUSE);
      continue;
    }
    sentence.split(PHRASE_BREAK).forEach((p, i) => push(p, i === 0 ? SENTENCE_PAUSE : PHRASE_PAUSE));
  }
  return out;
}

/** Lookup key of a piece: case and spacing do not matter, punctuation (intonation) does. */
export function pieceKey(piece: string): string {
  return piece.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

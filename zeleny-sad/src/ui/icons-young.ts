/** Small pictograms for younger players: verbs in the quest card, the 🔊 button, the hint finger. */
const svg = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" width="1em" height="1em" aria-hidden="true" focusable="false">${body}</svg>`;

export const YOUNG_ICONS = {
  sound: svg(
    '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path d="M15.2 9a4.2 4.2 0 0 1 0 6M17.8 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  ),
  seed: svg(
    '<ellipse cx="12" cy="18" rx="8" ry="3" fill="#8A6A45"/><path d="M12 17c0-4 0-6 0-9" stroke="#4F9A3C" stroke-width="2" stroke-linecap="round"/><path d="M12 10c-3.5 0-5-2-5-4.5 3 0 5 1.5 5 4.5zM12 9c3 0 4.6-1.8 4.6-4 -2.7 0-4.6 1.3-4.6 4z" fill="#6DBA4F"/>',
  ),
  basket: svg(
    '<path d="M3.5 10h17l-2 9.5a1.5 1.5 0 0 1-1.5 1.2H7a1.5 1.5 0 0 1-1.5-1.2z" fill="#C98B4B"/><path d="M7.5 10 11 4M16.5 10 13 4" stroke="#8A5A2B" stroke-width="1.8" stroke-linecap="round"/><path d="M7 13.5h10M7.5 16.5h9" stroke="#A8692E" stroke-width="1.3"/>',
  ),
  drop: svg('<path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z" fill="#5BB2E8"/><path d="M9.3 14.5a2.8 2.8 0 0 0 2.4 2.7" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>'),
  finger: svg(
    '<path d="M24 6c2 0 3.4 1.5 3.4 3.4v13.2l1.2-.9c1.6-1.2 3.9-.9 5 .8 1 1.5.8 3.3-.3 4.6L28 34.6c-1.9 2.2-4.6 3.4-7.5 3.4h-3.7c-4.9 0-8.8-4-8.8-8.8v-7.6c0-1.7 1.4-3 3-3s3 1.3 3 3v1.2V9.4C20.6 7.5 22 6 24 6z" fill="#FFE2C6" stroke="#7A4E2D" stroke-width="2" stroke-linejoin="round"/>',
    '0 0 40 44',
  ),
};

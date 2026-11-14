import { expect, test, type Page } from '@playwright/test';

const shots = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png` });

async function dismissQuestDone(page: Page) {
  const btn = page.getByRole('button', { name: 'Дальше!' });
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await expect(page.locator('#sheetBackdrop')).toBeHidden();
}

/** Guests wander in at random moments; keep them away in tests that click beds. */
async function noGuests(page: Page) {
  await page.evaluate(() => {
    const app = window.__gardenApp as unknown as { nextGuestAt: number };
    app.nextGuestAt = Infinity;
  });
}

async function start(page: Page) {
  await page.clock.install({ time: new Date('2026-11-01T10:00:00') });
  await page.goto('/');
  await expect(page.locator('.quest-title')).toContainText('Задание 1 из 18');
  await noGuests(page);
}

test('full first loop: plant, water, grow, harvest, collection', async ({ page }) => {
  await start(page);
  await shots(page, '01-start');

  await page.locator('[data-plot="0"]').click();
  await expect(page.getByRole('heading', { name: 'Что посадим?' })).toBeVisible();
  await shots(page, '02-seeds');
  await page.locator('[data-plant="daisy"]').click();
  await page.clock.runFor(1000);
  await dismissQuestDone(page);

  for (let stage = 0; stage < 3; stage++) {
    await expect(page.locator('[data-plot="0"]')).toHaveClass(/st-thirsty/);
    await page.locator('[data-plot="0"]').click();
    if (stage === 0) {
      await page.clock.runFor(1000);
      await dismissQuestDone(page);
    }
    await expect(page.locator('[data-plot="0"]')).toHaveClass(/st-growing/);
    await page.clock.runFor(61_000);
  }
  await expect(page.locator('[data-plot="0"]')).toHaveClass(/bloom/);
  await shots(page, '03-bloom');
  await page.locator('[data-plot="0"]').click();
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: /Новое растение: Ромашка/ })).toBeVisible();
  await page.getByRole('button', { name: 'Здорово!' }).click();
  await page.clock.runFor(1000);
  await dismissQuestDone(page);
  await expect(page.locator('#petals')).toHaveText('8');
  await expect(page.locator('.quest-title')).toContainText('Задание 4 из 18');

  await page.getByRole('button', { name: 'Коллекция' }).click();
  await expect(page.locator('.card.book').first()).toContainText('Ромашка');
  await expect(page.locator('.card.book.locked')).toHaveCount(17); // 18 plants, 1 found
  await shots(page, '04-collection');
  await page.getByRole('button', { name: 'Закрыть' }).click();

  // The game survives a reload.
  await page.reload();
  await expect(page.locator('#petals')).toHaveText('8');
  await expect(page.locator('.quest-title')).toContainText('Задание 4 из 18');
});

test('growth is recalculated after time away; plants wait instead of dying', async ({ page }) => {
  await start(page);
  await page.locator('[data-plot="1"]').click();
  await page.locator('[data-plant="daisy"]').click();
  await page.clock.runFor(1000);
  await dismissQuestDone(page);
  await page.locator('[data-plot="1"]').click();
  await page.clock.runFor(1000);
  await dismissQuestDone(page);
  // Close the game, come back three days later.
  await page.goto('about:blank');
  await page.clock.setSystemTime(new Date('2026-11-04T10:00:00'));
  await page.goto('/');
  await noGuests(page);
  await expect(page.locator('.toast').first()).toContainText('подросли');
  await expect(page.locator('[data-plot="1"]')).toHaveClass(/st-thirsty/);
});

test('backup export and import', async ({ page }) => {
  await start(page);
  await page.locator('[data-plot="0"]').click();
  await page.locator('[data-plant="daisy"]').click();
  await page.clock.runFor(1000);
  await dismissQuestDone(page);

  await page.getByRole('button', { name: 'Меню' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Сохранить резервную копию' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^zelyony-sad-\d{4}-\d{2}-\d{2}\.json$/);
  const path = test.info().outputPath('backup.json');
  await download.saveAs(path);

  // Start over, then restore the backup.
  await page.getByRole('button', { name: 'Начать сад заново' }).click();
  await page.getByRole('button', { name: 'Да, начать заново' }).click();
  await expect(page.locator('.quest-title')).toContainText('Задание 1 из 18');

  await page.locator('#importFile').setInputFiles(path);
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await expect(page.locator('.quest-title')).toContainText('Задание 2 из 18');

  // A wrong file is rejected with a clear message.
  await page.locator('#importFile').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.locator('.toast.warn')).toContainText('не файл резервной копии');
});

test('storage failure is reported, not hidden', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === 'green-garden/save') throw new DOMException('full', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  await page.goto('/');
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('Прогресс не сохраняется');
  await shots(page, '05-storage-error');
});

test('mobile layout: no horizontal scroll, large touch targets', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const b of await page.locator('.nav button, .listik-btn').all()) {
    const box = (await b.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  const plot = (await page.locator('[data-plot="0"]').boundingBox())!;
  expect(plot.width).toBeGreaterThanOrEqual(44);
  // The scene fits between the header and the bottom bar.
  const nav = (await page.locator('.nav').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(nav.y + nav.height).toBeLessThanOrEqual(vp.height + 1);
  // Safe-area insets are 0 in emulation, so check that the rules are present in the stylesheet.
  const css = await page.evaluate(() =>
    [...document.styleSheets].flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n'),
  );
  expect(css).toContain('safe-area-inset-bottom');
  expect(css).toContain('safe-area-inset-top');
  const vpMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(vpMeta).toContain('viewport-fit=cover');
});

test('works offline after the first load', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright WebKit does not run service workers reliably; checked in Chromium.');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.quest-title')).toContainText('Задание 1 из 18');
  await expect(page.locator('[data-plot="0"]')).toBeVisible();
  await page.locator('[data-plot="0"]').click();
  await expect(page.getByRole('heading', { name: 'Что посадим?' })).toBeVisible();
  await context.setOffline(false);
});

test('restored garden renders bridge, pond and decorations', async ({ page }) => {
  const now = Date.now();
  const save = {
    version: 2, createdAt: now, updatedAt: now, petals: 57,
    unlockedPlants: ['daisy', 'sunflower', 'bellflower', 'tulip', 'lavender', 'moonflower'],
    openPlots: 6,
    plots: [
      { plant: 'sunflower', stage: 3, wateredAt: null, plantedAt: now },
      { plant: 'moonflower', stage: 3, wateredAt: null, plantedAt: now },
      { plant: 'tulip', stage: 2, wateredAt: now, plantedAt: now },
      { plant: 'lavender', stage: 3, wateredAt: null, plantedAt: now },
      { plant: 'bellflower', stage: 3, wateredAt: null, plantedAt: now },
      { plant: 'daisy', stage: 1, wateredAt: null, plantedAt: now },
    ],
    restored: { bridge: true, pond: true },
    decor: {
      owned: { lantern: 1, birdhouse: 1, pinwheel: 1, bench: 1, scarecrow: 1, arch: 1 },
      placed: ['bench', 'birdhouse', 'lantern', 'pinwheel', 'arch', 'scarecrow'],
    },
    collection: { daisy: { firstAt: now, count: 3 }, sunflower: { firstAt: now, count: 1 } },
    questIndex: 8,
    stats: { planted: { daisy: 3 }, watered: 9, harvested: 4 },
    settings: { sound: false },
  };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('green-garden/save', s);
  }, JSON.stringify(save));
  await page.goto('/');
  await noGuests(page);
  await expect(page.locator('[data-landmark="pond"]')).not.toHaveClass(/broken/);
  await expect(page.locator('[data-landmark="bridge"]')).not.toHaveClass(/broken/);
  await expect(page.locator('[data-slot]')).toHaveCount(6);
  await shots(page, '06-restored');
  await page.getByRole('button', { name: 'Украсить' }).click();
  await shots(page, '07-decor-mode');
});

test('guests can be met; requests on the board can be fulfilled', async ({ page }) => {
  const now = Date.now();
  const plot = (plant: string | null, stage = 0) => ({ plant, stage, wateredAt: null, plantedAt: plant ? now : null, golden: false });
  const save = {
    version: 3, createdAt: now, updatedAt: now, petals: 3,
    unlockedPlants: ['daisy', 'sunflower', 'bellflower', 'tulip'], openPlots: 5,
    plots: [plot('daisy', 3), plot('daisy', 3), plot(null), plot(null), plot(null), plot(null)],
    restored: { bridge: true, pond: true },
    decor: { owned: {}, placed: [] },
    collection: { daisy: { firstAt: now, count: 1 }, sunflower: { firstAt: now, count: 1 } },
    golden: {}, guests: {},
    order: { from: 'hedgehog', items: [{ plant: 'daisy', need: 2, have: 0 }], reward: 7 },
    ordersDone: 0, questIndex: 5,
    stats: { planted: { daisy: 2 }, watered: 4, harvested: 2, sinceGolden: 0 },
    settings: { sound: false },
  };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('green-garden/save', s);
  }, JSON.stringify(save));
  await page.goto('/');
  await noGuests(page);

  // A guest appears; tapping it opens the discovery card and adds petals.
  await page.evaluate(() => {
    const app = window.__gardenApp as unknown as { spawnGuest(id: string, now: number): void };
    app.spawnGuest('frog', Date.now());
  });
  await expect(page.locator('[data-guest="frog"]')).toBeVisible();
  await shots(page, '08-guest');
  await page.locator('[data-guest="frog"]').click({ force: true });
  await expect(page.getByRole('heading', { name: 'Ты встретил лягушку!' })).toBeVisible();
  await page.getByRole('button', { name: 'Привет!' }).click();
  await expect(page.locator('#petals')).toHaveText('9', { timeout: 5000 });

  // Harvest two daisies for the hedgehog's request, then hand them over.
  await page.locator('[data-plot="0"]').click();
  await page.locator('[data-plot="1"]').click();
  await expect(page.locator('[data-board]')).toHaveClass(/done/);
  await page.locator('[data-board]').click();
  await expect(page.getByRole('heading', { name: 'Ёжик просит цветы' })).toBeVisible();
  await shots(page, '09-order');
  await page.getByRole('button', { name: 'Отдать цветы' }).click();
  await expect(page.locator('#petals')).toHaveText(String(9 + 6 + 7), { timeout: 5000 });

  await page.getByRole('button', { name: 'Коллекция' }).click();
  await page.getByRole('button', { name: /Гости/ }).click();
  await expect(page.locator('.card.book').filter({ hasText: 'Лягушка' })).toBeVisible();
  await expect(page.locator('.card.book.locked')).toHaveCount(14); // 15 guests, 1 met
  await shots(page, '10-guests');
});

test('vegetable patch, Listik question, night and garden photo', async ({ page }) => {
  const now = new Date('2026-11-01T22:30:00').getTime();
  await page.clock.install({ time: now });
  const plot = (plant: string | null, stage = 0) => ({ plant, stage, wateredAt: null, plantedAt: plant ? now : null, golden: false });
  const save = {
    version: 4, createdAt: now, updatedAt: now, petals: 60,
    unlockedPlants: ['daisy', 'sunflower', 'bellflower', 'tulip', 'lavender', 'moonflower'], openPlots: 6,
    plots: [plot('moonflower', 3), plot('daisy', 1), plot(null), plot(null), plot(null), plot(null), plot(null), plot(null), plot(null), plot(null)],
    restored: { bridge: true, pond: true, veg: false },
    decor: { owned: { lantern: 1 }, placed: ['lantern', null, null, null, null, null] },
    collection: { daisy: { firstAt: now, count: 1 } },
    golden: {}, guests: {}, order: null, ordersDone: 0, questIndex: 13,
    stats: { planted: { daisy: 2 }, watered: 4, harvested: 5, sinceGolden: 0, sinceQuiz: 0 },
    badges: [], quiz: { pending: true, solved: [], correct: 0, asked: 0 },
    settings: { sound: false },
  };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('green-garden/save', s);
  }, JSON.stringify(save));
  await page.goto('/');
  await noGuests(page);
  // Night: the sky is dark and the lantern glows.
  await expect(page.locator('#l-sky rect').first()).toBeAttached();
  await expect(page.locator('#l-lights .night-glow').first()).toBeAttached();
  await shots(page, '11-night');

  // Listik's question.
  await expect(page.locator('#listikBtn')).toHaveClass(/has-question/);
  await page.locator('#listikBtn').click();
  await expect(page.locator('.answer')).toHaveCount(3);
  await shots(page, '12-quiz');
  await page.locator('.answer').first().click();
  await expect(page.locator('.explain')).toBeVisible();
  await expect(page.locator('.answer.right')).toHaveCount(1);
  await page.locator('.explain .btn').click();
  await expect(page.locator('#listikBtn')).not.toHaveClass(/has-question/);

  // Open the vegetable patch through the signpost.
  await page.locator('[data-go="veg"]').click();
  await expect(page.getByRole('heading', { name: 'Заросший огород' })).toBeVisible();
  await page.getByRole('button', { name: 'Расчистить огород' }).click();
  await expect(page.locator('#view-veg')).toBeVisible();
  await page.clock.runFor(1500);
  const done = page.getByRole('button', { name: 'Дальше!' });
  if (await done.isVisible()) await done.click();
  await page.locator('[data-plot="6"]').click();
  await expect(page.getByRole('heading', { name: 'Что посадим в огороде?' })).toBeVisible();
  await expect(page.locator('[data-plant="carrot"]')).toBeVisible();
  await expect(page.locator('[data-plant="daisy"]')).toHaveCount(0);
  await page.locator('[data-plant="carrot"]').click();
  await expect(page.locator('[data-plot="6"]')).toHaveClass(/st-thirsty/);
  await shots(page, '13-veg');
  await page.locator('#view-veg [data-go="garden"]').click();
  await expect(page.locator('#view-garden')).toBeVisible();

  // Badges tab.
  await page.getByRole('button', { name: 'Коллекция' }).click();
  await page.locator('[data-tab="badges"]').click();
  await expect(page.locator('.badge-card.got').first()).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть' }).click();

  // Photo: a PNG is downloaded (desktop/emulation has no share sheet for files).
  await page.getByRole('button', { name: 'Меню' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Сфотографировать сад' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^zelyony-sad-foto-.*\.png$/);
  await download.saveAs(test.info().outputPath('photo.png'));
});

test('map of natural zones: expedition to the tundra, zone plants and animals', async ({ page }) => {
  const now = new Date('2026-11-01T12:00:00').getTime();
  await page.clock.install({ time: now });
  const empty = { plant: null, stage: 0, wateredAt: null, plantedAt: null, golden: false };
  const save = {
    version: 5, createdAt: now, updatedAt: now, petals: 70,
    unlockedPlants: ['daisy', 'carrot'], openPlots: 6,
    plots: Array.from({ length: 19 }, () => empty),
    restored: { bridge: true, pond: true, veg: true, tundra: false, taiga: false, steppe: false },
    decor: { owned: {}, placed: [] }, collection: {}, golden: {}, guests: {}, order: null, ordersDone: 3, questIndex: 15,
    stats: { planted: {}, watered: 4, harvested: 5, sinceGolden: 0, sinceQuiz: 0 },
    badges: [], quiz: { pending: false, solved: [], correct: 0, asked: 0 }, settings: { sound: false },
  };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('green-garden/save', s);
  }, JSON.stringify(save));
  await page.goto('/');
  await noGuests(page);
  await expect(page.locator('.quest-title')).toContainText('Задание 16 из 18');
  await page.getByRole('button', { name: 'Карта' }).click();
  await expect(page.locator('[data-zone]')).toHaveCount(6);
  await page.locator('[data-zone="tundra"]').click();
  await expect(page.locator('.zone-card')).toContainText('вечная мерзлота');
  await shots(page, '14-map');
  await page.getByRole('button', { name: 'Снарядить экспедицию' }).click();
  await page.getByRole('button', { name: 'Отправиться в тундру' }).click();
  await expect(page.locator('#view-tundra')).toBeVisible();
  await page.locator('[data-plot="10"]').click();
  await expect(page.getByRole('heading', { name: 'Что посадим в тундре?' })).toBeVisible();
  await expect(page.locator('[data-plant="cloudberry"]')).toBeVisible();
  await expect(page.locator('[data-plant="daisy"]')).toHaveCount(0);
  await page.locator('[data-plant="cloudberry"]').click();
  await expect(page.locator('[data-plot="10"]')).toHaveClass(/st-thirsty/);
  await page.evaluate(() => (window.__gardenApp as unknown as { spawnGuest(id: string, n: number): void }).spawnGuest('reindeer', Date.now()));
  await page.locator('[data-guest="reindeer"]').click({ force: true });
  await expect(page.getByRole('heading', { name: 'Ты встретил северного оленя!' })).toBeVisible();
  await page.getByRole('button', { name: 'Привет!' }).click();
  await shots(page, '15-tundra');
  await page.locator('#view-tundra [data-go="garden"]').click();
  await expect(page.locator('#view-garden')).toBeVisible();
});

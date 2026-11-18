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

/** First run asks for a name and class; pick grade 4 (the old default). */
async function onboard(page: Page, nick = '') {
  await expect(page.getByRole('heading', { name: /Листик|Имя и класс/ })).toBeVisible();
  if (nick) await page.getByPlaceholder('Например, Сёма').fill(nick);
  await page.getByRole('button', { name: /^4\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await makeGardener(page);
  await expect(page.locator('#sheetBackdrop')).toBeHidden();
}

/** 3–5 class: right after the class the child makes a gardener (here: the random look as offered). */
async function makeGardener(page: Page) {
  await expect(page.getByRole('heading', { name: 'Каким будет твой садовник?' })).toBeVisible();
  await page.getByRole('button', { name: 'В сад!' }).click();
}

async function start(page: Page) {
  await page.clock.install({ time: new Date('2026-11-01T10:00:00') });
  await page.goto('/');
  await onboard(page);
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
  await onboard(page);
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
  await onboard(page);
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
  await onboard(page);
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
  await onboard(page);
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
  await onboard(page);
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

test('harvest fair: a customer asks a math problem; hint after a mistake, petals for the answer', async ({ page }) => {
  const now = new Date('2026-11-01T12:00:00').getTime();
  await page.clock.install({ time: now });
  const empty = { plant: null, stage: 0, wateredAt: null, plantedAt: null, golden: false };
  const save = {
    version: 6, createdAt: now, updatedAt: now, petals: 10,
    unlockedPlants: ['daisy', 'sunflower'], openPlots: 4,
    plots: Array.from({ length: 19 }, () => empty),
    restored: { bridge: false, pond: false, veg: false, tundra: false, taiga: false, steppe: false },
    decor: { owned: {}, placed: [] }, collection: { daisy: { firstAt: now, count: 1 } }, golden: {}, guests: {}, order: null, ordersDone: 0, questIndex: 3,
    stats: { planted: { daisy: 1 }, watered: 3, harvested: 1, sinceGolden: 0, sinceQuiz: 0 },
    badges: [], quiz: { pending: false, solved: [], correct: 0, asked: 0 },
    fair: { queue: 2, lastAt: now, solved: 0, firstTry: 0 },
    settings: { sound: false },
  };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('green-garden/save', s);
  }, JSON.stringify(save));
  await page.goto('/');
  await onboard(page);
  await noGuests(page);
  await expect(page.locator('[data-fair]')).toHaveClass(/busy/);
  await page.locator('[data-fair]').click({ force: true }); // the badge bobs
  await expect(page.locator('.bubble')).toBeVisible();
  await shots(page, '16-fair');
  const answer = await page.evaluate(() => (window.__gardenApp as unknown as { fairTask: { problem: { answer: number } } }).fairTask.problem.answer);
  await page.locator('.answer-input').fill(String(answer + 1));
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.locator('.hint-box')).toContainText('Подсказка');
  await page.locator('.answer-input').fill(String(answer));
  await page.locator('.answer-input').press('Enter');
  await expect(page.locator('.explain.ok')).toContainText('со второй попытки');
  await expect(page.locator('.explain')).toContainText('Решение:');
  await page.getByRole('button', { name: 'Следующий покупатель' }).click();
  await expect(page.locator('.bubble')).toBeVisible();
  const answer2 = await page.evaluate(() => (window.__gardenApp as unknown as { fairTask: { problem: { answer: number } } }).fairTask.problem.answer);
  await page.locator('.answer-input').fill(String(answer2));
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.locator('.explain.ok')).toContainText('Верно! +4');
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page.locator('#petals')).toHaveText('16', { timeout: 5000 });
  await expect(page.locator('[data-fair]')).not.toHaveClass(/busy/);
  await page.locator('[data-fair]').click({ force: true }); // the badge bobs
  await expect(page.getByRole('heading', { name: 'Покупателей пока нет' })).toBeVisible();
});

test('signs at the beds: fill in the missing letter, the word goes to the word list', async ({ page }) => {
  const now = new Date('2026-11-01T12:00:00').getTime();
  await page.clock.install({ time: now });
  const empty = { plant: null, stage: 0, wateredAt: null, plantedAt: null, golden: false, sign: null };
  const plots: Record<string, unknown>[] = Array.from({ length: 19 }, () => empty);
  plots[0] = { plant: 'daisy', stage: 1, wateredAt: null, plantedAt: now, golden: false, sign: { id: 'morkov', solved: false } };
  plots[1] = { plant: 'sunflower', stage: 2, wateredAt: null, plantedAt: now, golden: false, sign: { id: 'myach', solved: false } };
  const save = {
    version: 7, createdAt: now, updatedAt: now, petals: 0,
    unlockedPlants: ['daisy', 'sunflower'], openPlots: 4, plots,
    restored: { bridge: false, pond: false, veg: false, tundra: false, taiga: false, steppe: false },
    decor: { owned: {}, placed: [] }, collection: { daisy: { firstAt: now, count: 1 } }, golden: {}, guests: {}, order: null, ordersDone: 0, questIndex: 4,
    stats: { planted: { daisy: 2 }, watered: 3, harvested: 1, sinceGolden: 0, sinceQuiz: 0 },
    badges: [], quiz: { pending: false, solved: [], correct: 0, asked: 0 },
    fair: { queue: 0, lastAt: now, solved: 0, firstTry: 0 }, rus: { learned: [], correct: 0, total: 0 },
    settings: { sound: false },
  };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('green-garden/save', s);
  }, JSON.stringify(save));
  await page.goto('/');
  await onboard(page);
  await noGuests(page);
  await expect(page.locator('[data-sign="0"]')).toHaveClass(/todo/);
  await page.locator('[data-sign="0"]').click({ force: true }); // the sign wiggles
  await expect(page.locator('.word-sign')).toContainText('м_рковь');
  await shots(page, '17-sign');
  await page.locator('.btn.letter', { hasText: /^о$/ }).click();
  await expect(page.locator('.explain.ok')).toContainText('Верно! +3');
  await expect(page.locator('.word-sign')).toContainText('морковь');
  await page.getByRole('button', { name: 'Ура!' }).click();
  await expect(page.locator('[data-sign="0"]')).toHaveClass(/solved/);
  // A wrong answer: the correct one is shown with the rule, +1 for trying.
  await page.locator('[data-sign="1"]').click({ force: true });
  await page.locator('.btn.letter', { hasText: /^ь$/ }).click();
  await expect(page.locator('.explain.try')).toContainText('без буквы');
  await expect(page.locator('.explain.try')).toContainText('мужской род');
  await page.getByRole('button', { name: 'Понятно' }).click();
  await expect(page.locator('#petals')).toHaveText('4');
  await page.getByRole('button', { name: 'Коллекция' }).click();
  await page.locator('[data-tab="words"]').click();
  await expect(page.locator('.word-chip')).toHaveText(['морковь']);
  await shots(page, '18-words');
});

test('profile: name and class are asked once and can be changed in the Menu', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-01T10:00:00') });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Начать играть!' })).toBeDisabled();
  await shots(page, '20-profile');
  await page.getByPlaceholder('Например, Сёма').fill('Сёма<b>');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await expect(page.locator('.toast').first()).toContainText('Рад знакомству, Сёмаb!');
  await page.reload();
  await expect(page.locator('.quest-title')).toContainText('Задание 1 из 18');
  await expect(page.locator('#sheetBackdrop')).toBeHidden();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /2 класс — изменить/ }).click();
  await page.getByRole('button', { name: /^5\s*класс/ }).click();
  await page.getByRole('button', { name: 'Готово' }).click();
  const grade = await page.evaluate(() => JSON.parse(localStorage.getItem('green-garden/save')!).profile.grade);
  expect(grade).toBe(5);
  // The anonymous journal keeps events locally (sent only on the https site) and never the name.
  const journal = await page.evaluate(() => localStorage.getItem('green-garden/events') ?? '');
  expect(journal).toContain('"e":"profile"');
  expect(journal).not.toContain('Сёма');
});

test('«живое 2,5D»: far layers shift under the finger, beds stay put, tilt switch in Menu', async ({ page }) => {
  await start(page);
  const bed = await page.locator('[data-plot="0"]').boundingBox();
  const far = page.locator('#view-garden [data-z="far"]');
  const front = page.locator('#l-front');
  await expect(front.locator('.grass').first()).toBeAttached();
  const box = (await page.locator('#stage').boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await page.clock.runFor(2000);
  await expect(far).toHaveAttribute('transform', /translate\(-\d/);
  await expect(front).toHaveAttribute('transform', /translate\(\d/);
  expect(await page.locator('[data-plot="0"]').boundingBox()).toEqual(bed);
  await shots(page, '20-depth');

  await page.locator('[data-nav="menu"]').click();
  const tilt = page.getByLabel('Наклон телефона двигает сад');
  await expect(tilt).toBeChecked();
  await tilt.uncheck();
  await page.reload();
  await page.locator('[data-nav="menu"]').click();
  await expect(page.getByLabel('Наклон телефона двигает сад')).not.toBeChecked();
});

test('large text: on for 2 class, off for 4 class, switch in Menu, no sideways scroll', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-01T10:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await expect(page.locator('#app')).toHaveClass(/big-text/);
  const size = await page.locator('.quest-body p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(17); // 19px, or 17px on short phones (normal text is 15px)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shots(page, '21-big-text');

  await page.getByRole('button', { name: 'Меню' }).click();
  const box = page.getByLabel('Крупный текст');
  await expect(box).toBeChecked();
  await page.waitForTimeout(600);
  await shots(page, '22-big-text-menu');
  await box.uncheck();
  await expect(page.locator('#app')).not.toHaveClass(/big-text/);
  await page.getByRole('button', { name: /2 класс — изменить/ }).click();
  await page.getByRole('button', { name: /^4\s*класс/ }).click();
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page.locator('#app')).not.toHaveClass(/big-text/);
});

test('Listik reads aloud: on for 2 class, button reads the quest, switch in Menu', async ({ page }) => {
  // The test browser has no voices; record what would be spoken instead.
  await page.addInitScript(() => {
    // Without the recorded voice (not downloaded yet), the phone's own voice reads.
    const realFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
      String(input instanceof Request ? input.url : input).includes('voice/') ? Promise.reject(new TypeError('offline')) : realFetch(input, init);
    const said: string[] = [];
    const how: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    (window as unknown as { __how: string[] }).__how = how;
    class FakeUtterance {
      lang = '';
      rate = 1;
      pitch = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        getVoices: () => [{ name: 'Milena', lang: 'ru-RU', localService: true, default: true }],
        speak: (u: FakeUtterance) => {
          said.push(u.text);
          how.push(`${u.rate}/${u.pitch}`);
        },
        cancel: () => undefined,
      },
    });
  });
  await page.clock.install({ time: new Date('2026-11-01T10:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  const speak = page.locator('#quest .speak');
  await expect(speak).toBeVisible();
  const box = (await speak.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  await speak.click();
  // The recording cannot be downloaded here, so after the wait the phone's voice reads.
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __said: string[] }).__said)).at(-1)).toContain('Привет! Я Листик');
  await expect(page.locator('#quest .goals')).toBeVisible(); // the tap did not fold the card
  await shots(page, '23-voice');

  // A question from Listik is read aloud as soon as it opens, with the answer options.
  await page.evaluate(() => {
    const app = window.__gardenApp as unknown as { state: { quiz: { pending: boolean } }; render: () => void };
    app.state.quiz.pending = true;
    app.render();
  });
  await page.locator('#listikBtn').click();
  await expect(page.locator('#sheet h2 .speak')).toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __said: string[] }).__said)).at(-1)).toMatch(/\?$/);
  const said2 = await page.evaluate(() => (window as unknown as { __said: string[] }).__said);
  expect(said2.at(-1)).not.toContain('Варианты ответа');
  expect(said2.at(-1)).toMatch(/\?$/);
  // 2 class: normal speed and natural pitch (slow and high sounded robotic to the children).
  const how = await page.evaluate(() => (window as unknown as { __how: string[] }).__how);
  expect(how.at(-1)).toBe('1/1');
  await shots(page, '24-voice-quiz');
  await page.locator('.sheet-close').click();

  await page.getByRole('button', { name: 'Меню' }).click();
  const toggle = page.getByLabel('Листик читает вслух');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.locator('.sheet-close').click();
  await expect(page.locator('#quest .speak')).toHaveCount(0);
});

test('Listik reads aloud with the recorded voice once it is downloaded', async ({ page }) => {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __log: string[] }).__log = log;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      log.push(`clip ${this.buffer?.duration.toFixed(2)}`);
      return start.apply(this, args);
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        getVoices: () => [],
        speak: () => log.push('system voice'),
        cancel: () => undefined,
      },
    });
  });
  const pack = page.waitForResponse((r) => /\/voice\/pack-[0-9a-f]+\.txt$/.test(r.url()) && r.ok());
  await page.goto('/');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await pack;
  await page.waitForTimeout(300);
  await page.locator('#quest .speak').click();
  // «Первое семечко. Привет! Я Листик. …»: several recorded pieces, decoded and played; no system voice.
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __log: string[] }).__log)).length).toBeGreaterThan(3);
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log).not.toContain('system voice');
  for (const line of log) expect(Number(line.split(' ')[1])).toBeGreaterThan(0.2);

  // Offline the next day: the recording comes from the service worker's cache.
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.locator('#quest .speak')).toBeVisible();
  await expect
    .poll(async () => {
      await page.locator('#quest .speak').click();
      return (await page.evaluate(() => (window as unknown as { __log: string[] }).__log)).filter((l) => l.startsWith('clip')).length;
    })
    .toBeGreaterThan(3);
  expect(await page.evaluate(() => (window as unknown as { __log: string[] }).__log)).not.toContain('system voice');
  await page.context().setOffline(false);
});

test.describe('speaker button', () => {
  // Without the service worker, so the test can hold back the big download (a slow phone network).
  test.use({ serviceWorkers: 'block' });
test('a tap while Listik reads stops him; a tap before the recording arrives waits for it', async ({ page }) => {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __log: string[] }).__log = log;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      log.push('clip');
      return start.apply(this, args);
    };
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (...args: Parameters<typeof stop>) {
      log.push('stop');
      return stop.apply(this, args);
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speaking: false, pending: false, getVoices: () => [], speak: () => log.push('system voice'), cancel: () => undefined },
    });
  });
  // The recording arrives slowly (a big file on a phone): hold it back for 3 seconds.
  let held = 0;
  await page.route(/\/voice\/pack-[0-9a-f]+\.txt$/, async (route) => {
    held += 1;
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  const speak = page.locator('#quest .speak');
  await expect.poll(() => held, { timeout: 30_000 }).toBeGreaterThan(0); // the download has started and is being held
  await speak.click(); // before the recording is here
  await expect(speak).toHaveClass(/speaking/);
  expect(await page.evaluate(() => (window as unknown as { __log: string[] }).__log)).toEqual([]);
  await expect(speak).toHaveAttribute('aria-label', 'Остановить');
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __log: string[] }).__log)).filter((l) => l === 'clip').length, { timeout: 30_000 }).toBeGreaterThan(3);
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log).not.toContain('system voice'); // waited for the live voice instead of the robot one
  await shots(page, '28-speaking');

  // Second tap stops: no new clips start, the button turns back into «listen».
  const clips = log.filter((l) => l === 'clip').length;
  await speak.click();
  await expect(speak).not.toHaveClass(/speaking/);
  await expect(speak).toHaveAttribute('aria-label', 'Послушать');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(after.filter((l) => l === 'clip').length).toBe(clips);
  expect(after).toContain('stop');

  // And a third tap reads again from the start.
  await speak.click();
  await expect(speak).toHaveClass(/speaking/);
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __log: string[] }).__log)).filter((l) => l === 'clip').length).toBeGreaterThan(clips);
});
});

test('«Тихо»: one tap on the screen silences Listik and the sounds, and it is remembered', async ({ page }) => {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __log: string[] }).__log = log;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speaking: false, pending: false, getVoices: () => [], speak: () => log.push('speak'), cancel: () => log.push('cancel') },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await expect(page.locator('#quest .speak')).toBeVisible();
  const mute = page.locator('#muteBtn');
  const box = (await mute.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Listik's button stays fully on screen next to it, even on the narrowest phones.
  const lb = (await page.locator('#listikBtn').boundingBox())!;
  expect(lb.x + lb.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.locator('#quest .speak').click(); // Listik starts reading…
  await mute.click(); // …and the teacher looks: one tap, quiet.
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(mute).toHaveAttribute('aria-label', 'Включить звук');
  await expect(page.locator('#quest .speak')).toHaveCount(0);
  await shots(page, '29-muted');
  await page.reload();
  await expect(page.locator('#muteBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#quest .speak')).toHaveCount(0);
  // The Menu still shows what was chosen there; another tap on the button brings the sound back.
  await page.locator('#muteBtn').click();
  await expect(page.locator('#muteBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#quest .speak')).toBeVisible();
});

test('2–3 class: hint finger after a quiet moment, fair problem with a picture, quiz with pictures', async ({ page }) => {
  const now = new Date('2026-11-01T12:00:00').getTime();
  await page.clock.install({ time: now });
  await page.goto('/');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await noGuests(page);
  const finger = page.locator('#l-hint .finger');
  await expect(finger).toHaveCount(0);
  await page.clock.runFor(10_000);
  await expect(finger).toHaveCount(1);
  // It points at the first empty bed (task 1: plant a daisy).
  const f = (await finger.boundingBox())!;
  const bed = (await page.locator('[data-plot="0"]').boundingBox())!;
  expect(f.x + f.width / 2).toBeGreaterThan(bed.x);
  expect(f.x).toBeLessThan(bed.x + bed.width);
  await shots(page, '25-finger');
  await page.locator('#stage').dispatchEvent('pointerdown');
  await expect(finger).toHaveCount(0);

  // Fair: a 2nd-grade problem about buying shows the goods with price tags.
  await page.evaluate(() => {
    const app = window.__gardenApp as unknown as {
      state: { questIndex: number; fair: { queue: number } };
      fairTask: unknown;
      showFair: () => void;
    };
    app.state.questIndex = 3;
    app.state.fair.queue = 1;
    app.fairTask = {
      guest: 'hedgehog',
      problem: {
        kind: 'cost', text: 'Ёжик: «Мне, пожалуйста, 3 морковки по 4 лепестка. Сколько с меня?»', answer: 12, unit: 'лепестков',
        answerText: '12 лепестков', hint: 'Цена × количество.', solution: '4 × 3 = 12',
        pic: { kind: 'goods', art: 'carrot', count: 3, price: 4 },
      },
    };
    app.showFair();
  });
  await expect(page.locator('.fair-pic .good')).toHaveCount(3);
  await page.waitForTimeout(400);
  await shots(page, '26-fair-pic');
  await page.locator('.sheet-close').click();

  // Quiz: options with pictures.
  await page.evaluate(() => {
    const app = window.__gardenApp as unknown as { state: { quiz: { pending: boolean } }; question: unknown; render: () => void };
    app.state.quiz.pending = true;
    app.question = {
      id: 'g2-pets', topic: 'Животные', grades: [2, 3], text: 'Какое животное — домашнее?',
      options: ['Корова', 'Лиса', 'Ёж'], pics: ['🐄', '🦊', '🦔'], explain: 'Корову держит человек.',
    };
    app.render();
  });
  await page.locator('#listikBtn').click();
  await expect(page.locator('.answers.with-pics .answer .pic')).toHaveCount(3);
  await page.waitForTimeout(400);
  await shots(page, '27-quiz-pics');
});

test('3–5 class: own gardener, seeds scattered at the start, the gardener walks; 2 class keeps Listik', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-01T10:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: /^4\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await expect(page.getByRole('heading', { name: 'Каким будет твой садовник?' })).toBeVisible();
  await page.getByRole('button', { name: 'Панама с цветком' }).click();
  await page.getByRole('button', { name: 'Пчела' }).click();
  await expect(page.getByRole('button', { name: 'Пчела' })).toHaveAttribute('aria-pressed', 'true');
  await shots(page, '30-gardener-creator');
  await page.getByRole('button', { name: 'В сад!' }).click();
  await expect(page.locator('#sheetBackdrop')).toBeHidden();
  await noGuests(page);
  await expect(page.locator('#l-gardener .gd-me')).toHaveCount(1);
  await expect(page.locator('#l-gardener .gd-pet')).toHaveAttribute('data-pet', 'bee');
  await expect(page.locator('[data-seed]')).toHaveCount(3);
  await expect(page.locator('.toast').last()).toContainText('Ветер раскидал семена');
  await shots(page, '31-gardener-seeds');

  // A seed: the gardener walks over and picks it up.
  const before = await page.locator('#l-gardener .gd-me').getAttribute('transform');
  await page.locator('[data-seed="0"]').click();
  await expect(page.locator('[data-seed]')).toHaveCount(2);
  expect(await page.locator('#l-gardener .gd-me').getAttribute('transform')).not.toBe(before);
  for (const k of [1, 2]) await page.locator(`[data-seed="${k}"]`).click();
  await expect(page.locator('[data-seed]')).toHaveCount(0);
  await expect(page.locator('#petals')).toHaveText('6');
  await expect(page.locator('.toast').last()).toContainText('Все семена собраны');

  // Tapping a bed sends the gardener beside it; the bed still works at once.
  await page.locator('[data-plot="0"]').click();
  await expect(page.getByRole('heading', { name: /семена|Что посадим/i }).first()).toBeVisible();
  await expect(page.locator('#l-gardener .gd-me')).toHaveAttribute('transform', 'translate(130.0 470.0)');
  await page.locator('.sheet-close').click();
  await shots(page, '32-gardener-bed');

  // Saved, and can be changed from the Menu without scattering seeds again.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('green-garden/save')!));
  expect(saved.gardener).toMatchObject({ hat: 'panama', pet: 'bee' });
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: 'Мой садовник' }).click();
  await page.getByRole('button', { name: 'Кепка' }).click();
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page.locator('[data-seed]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('green-garden/save')!).gardener.hat)).toBe('cap');
});

test('2 class: no gardener sheet at the start (Listik leads), but one can be called from the Menu', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-01T10:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: /^2\s*класс/ }).click();
  await page.getByRole('button', { name: 'Начать играть!' }).click();
  await expect(page.locator('#sheetBackdrop')).toBeHidden();
  await page.waitForTimeout(600);
  await expect(page.locator('#sheetBackdrop')).toBeHidden();
  await expect(page.locator('#l-gardener .gd-me')).toHaveCount(0);
  await page.getByRole('button', { name: 'Меню' }).click();
  await expect(page.getByRole('button', { name: 'Позвать садовника' })).toBeVisible();
});

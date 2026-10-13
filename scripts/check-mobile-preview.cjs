// Isolated mobile design acceptance checks. Uses the browser overrides in README.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (_) { playwright = require('../docs/design-exploration/browser-check/node_modules/playwright-core'); }
const address = process.env.PROJECT_PREVIEW_URL || 'http://127.0.0.1:4000';
const artifacts = path.resolve(__dirname, '../docs/mobile-preview-check');
const demo = '/mobile/design-preview/demo/';
const failures = [];
const errors = [];
const forbidden = [];
let browser;
async function check(name, run) {
  try { await run(); console.log('PASS: ' + name); }
  catch (error) { failures.push(name + ': ' + error.stack); console.error('FAIL: ' + name + ': ' + error.message); }
}
async function open(query = '', width = 390, reducedMotion = 'reduce', configure) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 768, isMobile: width < 768, reducedMotion });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/docs\.google\.com|script\.google\.com|soundcloud\.com/.test(request.url())) forbidden.push(request.url()); });
  if (configure) await configure(page);
  await page.goto(address + demo + '?' + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body?.dataset.mobilePreviewReady === 'true');
  return { context, page };
}
async function bounds(page) {
  const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    escaping: [...document.querySelectorAll('.collection-cell, h1, h2, input, .invite-counter, .mobile-bottom-dock')].filter(node => {
      const rect = node.getBoundingClientRect(); return rect.width && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map(node => node.className) }));
  assert(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  assert.deepEqual(result.escaping, [], JSON.stringify(result));
}
async function enter(page) {
  await page.locator('.mobile-cover-action').click();
  await page.waitForFunction(() => document.querySelector('.collection-intro').dataset.welcomeState === 'complete' || document.querySelector('.collection-intro').dataset.welcomeState === 'static');
  if (await page.locator('.collection-intro').getAttribute('data-welcome-state') === 'complete') await page.locator('[data-index-toggle]').waitFor({ state: 'visible' });
}
async function chapter(page, name) {
  await page.locator('[data-index-toggle]').click();
  await page.locator('#mobile-chapter-index a').filter({ hasText: new RegExp('^' + name + '$') }).click();
  await page.waitForTimeout(100);
}
async function view(page, name) {
  await page.evaluate(name => window.postMessage({ type: 'perspective-preview', view: name, fixture: new URLSearchParams(location.search).get('fixture') || 'populated' }, location.origin), name);
  await page.waitForFunction(name => new URLSearchParams(location.search).get('view') === name && document.querySelector('.booking-frame')?.getAttribute('aria-busy') !== 'true' && !document.querySelector('.collection-route'), name);
}
(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    for (const width of [320, 390, 430, 767]) await check('three-column tables and bottom-left preview windows at ' + width, async () => {
      const { context, page } = await open('', width);
      try {
        assert.equal(await page.locator('.mobile-chapter-nav').isVisible(), false, 'Static cover is unobstructed');
        await enter(page);
        const title = page.locator('#collection-words .collection-cell[data-source-column="1"]').first();
        assert.equal(await title.textContent(), 'A room becomes a place through the things we do together');
        for (const [name, expected] of [['Words', [0, 1, 2]], ['Sounds', [0, 1, 3]], ['Places', [0, 1, 3]], ['Projects', [0, 1, 2]]]) {
          await chapter(page, name);
          const table = page.locator('#collection-' + name.toLowerCase());
          const rows = await table.locator('.collection-row').evaluateAll(entries => entries.map(entry => [...entry.querySelectorAll('.collection-cell')].filter(cell => getComputedStyle(cell).display !== 'none').map(cell => ({ source: Number(cell.dataset.sourceColumn), x: cell.getBoundingClientRect().x, y: cell.getBoundingClientRect().y, bottom: cell.getBoundingClientRect().bottom }))));
          for (const cells of rows) {
            assert.deepEqual(cells.map(cell => cell.source), expected, name + ' retains first, second, and final data columns');
            assert(Math.max(...cells.map(cell => cell.y)) < Math.min(...cells.map(cell => cell.bottom)), 'Cells share a horizontal row');
            cells.forEach((cell, i) => assert(Math.abs(cell.x - rows[0][i].x) < 1, 'Columns align across rows'));
          }
          assert(await page.locator('.mobile-preview-window').isVisible(), name + ' has a window preview');
          assert.equal(await page.locator('.collection-row.is-active').count(), 1, 'A visible preview has one highlighted row');
          assert.equal(await page.locator('.mobile-preview-window .collection-image-window__title').textContent(), await page.locator('.collection-row.is-active .mobile-column--title').textContent(), 'The window matches the highlighted row');
          const windowBounds = await page.locator('.mobile-preview-window').boundingBox();
          assert(Math.abs(windowBounds.x - 12) < 1 && Math.abs(windowBounds.y + windowBounds.height - 832) < 1, 'Window opens at the bottom left');
          assert((await page.locator('.mobile-preview-window').getAttribute('aria-label')).startsWith(name.toUpperCase() + ' preview:'), name + ' shows its own preview');
          assert.equal(await page.locator('[data-current-chapter]').textContent(), name, 'Navigation follows the chosen section even at the document end');
          assert.equal(await page.locator('.mobile-image-stage').count(), 0, 'Images are outside the tabular flow');
        }
        assert.equal(await page.locator('#collection-sounds .mobile-column--final').first().textContent(), '04:12');
        assert.equal(await page.locator('#collection-invites .collection-row__columns').count(), 0, 'Invites keeps its separate layout');
        await chapter(page, 'Places');
        const panel = page.locator('.mobile-preview-window');
        await page.locator('#collection-places .collection-row').first().evaluate(node => node.focus({ preventScroll: true }));
        await panel.locator('img').evaluate(image => image.decode());
        await page.locator('#collection-places .collection-row').last().evaluate(node => node.focus({ preventScroll: true }));
        const first = await panel.locator('.collection-image-window__title').textContent();
        await page.evaluate(() => scrollBy(0, scrollY + 20 < document.documentElement.scrollHeight - innerHeight ? 20 : -20));
        await page.waitForTimeout(150);
        assert.notEqual(await panel.locator('.collection-image-window__title').textContent(), first, 'Window follows visible rows');
        assert.equal(await page.locator('.mobile-audio').isVisible(), false, 'Scrolling does not start audio');
        await page.locator('#collection-places .collection-row').first().evaluate(node => node.focus({ preventScroll: true }));
        assert.equal(await panel.evaluate(node => getComputedStyle(node).borderTopWidth), '1px', 'Desktop window border');
        const chrome = panel.locator('.collection-image-window__chrome');
        await chrome.focus();
        const start = await panel.boundingBox(); await page.keyboard.press('ArrowRight');
        assert((await panel.boundingBox()).x > start.x, 'Window moves with keyboard');
        await panel.locator('.collection-window__resize').focus(); await page.keyboard.press('ArrowRight');
        assert((await panel.boundingBox()).width > start.width, 'Window resizes with keyboard');
        await panel.locator('.mobile-preview-window__image').click();
        assert(await page.locator('dialog').isVisible());
        await page.keyboard.press('Escape');
        assert.equal(await panel.locator('.mobile-preview-window__image').evaluate(node => node === document.activeElement), true, 'Lightbox restores focus');
        await panel.locator('.collection-image-window__close').click();
        assert.equal(await panel.isVisible(), false);
        assert.equal(await page.locator('.collection-row.is-active').count(), 0, 'Closing the window clears the highlight');
        assert.equal(await page.locator('.collection-subsection--places [data-section-preview]').evaluate(node => node === document.activeElement), true);
        await page.locator('.collection-subsection--places [data-section-preview]').click();
        assert(await panel.isVisible(), 'Section heading reopens the window');
        await bounds(page);
        await page.screenshot({ path: path.join(artifacts, 'places-' + width + '.png') });
        for (const next of ['project', 'invite', 'details', 'overview', 'confirmation']) { await view(page, next); await bounds(page); }
      } finally { await context.close(); }
    });
    await check('hover and selection always show the matching preview after dismissal', async () => {
      const { context, page } = await open('entrance=tap');
      try {
        await enter(page); await chapter(page, 'Words');
        const rows = page.locator('#collection-words .collection-row');
        const panel = page.locator('.mobile-preview-window');
        await rows.first().hover();
        assert(await panel.isVisible());
        assert(await rows.first().evaluate(node => node.classList.contains('is-active')));
        assert.equal(await panel.locator('.collection-image-window__title').textContent(), await rows.first().locator('.mobile-column--title').textContent());
        await panel.locator('.collection-image-window__close').click();
        assert.equal(await page.locator('.collection-row.is-active').count(), 0);
        await rows.nth(1).hover();
        assert(await panel.isVisible(), 'Another highlighted row reopens the window');
        assert.equal(await panel.locator('.collection-image-window__title').textContent(), await rows.nth(1).locator('.mobile-column--title').textContent());
        await panel.locator('.collection-image-window__close').click();
        await rows.last().evaluate(node => node.focus({ preventScroll: true }));
        assert(await panel.isVisible(), 'Keyboard selection reopens the window');
        assert.equal(await panel.locator('.collection-image-window__title').textContent(), await rows.last().locator('.mobile-column--title').textContent());
      } finally { await context.close(); }
    });
    for (const entrance of ['compact', 'full', 'tap']) await check(entrance + ' interrupted entrance and missing artwork fallback', async () => {
      const { context, page } = await open('entrance=' + entrance, 390, 'no-preference');
      try {
        if (entrance === 'tap') {
          await page.locator('.mobile-cover-action').click();
          await page.setViewportSize({ width: 320, height: 568 });
        } else { await page.keyboard.press('PageDown'); await page.setViewportSize({ width: 320, height: 568 }); }
        await page.waitForTimeout(150);
        assert.equal(await page.locator('.mobile-tap-plane').count(), 0);
        await bounds(page);
      } finally { await context.close(); }
      const failure = await open('entrance=' + entrance, 320, 'no-preference', async page => {
        await page.route('**/assets/img/header-image.jpg', route => route.abort());
      });
      try { assert(await failure.page.locator('#collection-invites').isVisible()); await bounds(failure.page); }
      finally { await failure.context.close(); }
    });
    for (const entrance of ['compact', 'tap']) await check(entrance + ' direct section anchor', async () => {
      const { context, page } = await open('entrance=' + entrance + '#projects-title', 390, 'no-preference');
      try {
        await page.waitForFunction(() => document.querySelector('.collection-intro').dataset.welcomeState === 'complete');
        const heading = await page.locator('#projects-title').boundingBox();
        const row = await page.locator('#collection-projects .collection-row').first().boundingBox();
        assert(heading.y >= 48 && row.y + row.height <= 844, 'Last section lands below navigation with its first row visible, including at the document end');
      } finally { await context.close(); }
    });
    for (const entrance of ['compact', 'full', 'tap']) await check(entrance + ' entrance, reversal, replay, and reduced motion', async () => {
      const { context, page } = await open('entrance=' + entrance, 390, 'no-preference');
      try {
        await page.waitForTimeout(1400);
        await page.screenshot({ path: path.join(artifacts, 'cover-' + entrance + '.png') });
        assert.equal(await page.locator('.collection-intro').getAttribute('data-welcome-state'), entrance === 'tap' ? 'cover' : 'ready');
        if (entrance !== 'tap') {
          const end = await page.evaluate(() => CollectionWelcome.snapshot(document.querySelector('[data-collection-welcome]')).handoverEnd);
          assert(entrance === 'compact' ? end >= 160 && end <= 280 : end >= 360 && end <= 720);
          await page.evaluate(end => scrollTo(0, end * .95), end);
          await page.waitForTimeout(100);
          assert.equal(await page.locator('.collection-intro').getAttribute('data-welcome-state'), 'handover');
          await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
          assert.equal(await page.locator('.collection-intro').getAttribute('data-welcome-state'), 'building');
        }
        await enter(page);
        assert(await page.locator('[data-index-toggle]').isVisible());
        await chapter(page, 'Cover');
        assert(await page.locator('.mobile-cover-action').isVisible());
        await enter(page);
        await page.setViewportSize({ width: 430, height: 740 });
        await bounds(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await bounds(page);
        await page.reload(); await page.waitForFunction(() => document.body?.dataset.mobilePreviewReady === 'true');
        assert(await page.locator('#collection-invites').isVisible());
      } finally { await context.close(); }
    });
    await check('sample audio survives navigation, booking validation, dock collision, and history', async () => {
      const { context, page } = await open('entrance=tap');
      try {
        await enter(page); await chapter(page, 'Sounds');
        await page.locator('#collection-sounds .collection-row').first().click();
        assert(await page.locator('.mobile-audio').isVisible());
        await page.waitForTimeout(1100);
        const before = await page.locator('[data-audio-time]').textContent();
        await chapter(page, 'Projects');
        await page.locator('#collection-projects .collection-row').first().locator('.mobile-column--final').click();
        await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'project');
        assert(await page.locator('.mobile-audio').isVisible());
        assert.notEqual(await page.locator('[data-audio-time]').textContent(), 'Sample 0:00 / 04:12');
        await bounds(page);
        await page.locator('[data-collection-home]').click();
        await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'collection');
        await chapter(page, 'Invites'); await page.locator('[data-collection-invite]').click();
        await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'invite');
        assert(await page.locator('.mobile-audio').isVisible());
        assert.equal((await page.locator('[data-booking-action]').textContent()).trim(), 'Choose tickets ↓');
        await page.locator('[data-booking-action]').click();
        assert((await page.locator('.invite-detail__reservation').boundingBox()).y >= -1);
        const plus = page.locator('[data-action="plus"][data-id="general"]');
        assert((await plus.boundingBox()).width >= 44);
        for (let i = 0; i < 4; i++) await plus.click();
        assert(await plus.isDisabled());
        assert.equal(await page.locator('[data-count="general"]').textContent(), '4');
        await page.locator('[data-booking-action]').click();
        await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'details');
        await page.locator('.ticket-flow-footer button').click();
        assert.equal(await page.locator('.has-error').count(), 3);
        assert.equal(await page.locator('input[name="firstName"]').evaluate(node => node === document.activeElement), true);
        assert.equal(await page.locator('.mobile-booking-dock').isVisible(), false, 'Dock yields while input is focused');
        await page.locator('input[name="firstName"]').fill('Jana');
        await page.locator('input[name="lastName"]').fill('Franck');
        await page.locator('input[name="email"]').fill('invalid-email');
        await page.locator('.ticket-flow-footer button').click();
        assert.equal(await page.locator('[data-error="email"]').textContent(), 'Enter a valid email');
        await page.locator('input[name="email"]').fill('jana@example.com');
        await page.locator('.ticket-flow-footer button').click();
        await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'overview');
        await page.waitForTimeout(50);
        assert(await page.locator('.mobile-audio').isVisible());
        const dockBounds = await page.locator('.mobile-bottom-dock').boundingBox();
        assert(dockBounds.y >= 0 && dockBounds.y + dockBounds.height <= 845);
        await bounds(page);
        await page.screenshot({ path: path.join(artifacts, 'review-audio-390.png'), fullPage: true });
        await page.locator('[data-booking-action]').click();
        await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'confirmation');
        assert(await page.locator('.mobile-sample-note').isVisible());
        assert.equal(await page.locator('.mobile-booking-dock').isVisible(), false);
        await page.goBack(); await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'overview');
        await page.goBack(); await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'details');
        assert.equal(await page.locator('input[name="email"]').inputValue(), 'jana@example.com');
        await page.reload(); await page.waitForFunction(() => document.body?.dataset.mobilePreviewReady === 'true');
        assert(await page.locator('.mobile-audio').isVisible());
        assert.equal(await page.locator('input[name="email"]').inputValue(), 'jana@example.com');
        await page.locator('[data-audio-expand]').click(); assert(await page.locator('[data-dialog-play]').isVisible());
        await page.keyboard.press('Escape'); await page.locator('[data-audio-close]').click();
        assert.equal(await page.locator('.mobile-audio').isVisible(), false);
      } finally { await context.close(); }
    });
    await check('direct project return and fixture history', async () => {
      const { context, page } = await open('view=project&entrance=tap&fixture=long');
      try {
        await page.locator('[data-collection-home]').click();
        await page.waitForFunction(() => document.querySelector('.collection-intro').dataset.welcomeState === 'complete');
        await page.waitForTimeout(50);
        assert((await page.locator('#projects-title').boundingBox()).y >= 48);
        await view(page, 'invite');
        await page.evaluate(() => window.postMessage({ type: 'perspective-preview', view: 'invite', fixture: 'closed' }, location.origin));
        await page.waitForSelector('.invite-reservation__closed');
        await page.goBack();
        await page.waitForFunction(() => MobilePreviewData.fixture === 'long' && new URLSearchParams(location.search).get('view') === 'collection');
        assert.equal(await page.locator('#collection-words .collection-cell[data-source-column="1"]').first().textContent(), 'A room becomes a place through the things we do together, and the small details that make the ordinary feel worth another look');
      } finally { await context.close(); }
    });
    for (const fixture of ['long', 'no-image', 'failed-image', 'empty', 'unavailable', 'closed']) await check(fixture + ' content states at 320px', async () => {
      const { context, page } = await open('fixture=' + fixture, 320);
      try {
        await enter(page); await bounds(page);
        if (fixture === 'no-image') {
          await chapter(page, 'Words');
          assert(await page.locator('.mobile-preview-window').isVisible(), 'Missing images still have a visible preview');
          assert.equal(await page.locator('.collection-row.is-active').count(), 1);
          assert.equal(await page.locator('.mobile-preview-window__image span').textContent(), 'No image available');
          assert(await page.locator('.mobile-preview-window__image span').isVisible());
          assert.equal(await page.locator('#collection-words .collection-cell[data-source-column="1"]').first().textContent(), 'A room becomes a place through the things we do together');
        }
        if (fixture === 'failed-image') {
          await chapter(page, 'Places');
          await page.waitForFunction(() => !document.querySelector('.mobile-preview-window__image span').hidden);
        }
        if (['empty', 'unavailable'].includes(fixture)) assert.equal(await page.locator('.collection-row').count(), 0);
        for (const next of ['project', 'invite', 'details', 'overview', 'confirmation']) {
          await view(page, next); await bounds(page);
          if (fixture === 'closed' && next === 'invite') assert(await page.locator('.invite-reservation__closed').isVisible());
        }
        await page.screenshot({ path: path.join(artifacts, 'confirmation-' + fixture + '-320.png'), fullPage: true });
      } finally { await context.close(); }
    });
    await check('comparison, width presets, fixture updates, replay, and public isolation', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(address + '/mobile/design-preview/?compare=true');
        await page.waitForFunction(() => document.querySelectorAll('iframe').length === 3);
        assert.equal(await page.locator('iframe').count(), 3);
        await page.selectOption('select[name="width"]', '320');
        assert.equal(Math.round((await page.locator('iframe').first().boundingBox()).width), 320);
        await page.selectOption('select[name="view"]', 'invite');
        for (const frame of page.frames().slice(1)) await frame.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'invite');
        await page.selectOption('select[name="fixture"]', 'closed');
        for (const frame of page.frames().slice(1)) await frame.waitForSelector('.invite-reservation__closed');
        await page.locator('[data-preview-replay]').click();
        for (const frame of page.frames().slice(1)) await frame.waitForFunction(() => document.body?.dataset.mobilePreviewReady === 'true');
        await page.screenshot({ path: path.join(artifacts, 'compare-1440.png'), fullPage: true });
        for (const width of [320, 768, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto(address + '/');
          assert.equal(await page.locator('link[href*="mobile-preview"]').count(), 0);
          assert.equal(await page.locator('.mobile-cover-action, .mobile-chapter-nav').count(), 0);
        }
      } finally { await context.close(); }
    });
    assert.deepEqual(errors, [], 'No browser exceptions');
    assert.deepEqual(forbidden, [], 'No live sheet, webhook, or audio requests');
    assert.deepEqual(failures, [], failures.join('\n\n'));
    console.log('PASS: mobile collection preview is isolated, responsive, and interactive.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

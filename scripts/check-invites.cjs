// Browser acceptance checks for event pages and the reservation journey.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (_) { playwright = require('../docs/design-exploration/browser-check/node_modules/playwright-core'); }

const address = new URL(process.env.PROJECT_PREVIEW_URL || 'http://stanbrouwer.test').origin;
const siteRoot = path.resolve(__dirname, '../_site');
const eventId = 'rehaul-test-event';
const ticketIds = ['general', 'supporter'];
const headers = [
  'event_id', 'title', 'publish', 'date_iso', 'date_label', 'start_time', 'end_time', 'location', 'address',
  'hero_image_url', 'gallery_image_urls', 'intro_markdown', 'details_markdown', 'programme_markdown',
  'practical_markdown', 'ticketing_open', 'ticketing_close', 'ticket_pdf_url', 'invite_only', 'ticket_id',
  'ticket_enabled', 'ticket_name', 'ticket_description_markdown', 'ticket_price', 'ticket_max'
];
const imageUrl = `${address}/assets/img/de_loods.jpg`;
const ticketPdf = 'https://example.com/test-ticket.pdf';
const eventRows = ticketIds.map((ticketId, index) => [
  eventId,
  'A Night of Listening and Neighbourhood Stories',
  'TRUE',
  '2027-04-12',
  '12 April 2027',
  '18:00',
  '21:00',
  'The Old Harbour',
  'Kade 12, Rotterdam',
  imageUrl,
  '',
  'An evening of **music** and conversation.',
  'Meet local artists and hear new work.',
  '',
  '',
  '',
  '',
  ticketPdf,
  'FALSE',
  ticketId,
  'TRUE',
  index ? 'Supporter' : 'General admission',
  index ? 'Supports the local programme.' : '',
  index ? '€20' : '€12.50',
  '4'
]);
const sheet = {
  status: 'ok',
  table: {
    cols: headers.map(label => ({ label, type: 'string' })),
    rows: eventRows.map(values => ({ c: values.map(value => value === '' ? null : { v: value }) }))
  }
};
const emptySheet = { status: 'ok', table: { cols: [], rows: [] } };

async function attachMocks(page, options = {}) {
  await page.route(`${address}/**`, async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const filename = path.resolve(siteRoot, `.${relative}`);
    if (filename !== siteRoot && !filename.startsWith(siteRoot + path.sep)) {
      return route.fulfill({ status: 403, body: 'Forbidden' });
    }
    try {
      const body = await fs.readFile(filename);
      const type = path.extname(filename).toLowerCase();
      const contentType = {
        '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
        '.woff2': 'font/woff2'
      }[type] || 'application/octet-stream';
      await route.fulfill({ body, contentType });
    } catch (_) {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });
  await page.route('https://docs.google.com/**', async route => {
    const url = new URL(route.request().url());
    const callback = url.searchParams.get('tqx')?.match(/responseHandler:([^;]+)/)?.[1];
    if (!callback) return route.abort();
    const invites = url.searchParams.get('sheet') === 'INVITES';
    if (invites && options.inviteGate) await options.inviteGate;
    const response = invites ? structuredClone(sheet) : emptySheet;
    if (invites && options.long) response.table.rows.forEach(row => {
      row.c[headers.indexOf('details_markdown')] = { v: Array.from({ length: 12 }, (_, index) =>
        `## Story ${index + 1}\nMeet local artists and hear new work. Read the complete event story and reserve your place below.\n\n`).join('') };
    });
    await route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
  });
  await page.route('https://cdnjs.cloudflare.com/**', route => route.abort());
  await page.route('https://script.google.com/**', route => route.fulfill({ status: 200, body: 'ok' }));
  await page.context().route('https://example.com/**', route => route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' }));
}

async function waitForPage(page, pathname) {
  await page.waitForFunction(path => location.pathname === path, pathname);
  await page.waitForFunction(() => !document.querySelector('.collection-route')
    && !document.body.classList.contains('is-collection-navigating'));
}

async function checkNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(dimensions.scrollWidth <= dimensions.width + 1, `Unexpected horizontal overflow: ${JSON.stringify(dimensions)}`);
}

async function frameGeometry(page, selector = '.collection-poster:visible') {
  return page.locator(selector).evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, width: rect.width, right: rect.right, bottom: rect.bottom };
  });
}

async function checkFrame(page, reference) {
  const frame = await frameGeometry(page);
  assert(Math.abs(frame.x - reference.x) < 1, `Frame position differs: ${JSON.stringify({ frame, reference })}`);
  assert(Math.abs(frame.width - reference.width) < 1, `Frame width differs: ${JSON.stringify({ frame, reference })}`);
  const escaped = await page.locator('.collection-poster:visible').evaluate(article => {
    const frame = article.getBoundingClientRect();
    return [...article.querySelectorAll('.invite-detail__section, .ticket-flow-section, .ticket-confirmation, .invite-preview-summary, .invite-form-grid, .ticket-form-grid, .invite-reservation-footer, .ticket-flow-footer')]
      .filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.width && (rect.x < frame.x - 1 || rect.right > frame.right + 1 || rect.bottom > frame.bottom + 1);
      }).map(node => node.className);
  });
  assert.deepEqual(escaped, [], 'All booking sections stay within the frame');
  await checkNoOverflow(page);
}

async function expectedFrame(page) {
  return page.evaluate(() => {
    const width = innerWidth, client = document.body.getBoundingClientRect().width;
    const paper = width >= 768 ? width * 2 / 3 : width >= 640 ? width * .9 : client - 16;
    return { x: (client - paper) / 2, width: paper };
  });
}

async function checkNatural(page) {
  await checkFrame(page, await expectedFrame(page));
  const layout = await page.locator('.booking-frame:visible').evaluate(article => {
    const pane = article.querySelector('.booking-content');
    const paper = article.getBoundingClientRect(), content = pane.getBoundingClientRect();
    const footer = article.parentElement.querySelector('.collection-outro img').getBoundingClientRect();
    return { position: getComputedStyle(pane).position, overflow: getComputedStyle(pane).overflowY,
      paneHeight: pane.clientHeight, paneScroll: pane.scrollHeight,
      contained: content.bottom <= paper.bottom + 1,
      overlap: paper.bottom - footer.top, expectedOverlap: Math.min(152, innerWidth * .12),
      documentHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight };
  });
  assert.equal(layout.position, 'relative', 'Booking content participates in document flow');
  assert.equal(layout.overflow, 'visible', 'No nested booking scrollbar');
  assert(layout.paneScroll <= layout.paneHeight + 1 && layout.contained, 'Complete content fits inside the paper');
  assert(Math.abs(layout.overlap - layout.expectedOverlap) < 1, 'Footer keeps the common overlap');
}

async function readingPosition(page, target = 240) {
  await page.evaluate(target => scrollTo({ top: target, behavior: 'instant' }), target);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const actual = await page.evaluate(() => scrollY);
  assert(Math.abs((await page.evaluate(() => history.state.collectionView.scroll)) - actual) < 1, 'Save document scroll per history entry');
  return actual;
}

async function checkPreview(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await attachMocks(page);
  await page.addInitScript(() => {
    for (const key of ['event', 'selection', 'details', 'confirmed']) sessionStorage.setItem('tz_' + key, 'production-' + key);
  });
  const external = [];
  page.on('request', request => { if (new URL(request.url()).origin !== address) external.push(request.url()); });
  const layouts = ['detail', 'side', 'ruled', 'quiet'];
  const fixtures = ['open', 'closed', 'no-image', 'long'];
  const views = ['invite', 'details', 'overview', 'confirmation'];
  await page.goto(`${address}/invites/design-preview/?fixture=open`, { waitUntil: 'networkidle' });
  const storageBefore = await page.evaluate(() => JSON.stringify(sessionStorage));
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  await page.locator('.invite-preview-controls summary').click();
  // Local preview covers all current layouts, all booking steps, and responsive widths.
  for (const width of [320, 390, 700, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const fixture of fixtures) {
      await page.locator('[data-preview-fixture]').selectOption(fixture);
      for (const layout of layouts) {
        await page.locator('[data-preview-layout]').selectOption(layout);
        for (const view of views) {
          await page.locator('[data-preview-view]').selectOption(view);
          await settled(page);
          try { await checkNatural(page); }
          catch (error) { error.message += ` (${width}px / ${layout} / ${view} / ${fixture})`; throw error; }
          assert.deepEqual(await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search))),
            { layout, motion: 'point', view, fixture });
          if (view === 'invite') assert.equal(await page.locator('.invite-reservation__closed').count(), fixture === 'closed' ? 1 : 0);
        }
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('[data-preview-fixture]').selectOption('open');
  await settled(page);
  await page.locator('[data-preview-view]').selectOption('invite');
  await settled(page);
  await page.locator('[data-action="plus"][data-id="general"]').click();
  await page.locator('button[type="submit"]').click();
  await page.getByRole('heading', { name: 'Who is joining?' }).waitFor();
  await settled(page);
  await page.locator('input[name="firstName"]').fill('Ada');
  await page.locator('input[name="lastName"]').fill('Lovelace');
  await page.locator('input[name="email"]').fill('ada@example.com');
  await page.locator('button[type="submit"]').click();
  await page.getByRole('heading', { name: 'One last look.' }).waitFor();
  await settled(page);
  await page.locator('[data-place-order]').click();
  await page.getByRole('heading', { name: "You're in." }).waitFor();
  await settled(page);
  await page.getByRole('button', { name: 'View sample' }).first().click();
  await page.getByRole('region', { name: 'Sample ticket' }).waitFor();
  await checkNatural(page);
  await page.getByRole('button', { name: 'Close sample' }).click();
  assert.equal(await page.evaluate(() => JSON.stringify(sessionStorage)), storageBefore, 'Preview preserves production storage');
  assert.deepEqual(external, [], 'Preview uses only local fixtures');
  await context.close();
  console.log('Preview: 256 responsive layout/view/fixture combinations and animated sample journey passed.');
}

const settled = page => page.waitForFunction(() => !document.querySelector('.collection-route')
  && !document.body.classList.contains('is-collection-navigating')
  && !document.querySelector('.booking-frame[data-transition-phase]'));

async function historyAt(page, action, pathname, position) {
  await action();
  await waitForPage(page, pathname);
  const restored = await page.evaluate(() => ({ scroll: scrollY, max: document.documentElement.scrollHeight - innerHeight, state: history.state }));
  assert(Math.abs(restored.scroll - Math.min(position, restored.max)) < 1, `History restores ${pathname} scroll ${position}: ${JSON.stringify(restored)}`);
  await checkNatural(page);
}

module.exports = { attachMocks, address };

if (require.main === module) (async () => {
  const browser = await playwright.chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const errors = [];
  const previewOnly = process.argv.includes('--preview-only');
  try {
    if (!previewOnly) for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await attachMocks(page, { long: true });
      await page.goto(`${address}/`, { waitUntil: 'domcontentloaded' });
      await page.locator(`[data-collection-invite="${eventId}"]`).click();
      await waitForPage(page, '/invites/');
      await page.getByRole('heading', { name: 'A Night of Listening and Neighbourhood Stories' }).waitFor();
      await checkNatural(page);
      assert((await page.evaluate(() => document.documentElement.scrollHeight)) > viewport.height * 2, 'Long event grows beyond the viewport');
      const invitePosition = await readingPosition(page, 500);
      await page.reload({ waitUntil: 'networkidle' });
      assert(Math.abs((await page.evaluate(() => scrollY)) - invitePosition) < 1, 'Direct event reload restores document position');
      await page.locator('[data-action="plus"][data-id="general"]').click();
      // Observe the actual viewport animation while the document is locked.
      await page.evaluate(() => {
        window.originalFooter = document.querySelector('[data-booking-page] > .collection-outro img');
        window.originalPane = document.querySelector('[data-booking-page] .booking-content');
        window.stepSamples = [];
        window.sampleSteps = true;
        const sample = () => {
          const overlay = document.querySelector('.collection-route--point');
          if (overlay) stepSamples.push({ phase: overlay.dataset.transitionPhase,
            locked: document.body.classList.contains('is-collection-navigating'),
            copies: overlay.querySelectorAll('.collection-route__floor-image').length,
            snapshotOverflow: getComputedStyle(overlay.querySelector('.collection-route__snapshot')).overflow,
            nativeTransform: getComputedStyle(originalPane).transform,
            frozenScroll: overlay.querySelector('.collection-route__snapshot > main')?.style.top });
          if (window.sampleSteps) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.locator('button[type="submit"]').scrollIntoViewIfNeeded();
      const inviteDeparture = await readingPosition(page, await page.evaluate(() => scrollY));
      await page.locator('form').evaluate(form => form.requestSubmit());
      await waitForPage(page, '/tickets/details/');
      assert.equal(await page.evaluate(() => scrollY), 0, 'Forward details starts at top');
      await checkNatural(page);
      const frames = await page.evaluate(() => { window.sampleSteps = false; return window.stepSamples; });
      assert(frames.length > 10 && ['leaving', 'point', 'entering'].every(phase => frames.some(frame => frame.phase === phase)), 'Point transition keeps departure, hold and arrival');
      assert(frames.every(frame => frame.locked && frame.copies <= 1 && frame.snapshotOverflow === 'hidden' && frame.nativeTransform === 'none'), 'Animate one viewport snapshot while the live document remains unscaled');
      assert.equal(new Set(frames.filter(frame => frame.phase === 'leaving').map(frame => frame.frozenScroll)).size, 1,
        'Freeze the outgoing viewport throughout departure');
      await page.locator('button[type="submit"]').click();
      assert.equal(await page.locator('input.has-error').count(), 3, 'Required details are validated');
      await page.locator('input[name="firstName"]').fill('Jana');
      await page.locator('input[name="lastName"]').fill('Franck');
      await page.locator('input[name="email"]').fill('invalid');
      await page.locator('button[type="submit"]').click();
      assert.equal(await page.locator('[data-error="email"]').textContent(), 'Enter a valid email');
      await page.locator('input[name="email"]').fill('jana@example.com');
      const detailsPosition = await readingPosition(page);
      // Submit without Playwright scrolling a button into view, preserving our saved position.
      await page.locator('form').evaluate(form => form.requestSubmit());
      await waitForPage(page, '/tickets/overview/');
      assert.equal(await page.evaluate(() => scrollY), 0, 'Forward review starts at top');
      await checkNatural(page);
      const reviewPosition = await readingPosition(page, 120);
      await historyAt(page, () => page.goBack(), '/tickets/details/', detailsPosition);
      assert.equal(await page.locator('input[name="firstName"]').inputValue(), 'Jana', 'History retains entered details');
      await historyAt(page, () => page.goForward(), '/tickets/overview/', reviewPosition);
      await page.locator('[data-place-order]').evaluate(button => button.click());
      await waitForPage(page, '/tickets/confirmation/');
      assert.equal(await page.evaluate(() => scrollY), 0, 'Forward confirmation starts at top');
      await checkNatural(page);
      await page.getByRole('heading', { name: "You're in." }).waitFor();
      if (viewport.width === 1440) {
        const [ticketWindow] = await Promise.all([
          page.waitForEvent('popup'), page.getByRole('button', { name: 'Download' }).first().click()
        ]);
        await ticketWindow.waitForLoadState('domcontentloaded').catch(() => {});
        assert.equal(ticketWindow.url(), ticketPdf, 'Keep the event ticket download URL');
        await ticketWindow.close();
      }
      assert(await page.evaluate(() => originalFooter === document.querySelector('[data-booking-page] > .collection-outro img')
        && originalPane === document.querySelector('[data-booking-page] .booking-content')), 'All steps retain their original footer and content container');
      await page.screenshot({ path: path.join(os.tmpdir(), `stanbrouwer-confirmation-${viewport.width}.png`), fullPage: true });
      await historyAt(page, () => page.goBack(), '/tickets/overview/', reviewPosition);
      await historyAt(page, () => page.goBack(), '/tickets/details/', detailsPosition);
      const savedDetailsPosition = await page.evaluate(() => scrollY);
      let releaseImage;
      const imageGate = new Promise(resolve => { releaseImage = resolve; });
      const delayedImage = async route => { await imageGate; await route.fallback(); };
      if (viewport.width === 1440) await page.route('**/de_loods.jpg', delayedImage);
      await page.reload({ waitUntil: viewport.width === 1440 ? 'domcontentloaded' : 'networkidle' });
      if (viewport.width === 1440) {
        await page.waitForTimeout(1100);
        assert.equal(await page.evaluate(() => scrollY), savedDetailsPosition, 'A slow event image keeps saved scroll reachable');
        releaseImage();
        await page.waitForFunction(() => !CollectionPageTransition.isRestoring(document.querySelector('[data-booking-page]')));
        await page.unroute('**/de_loods.jpg', delayedImage);
        await page.waitForLoadState('networkidle');
      }
      const reloaded = await page.evaluate(() => ({ scroll: scrollY, max: document.documentElement.scrollHeight - innerHeight, state: history.state }));
      assert(Math.abs(reloaded.scroll - Math.min(savedDetailsPosition, reloaded.max)) < 1,
        `Standalone booking reload restores scroll ${savedDetailsPosition}: ${JSON.stringify(reloaded)}`);
      await historyAt(page, () => page.goBack(), '/invites/', inviteDeparture);
      await checkNatural(page);
      await context.close();
      console.log(`Passed ${viewport.width}px full-length events, booking, history, validation and reload.`);
    }
    // Delayed direct loading reserves the saved position without a late scroll jump.
    if (!previewOnly) for (const interrupt of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await attachMocks(page, { long: true, inviteGate: gate });
      await page.addInitScript(() => history.replaceState({ otherMetadata: 'retained', collectionView: { scroll: 1200 } }, '', location.href));
      await page.goto(`${address}/invites/?event=${eventId}`, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.evaluate(() => scrollY), 1200, 'Reach saved position before data arrives');
      if (interrupt) {
        await page.mouse.move(10, 10);
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(100);
      }
      const before = await page.evaluate(() => scrollY);
      release();
      await page.getByRole('heading', { name: 'A Night of Listening and Neighbourhood Stories' }).waitFor();
      if (interrupt) assert(Math.abs((await page.evaluate(() => scrollY)) - before) < 1, 'User input cancels late restoration');
      else assert.equal(await page.evaluate(() => scrollY), 1200, 'Restore saved position once full content is available');
      assert.equal(await page.evaluate(() => history.state.otherMetadata), 'retained', 'Preserve unrelated history metadata');
      assert.equal(await page.locator('.collection-route').count(), 0, 'Reduced motion skips snapshots');
      await checkNatural(page);
      await context.close();
    }
    if (!previewOnly) for (const mode of ['resize', 'motion-change', 'quick-back', 'leave-booking']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await attachMocks(page, { long: true });
      await page.goto(`${address}/`, { waitUntil: 'domcontentloaded' });
      await page.locator(`[data-collection-invite="${eventId}"]`).click();
      await waitForPage(page, '/invites/');
      await page.locator('[data-action="plus"][data-id="general"]').evaluate(button => button.click());
      const saved = await readingPosition(page, 500);
      await page.locator('form').evaluate(form => form.requestSubmit());
      await page.waitForFunction(() => document.querySelector('.collection-route--point')?.dataset.transitionPhase === 'leaving');
      if (mode === 'resize') await page.setViewportSize({ width: 700, height: 650 });
      if (mode === 'motion-change') await page.emulateMedia({ reducedMotion: 'reduce' });
      if (mode === 'quick-back' || mode === 'leave-booking') await page.goBack();
      if (mode === 'leave-booking') {
        await page.goBack();
        await waitForPage(page, '/');
        await page.waitForFunction(() => !document.querySelector('[data-collection-welcome]').hidden);
        await page.goForward();
        await waitForPage(page, '/invites/');
      } else if (mode === 'quick-back') await historyAt(page, async () => {}, '/invites/', saved);
      else {
        await waitForPage(page, '/tickets/details/');
        await page.getByRole('heading', { name: 'Who is joining?' }).waitFor();
        assert.equal(await page.evaluate(() => scrollY), 0, 'Interrupted forward action still starts at the top');
      }
      await settled(page);
      assert.equal(await page.locator('.collection-route, .collection-route__floor').count(), 0, 'Interrupted booking cleans up its snapshots');
      assert(await page.locator('.booking-content').evaluate(pane => !pane.inert), 'Interrupted booking restores interaction');
      await checkNatural(page);
      await context.close();
      console.log(`Passed ${mode} booking interruption.`);
    }
    await checkPreview(browser, errors);
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('Invite and booking acceptance checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

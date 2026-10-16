// Deterministic browser checks. Start the local Jekyll preview, then run:
// node scripts/check-collection-windows.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('../docs/design-exploration/browser-check/node_modules/playwright-core')); }
const origin = process.env.COLLECTION_ORIGIN || 'http://127.0.0.1:4317';
const output = path.resolve(__dirname, '../docs/collection-window-qa');
const errors = [];
const requests = [];
const near = (a, b, message, tolerance = 1.5) => assert(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
const rect = locator => locator.evaluate(element => {
  const r = element.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
const settle = page => page.waitForFunction(() =>
  [...document.querySelectorAll('.collection-media-window, .collection-image-window, .collection-window-proxy')]
    .flatMap(element => element.getAnimations({ subtree: true }))
    .filter(animation => animation.effect?.target?.closest('.collection-soundcloud-meta__ticker') == null)
    .every(animation => animation.playState !== 'running')
);

async function executable() {
  if (process.env.COLLECTION_BROWSER_PATH) return process.env.COLLECTION_BROWSER_PATH;
  const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright');
  for (const name of (await fs.readdir(cache)).filter(name => /^chromium-\d+$/.test(name)).reverse()) {
    const file = path.join(cache, name, 'chrome-win64/chrome.exe');
    try { await fs.access(file); return file; } catch {}
  }
  throw new Error('Set COLLECTION_BROWSER_PATH to your Chromium executable.');
}

async function fixtures(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.route('https://**/*', route => route.abort());
  await page.route('https://docs.google.com/**', route => {
    const url = new URL(route.request().url());
    const callback = url.searchParams.get('tqx')?.match(/responseHandler:([^;]+)/)?.[1];
    if (!callback) return route.abort();
    const sheet = url.searchParams.get('sheet');
    const photo = index => origin + '/assets/img/' + ['header-image.jpg', 'de_loods.jpg', 'thuis_oranje.JPG'][index % 3];
    let rows = [];
    let columns = [];
    if (sheet === 'INVITES') {
      const event = { publish: true, event_id: 'collection-evening', title: 'Collection evening', date_iso: '2027-08-15', date_label: 'Sun 15 Aug 2027', start_time: '18:00', end_time: '23:00', location: 'De Loods', hero_image_url: photo(1), intro_markdown: 'An evening together.', ticketing_open: '2026-01-01T00:00:00+01:00', ticketing_close: '2027-08-15T23:00:00+02:00', ticket_id: 'admission', ticket_name: 'Admission', ticket_price: 'Free', ticket_max: 4, ticket_enabled: true };
      columns = Object.keys(event).map(label => ({ label }));
      rows = [Object.values(event)];
    }
    if (sheet === 'PLACES') rows = Array.from({ length: 18 }, (_, i) => [
      `${String(i + 1).padStart(2, '0')} 10`, `Place ${i + 1}`, 'Hidden metadata', 'Cafe', 'Amsterdam',
      `https://example.com/place-${i}`, i === 15 ? origin + '/slow-image.jpg' : i === 16 ? origin + '/missing-image.jpg' : i === 17 ? origin + '/slow-image-2.jpg' : photo(i)
    ]);
    if (sheet === 'WORDS') rows = Array.from({ length: 8 }, (_, i) => ['10 10', `Article ${i + 1}`, 'Essay', `https://example.com/article-${i}`]);
    if (sheet === 'SOUNDS') rows = Array.from({ length: 8 }, (_, i) => ['10 10', `Track ${i + 1}`, 'Artist', 'Amsterdam', 'Hidden', '03:42', `https://soundcloud.com/test/track-${i}`]);
    if (sheet === 'PROJECTS') rows = [['October', 'Project with image', photo(1), origin + '/projects/template-project/'], ['October', 'Project without image']];
    return route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify({ status: 'ok', table: { cols: columns, rows: rows.map(c => ({ c: c.map(v => ({ v })) })) } })});` });
  });
  await page.route('https://soundcloud.com/oembed*', route => route.fulfill({ json: {
    title: 'Track in motion', author_name: 'Collection artist', thumbnail_url: origin + '/assets/img/de_loods.jpg',
    html: '<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Ftest%2Ftrack-0"></iframe>'
  } }));
  await page.route('https://w.soundcloud.com/player/api.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.SC = { Widget: Object.assign(function (frame) { frame.testEvents = {}; return { bind: function (name, handler) { frame.testEvents[name] = handler; } }; }, { Events: { PLAY: 'play', PAUSE: 'pause', FINISH: 'finish' } }) };
  ` }));
  await page.route('https://w.soundcloud.com/player/?*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><body style="margin:0;background:white">Sound waveform<script>
    window.position = 42; window.playing = false;
    addEventListener('message', function (event) { try { var data = JSON.parse(event.data); if (data.method === 'play') playing = true; if (data.method === 'pause') playing = false; } catch (_) {} });
    setInterval(function () { if (playing) position += .1; }, 100);
  </script>` }));
  await page.route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="font:22px monospace;background:white">A website preview</body>' }));
  await page.route('**/slow-image*.jpg', async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return route.fulfill({ path: path.resolve(__dirname, '../assets/img/de_loods.jpg'), contentType: 'image/jpeg' });
  });
  await page.route('**/missing-image.jpg', route => route.fulfill({ status: 404, body: 'Missing' }));
}

async function ready(page) {
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('#collection-places .collection-row').nth(17).waitFor();
  await page.waitForFunction(() => document.querySelector('.collection-intro__image').naturalWidth > 0);
  await page.evaluate(() => CollectionWelcome.initialise(document.querySelector('[data-collection-welcome]')).enter());
  await page.evaluate(() => document.fonts.ready);
}

async function select(page, selector, index, touch) {
  const row = page.locator(selector).nth(index);
  await row.evaluate(element => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    const root = document.querySelector('[data-collection-welcome]');
    const end = (CollectionWelcome.snapshot(root)?.handoverEnd || 0) + root.getBoundingClientRect().top + scrollY;
    if (scrollY < end) scrollTo({ top: end, behavior: 'instant' });
  });
  if (!touch) await row.hover();
  else await page.waitForFunction(() => !document.getElementById('collection-media-window').hidden);
  return row;
}

async function inBounds(page) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    windows: [...document.querySelectorAll('#collection-media-window, #collection-image-window')]
      .filter(panel => !panel.hidden && panel.style.visibility !== 'hidden').map(panel => {
        const r = panel.getBoundingClientRect();
        return r.left >= 7 && r.top >= 7 && r.right <= innerWidth - 7 && r.bottom <= innerHeight - 7;
      })
  }));
  assert(!result.overflow, 'The page has no horizontal overflow');
  assert(result.windows.every(Boolean), 'Windows stay within viewport bounds');
}

const arrived = (page, path) => page.waitForFunction(path => document.body.dataset.collectionPage === path, path);
const scrollPhase = (page, amount) => page.evaluate(amount => {
  const root = document.querySelector('[data-collection-welcome]');
  scrollTo({ top: root.getBoundingClientRect().top + scrollY + CollectionWelcome.snapshot(root).handoverEnd * amount, behavior: 'instant' });
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}, amount);

async function scenario(browser, width) {
  const touch = width < 1000;
  const context = await browser.newContext({ viewport: { width, height: touch ? 844 : 900 }, isMobile: touch, hasTouch: touch });
  const page = await context.newPage();
  await fixtures(page);
  const bookings = [];
  await page.route('https://script.google.com/**', route => {
    bookings.push(JSON.parse(route.request().postData()));
    return route.fulfill({ contentType: 'text/plain', body: 'Saved by test fixture' });
  });
  const media = page.locator('#collection-media-window');
  const image = page.locator(touch ? '#collection-media-window' : '#collection-image-window');
  const closeImage = image.locator('.collection-media-window__close, .collection-image-window__close');
  try {
    await ready(page);
    assert.equal(await page.locator('.motion-lab, [data-motion-concept]').count(), 0, 'There are no study controls');
    if (!touch) {
      await select(page, '#collection-words .collection-row', 0, false);
      const frames = await image.evaluate(element => element.getAnimations()[0]?.effect.getKeyframes());
      assert(frames, 'The first preview has a reveal');
      near(parseFloat(frames[0].width) / parseFloat(frames.at(-1).width), 188 / 954, 'Reveal uses the welcome aperture', .001);
      assert.equal(await image.evaluate(element => getComputedStyle(element).borderTopWidth), '1px');
      await image.locator('iframe').waitFor();
      await settle(page);
      const key = await image.locator('.collection-image-window__content').getAttribute('data-media-key');
      await page.mouse.move(0, 0);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      assert(await image.isVisible(), 'Leaving a website row retains its preview');
      assert.equal(await image.locator('.collection-image-window__content').getAttribute('data-media-key'), key);
      await select(page, '#collection-words .collection-row', 1, false);
      assert.notEqual(await image.locator('.collection-image-window__content').getAttribute('data-media-key'), key);
      assert.equal(await image.evaluate(element => element.getAnimations().length), 0, 'The next row updates without another window reveal');
      const before = await rect(image);
      await image.locator('.collection-window__resize').focus();
      await image.locator('.collection-window__resize').press('ArrowRight');
      const resized = await rect(image);
      near(resized.width, Math.max(160, before.width + 16), 'Keyboard resize changes the actual window');
      await page.evaluate(() => { window.testPreview = document.querySelector('#collection-image-window'); });
      for (const selector of ['#collection-sounds', '#collection-places', '#collection-projects', '#collection-words']) {
        await select(page, selector + ' .collection-row', 0, false);
        assert(await page.evaluate(() => document.querySelector('#collection-image-window') === window.testPreview), 'Sections share the same connected preview frame');
        assert(await image.isVisible());
        assert.equal(await image.evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'Changing section keeps the frame open without a new reveal');
        assert.equal(await page.locator('.collection-window-proxy').count(), 0, 'Changing section has no window exit');
        const next = await rect(image);
        for (const key of ['x', 'y', 'width', 'height']) near(next[key], resized[key], 'Section changes retain ' + key);
        assert(!await media.isVisible(), 'Hover previews do not open the music player');
      }
    } else {
      await select(page, '#collection-words .collection-row', 4, true);
      await settle(page);
      const initial = await rect(image);
      for (const selector of ['#collection-sounds', '#collection-places', '#collection-projects', '#collection-words']) {
        await select(page, selector + ' .collection-row', selector === '#collection-words' ? 4 : 0, true);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert(await image.isVisible(), 'Mobile section changes keep the preview visible');
        assert.equal(await image.evaluate(element => element.getAnimations().length), 0, 'Mobile section changes have no new reveal');
        for (const key of ['x', 'y', 'width', 'height']) near((await rect(image))[key], initial[key], 'Mobile section changes retain ' + key);
      }
      await select(page, '#collection-projects .collection-row', 0, true);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const key = await media.locator('.collection-media-window__content').getAttribute('data-media-key');
      await select(page, '#collection-projects .collection-row', 1, true);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await image.isVisible(), 'A mobile row without media retains the open preview');
      assert.equal(await media.locator('.collection-media-window__content').getAttribute('data-media-key'), key);
    }
    await select(page, '#collection-places .collection-row', 1, touch);
    await settle(page);
    await select(page, '#collection-places .collection-row', 2, touch);
    assert.equal(await image.evaluate(element => element.getAnimations().length), 0, 'Image row changes retain the open frame');
    if (!touch) {
      const key = await image.locator('.collection-image-window__content').getAttribute('data-media-key');
      await page.mouse.move(0, 0);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      assert(await image.isVisible(), 'Leaving an image row retains its preview');
      await select(page, '#collection-projects .collection-row', 1, false);
      assert.equal(await image.locator('.collection-image-window__content').getAttribute('data-media-key'), key, 'Rows without media retain the previous image');
    }
    await closeImage.click();
    await page.locator('.collection-window-proxy').first().waitFor();
    await settle(page);
    if (touch) await page.locator('#collection-media-window-toggle').click();
    await select(page, '#collection-places .collection-row', 1, touch);
    await settle(page);
    const full = await rect(image);
    await scrollPhase(page, .95);
    const partial = await rect(image);
    assert(partial.width < full.width - 5, 'Reverse welcome contracts the entire window');
    await page.waitForTimeout(60);
    near((await rect(image)).width, partial.width, 'Scrolling controls the contraction directly');
    await scrollPhase(page, 0);
    assert(!await image.isVisible(), 'The transient preview hides at the top');
    await page.evaluate(() => CollectionWelcome.initialise(document.querySelector('[data-collection-welcome]')).enter());
    await select(page, '#collection-places .collection-row', 1, touch);
    await settle(page);

    // A real internal link contracts the transient window, then mounts the page.
    const project = page.locator('#collection-projects a').first();
    await project.scrollIntoViewIfNeeded();
    const savedScroll = await page.evaluate(() => scrollY);
    await project.click();
    await page.locator('.collection-window-proxy').first().waitFor();
    await arrived(page, '/projects/template-project/');
    assert.equal(new URL(page.url()).pathname, '/projects/template-project/');
    assert(await page.locator('.collection-route-outlet .project-page').isVisible());
    await page.locator('.project-back-link').click();
    await arrived(page, '/');
    near(await page.evaluate(() => scrollY), savedScroll, 'Back to collection restores its reading position');
    await settle(page);

    const sound = await select(page, '#collection-sounds .collection-row', 0, touch);
    await sound.click({ position: { x: (await sound.boundingBox()).width - 8, y: 8 } });
    await media.locator('iframe').waitFor();
    await settle(page);
    await page.evaluate(() => { window.testPlayer = document.querySelector('#collection-media-window iframe'); });
    let frame = await media.locator('iframe').elementHandle().then(element => element.contentFrame());
    await frame.waitForFunction(() => playing);
    if (!touch) {
      const previewBounds = await rect(image);
      for (const selector of ['#collection-words', '#collection-places', '#collection-projects']) {
        await select(page, selector + ' .collection-row', 0, false);
        assert.equal(await image.evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'Section changes retain the open preview alongside audio');
        for (const key of ['x', 'y', 'width', 'height']) near((await rect(image))[key], previewBounds[key], 'The separate preview retains ' + key);
        assert(await page.evaluate(() => document.querySelector('#collection-media-window iframe') === window.testPlayer));
        assert(await frame.evaluate(() => playing), 'Section changes leave music playing');
      }
    }
    const playerBounds = await rect(media);
    await scrollPhase(page, 0);
    for (const key of ['x', 'y', 'width', 'height']) near((await rect(media))[key], playerBounds[key], 'Playing window retains ' + key + ' at the top');
    const samePlayer = async () => {
      assert(await page.evaluate(() => document.querySelector('#collection-media-window iframe') === window.testPlayer), 'Navigation retains the connected audio iframe');
      assert(await media.isVisible(), 'The player window remains open');
      await inBounds(page);
    };
    const position = await frame.evaluate(() => position);
    await page.evaluate(() => CollectionNavigation.navigate('/projects/template-project/'));
    await arrived(page, '/projects/template-project/');
    await samePlayer();
    await frame.waitForFunction(start => playing && position > start, position);
    await page.goBack();
    await arrived(page, '/');
    await samePlayer();
    await page.goForward();
    await arrived(page, '/projects/template-project/');
    await samePlayer();
    await media.locator('.collection-soundcloud-control').click();
    await frame.waitForFunction(() => !playing);
    await page.locator('.project-back-link').click();
    await arrived(page, '/');
    await page.locator('.collection-invite').first().click();
    await arrived(page, '/invites/?event=collection-evening');
    await page.locator('.invite-details-form').waitFor();
    await samePlayer();
    assert.equal(await frame.evaluate(() => playing), false, 'A paused track stays paused during navigation');
    await media.locator('.collection-soundcloud-control').click();
    await media.locator('.collection-media-window__minimize').click();
    await settle(page);
    const compact = await rect(media);
    const form = page.locator('.collection-route-outlet');
    await form.locator('[data-action=plus]').first().click();
    await form.locator('[name=firstName]').fill('Local');
    await form.locator('[name=lastName]').fill('Check');
    await form.locator('[name=email]').fill('local@example.com');
    await form.locator('[type=submit]').click();
    await arrived(page, '/tickets/overview/');
    await samePlayer();
    near((await rect(media)).height, compact.height, 'The compact player persists through reservations');
    await page.evaluate(() => CollectionNavigation.navigate('/tickets/details/'));
    await arrived(page, '/tickets/details/');
    await samePlayer();
    assert.equal(await form.locator('[name=firstName]').inputValue(), 'Local');
    await form.locator('[type=submit]').click();
    await arrived(page, '/tickets/overview/');
    await form.getByText('Change details', { exact: true }).click();
    await arrived(page, '/invites/?event=collection-evening#invite-reservation-title');
    await form.locator('[name=firstName]').waitFor();
    assert.equal(await form.locator('[name=firstName]').inputValue(), 'Local', 'Returning to the invite restores the draft');
    assert.equal(await form.locator('[data-count]').first().textContent(), '1');
    assert(await form.locator('#invite-reservation-title').evaluate(element => element.getBoundingClientRect().top >= -1 && element.getBoundingClientRect().top < innerHeight), 'Returning to details scrolls to the restored form');
    await form.locator('[type=submit]').click();
    await arrived(page, '/tickets/overview/');
    await page.locator('[data-place-order]').click();
    await arrived(page, '/tickets/confirmation/');
    await samePlayer();
    await page.waitForFunction(() => document.querySelector('[data-sync]').textContent.includes('Reservation saved'));
    assert.equal(bookings.length, 1, 'Exactly one reservation reaches the stub endpoint');
    assert(bookings[0].orderId.startsWith('ORD-'), 'The production reservation flow is active');
    assert(await page.evaluate(() => sessionStorage.getItem('tz_confirmed')?.includes('Local')));
    await page.goBack();
    await arrived(page, '/tickets/overview/');
    await page.goForward();
    await arrived(page, '/tickets/confirmation/');
    assert.equal(bookings.length, 1, 'History navigation does not submit the same reservation twice');
    assert(await frame.evaluate(() => playing && position > 42));
    await page.screenshot({ path: path.join(output, width + '-persistent-tickets.png') });

    await page.evaluate(() => CollectionNavigation.navigate('/projects/does-not-exist/'));
    assert.match(await page.locator('.collection-navigation-status').innerText(), /couldn.t load/);
    await samePlayer();
    await page.evaluate(() => Promise.all([CollectionNavigation.navigate('/projects/template-project/'), CollectionNavigation.navigate('/invites/?event=collection-evening')]));
    await arrived(page, '/invites/?event=collection-evening');
    await samePlayer();
    await page.waitForFunction(() => window.testPlayer.testEvents?.finish);
    await page.evaluate(() => window.testPlayer.testEvents.finish());
    await page.waitForFunction(() => document.querySelector('#collection-media-window .collection-media-window__content').dataset.mediaKey.includes('track-1'));
    await media.locator('iframe').waitFor();
    frame = await media.locator('iframe').elementHandle().then(element => element.contentFrame());
    await frame.waitForFunction(() => playing);
    assert.equal(await page.locator('.collection-media__frame--soundcloud').count(), 1, 'The playlist advances with one live player');
    await inBounds(page);
    console.log('PASS: ' + width + 'px - reveal, retained previews, welcome, real routes, audio, history, booking and queue');
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure-' + width + '.png') });
    console.error(await page.evaluate(() => ({ path: location.href, current: document.body.dataset.collectionPage, status: document.querySelector('.collection-navigation-status')?.textContent })));
    throw error;
  } finally { await context.close(); }
}

async function directEntries(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await fixtures(page);
  await page.goto(origin + '/projects/template-project/');
  assert(await page.locator('.project-page').isVisible());
  assert.equal(await page.locator('#collection-places .collection-row').count(), 0, 'Direct detail pages defer collection feeds');
  await page.locator('.project-back-link').click();
  await arrived(page, '/');
  await page.locator('#collection-places .collection-row').nth(17).waitFor();
  assert(await page.locator('[data-collection-welcome]').isVisible());
  assert(await page.evaluate(() => CollectionWelcome.snapshot(document.querySelector('[data-collection-welcome]')).openingComplete), 'Entering the collection from a detail page skips the initial autoplay');
  await page.goto(origin + '/invites/?event=collection-evening');
  await page.locator('.invite-details-form').waitFor();
  assert.equal(await page.locator('.invite-details-form').count(), 1, 'Direct invites mount once');
  await page.goto(origin + '/tickets/overview/');
  assert.match(await page.locator('.ticket-status').innerText(), /Nothing to review/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await select(page, '#collection-places .collection-row', 1, true);
  await select(page, '#collection-places .collection-row', 2, true);
  assert.equal(await page.locator('#collection-media-window').evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'Reduced motion uses no window animations');
  const response = await page.request.get(origin + '/motion-study/');
  assert.equal(response.status(), 404, 'The animation preview page is removed');
  await context.close();
  const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const plainPage = await plain.newPage();
  await plainPage.goto(origin + '/');
  assert(await plainPage.locator('[data-collection-welcome]').isVisible());
  await plainPage.goto(origin + '/projects/template-project/');
  assert(await plainPage.locator('.project-page').isVisible());
  assert(!await plainPage.locator('[data-collection-welcome]').isVisible());
  await plain.close();
  console.log('PASS: direct page entry, deferred feeds, reduced motion, no JavaScript and removed study page');
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: await executable(), headless: true });
  try {
    const widths = (process.env.COLLECTION_WIDTHS || '1440,768,390,320').split(',').map(Number);
    for (const width of widths) await scenario(browser, width);
    await directEntries(browser);
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: all collection window checks. Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

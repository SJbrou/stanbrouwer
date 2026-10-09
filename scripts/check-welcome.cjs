// Run against a built preview. Uses the same browser overrides as the project checks.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (_) { playwright = require('../docs/design-exploration/browser-check/node_modules/playwright-core'); }
const address = process.env.PROJECT_PREVIEW_URL || 'http://127.0.0.1:4000';
const artifacts = path.resolve(__dirname, '../docs/welcome-check');
const near = (actual, expected, label, tolerance = 1) =>
  assert(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' vs ' + expected);
const read = page => page.evaluate(() => {
  const root = document.querySelector('[data-collection-welcome]');
  const find = selector => root.querySelector(selector);
  const box = selector => find(selector).getBoundingClientRect().toJSON();
  return {
    state: find('.collection-intro').dataset.welcomeState, scroll: scrollY,
    snapshot: window.CollectionWelcome?.snapshot(root),
    maxScroll: document.documentElement.scrollHeight - innerHeight,
    frame: box('.collection-welcome-frame rect'), copy: box('.collection-perspective-copy'),
    image: box('.collection-intro__image'), poster: box('.collection-poster'),
    gridClip: getComputedStyle(find('.collection-intro__image')).clipPath,
    stroke: Number(find('.collection-welcome-frame rect').getAttribute('stroke-width')),
    frameOpacity: getComputedStyle(find('.collection-welcome-frame')).opacity,
    artworkOpacity: getComputedStyle(find('.collection-intro__artwork')).opacity,
    copyOpacity: getComputedStyle(find('.collection-perspective-copy')).opacity,
    clip: getComputedStyle(find('.collection-poster')).clipPath,
    posterOpacity: getComputedStyle(find('.collection-poster')).opacity,
    posterPointer: getComputedStyle(find('.collection-poster')).pointerEvents,
    posterMinimum: parseFloat(getComputedStyle(find('.collection-poster')).minHeight),
    invites: find('#invites-title')?.getBoundingClientRect().toJSON(),
    border: getComputedStyle(find('.collection-poster')).borderLeftColor,
    overflow: document.documentElement.scrollWidth > innerWidth,
    saved: history.state?.collectionView
  };
});
const scroll = async (page, y) => {
  await page.evaluate(y => scrollTo(0, y), y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  const browser = await playwright.chromium.launch({
    headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  const errors = [];
  const open = async (options = {}, configure) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.route('https://docs.google.com/**', route => {
      const url = new URL(route.request().url());
      const callback = url.searchParams.get('tqx')?.match(/responseHandler:([^;]+)/)?.[1];
      if (!callback) return route.abort();
      const projects = url.searchParams.get('sheet') === 'PROJECTS';
      const values = ['October', 'Welcome test project', 'Design', '', '', 'A project for navigation checks.'];
      const table = projects ? {
        cols: 'ABCDEF'.split('').map(id => ({ id, label: '', type: 'string' })),
        rows: [{ c: values.map(v => v ? { v } : null) }]
      } : { cols: [], rows: [] };
      return route.fulfill({ contentType: 'application/javascript',
        body: callback + '(' + JSON.stringify({ status: 'ok', table }) + ')' });
    });
    if (configure) await configure(page);
    await page.goto(address + '/', { waitUntil: 'domcontentloaded' });
    return { page, context };
  };
  const ready = page => page.waitForFunction(() =>
    document.querySelector('.collection-intro')?.dataset.welcomeState === 'ready');
  try {
    // Turn around while reading the first visible collection, before scrolling
    // beyond the entrance. This must already reverse the panel and grid.
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const { page, context } = await open({ viewport });
      await ready(page);
      const initial = await read(page);
      const end = initial.snapshot.handoverEnd;
      for (const position of [.3, .4, .5]) {
        await scroll(page, end * position);
      }
      const firstHalf = await read(page);
      await scroll(page, end * .4);
      const firstMiddle = await read(page);
      await scroll(page, end * .3);
      const firstEarly = await read(page);
      for (const key of ['x', 'y', 'width', 'height']) {
        near((firstHalf.frame[key] - firstMiddle.frame[key]) / (firstHalf.scroll - firstMiddle.scroll),
          (firstMiddle.frame[key] - firstEarly.frame[key]) / (firstMiddle.scroll - firstEarly.scroll),
          'First handover follows scroll evenly: ' + key, .02);
      }
      await scroll(page, end * .899);
      const beforeReveal = await read(page);
      await scroll(page, end * .901);
      const afterReveal = await read(page);
      assert(afterReveal.snapshot.reversible, 'The reveal boundary immediately enables full reversal');
      for (const key of ['x', 'y', 'width', 'height']) near(afterReveal.frame[key], beforeReveal.frame[key], 'No frame jump when reversal activates: ' + key, 1);
      const fade = [];
      for (const position of [.92, .94, .96]) {
        await scroll(page, end * position);
        fade.push(await read(page));
      }
      near((Number(fade[1].posterOpacity) - Number(fade[0].posterOpacity)) / (fade[1].scroll - fade[0].scroll),
        (Number(fade[2].posterOpacity) - Number(fade[1].posterOpacity)) / (fade[2].scroll - fade[1].scroll),
        'Reading crossfade follows scroll evenly', .001);
      await scroll(page, end * .94);
      const reading = await read(page);
      assert(reading.scroll < end && Number(reading.posterOpacity) > 0,
        'Read the collection before reaching the end of the entrance');
      assert(reading.snapshot.reversible, 'Enable reversal as soon as the collection appears');
      await page.screenshot({ path: path.join(artifacts, 'partial-reading-' + viewport.width + '.png') });
      const positions = [.94, .75, .3, .05, 0];
      const states = ['handover', 'handover', 'clearing', 'building', 'building'];
      const returning = [reading];
      await page.mouse.move(10, 10);
      for (let index = 1; index < positions.length; index++) {
        const target = Math.round(end * positions[index]);
        await page.mouse.wheel(0, target - (await read(page)).scroll);
        await page.waitForFunction(y => Math.abs(scrollY - y) <= 1, target);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const sample = await read(page);
        assert.equal(sample.state, states[index], 'Partial first visit reverses the entire entrance');
        if (positions[index] === .3) await page.screenshot({ path: path.join(artifacts, 'partial-reverse-panel-' + viewport.width + '.png') });
        returning.push(sample);
        await page.waitForTimeout(120);
        const paused = await read(page);
        for (const key of ['x', 'y', 'width', 'height']) near(paused.frame[key], sample.frame[key], 'Reverse stops with scrolling: ' + key, .1);
      }
      const closed = returning.at(-1);
      near(closed.frame.width + closed.stroke, closed.image.width * 188 / 954, 'Reverse returns to the rear opening');
      // Subsequent downward movement retraces exactly the same frames and fade.
      for (const sample of returning.slice().reverse()) {
        await scroll(page, sample.scroll);
        const forward = await read(page);
        for (const key of ['x', 'y', 'width', 'height']) near(forward.frame[key], sample.frame[key], 'Retrace partial-reading reversal: ' + key, .1);
        near(Number(forward.posterOpacity), Number(sample.posterOpacity), 'Retrace the reading fade', .01);
      }
      await page.reload({ waitUntil: 'networkidle' });
      const restored = await read(page);
      assert(restored.snapshot.reversible, 'A reload retains reversal before the end of the entrance');
      near(restored.scroll, reading.scroll, 'A reload keeps the partial reading position');
      await scroll(page, 0);
      assert.equal((await read(page)).state, 'building', 'Partial reading can reverse after a reload');
      await context.close();
      console.log('PASS: reverse before the entrance endpoint, linear scroll and partial-reading reload at ' + viewport.width);
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      const { page, context } = await open({ viewport });
      await ready(page);
      const initial = await read(page);
      near(initial.scroll, 0, 'Autoplay must not scroll');
      assert(initial.snapshot.openingComplete);
      assert(initial.saved.homeWelcome.openingComplete, 'Save completion even without a scroll event');
      assert(initial.snapshot.handoverEnd >= 360 && initial.snapshot.handoverEnd <= 720);
      near(initial.snapshot.handoverEnd, Math.max(360, Math.min(720, viewport.height * .75)), 'Three-quarter viewport range');
      await page.screenshot({ path: path.join(artifacts, 'ready-' + viewport.width + '.png') });
      await scroll(page, initial.snapshot.handoverEnd * .25);
      const before = await read(page);
      await page.evaluate(() => {
        const late = document.createElement('div');
        late.id = 'late-welcome-content';
        late.style.height = '1800px';
        document.querySelector('#collection-words').append(late);
      });
      await page.waitForTimeout(80);
      const after = await read(page);
      for (const key of ['x', 'y', 'width', 'height']) {
        near(after.frame[key], before.frame[key], 'Late content must not move frame ' + key, .1);
      }
      near(after.scroll, before.scroll, 'Late content must not scroll');
      assert(after.poster.height > before.poster.height + 1000);
      await page.screenshot({ path: path.join(artifacts, 'handover-' + viewport.width + '.png') });
      await page.evaluate(() => document.querySelector('#late-welcome-content').remove());
      // Collection text must only appear inside an already finished frame.
      for (const position of [.25, .5, .79, .81, .89, .9, .98]) {
        await scroll(page, initial.snapshot.handoverEnd * position);
        const sample = await read(page);
        if (position < .9) {
          assert.equal(Number(sample.posterOpacity), 0, 'Hide collection during frame resizing');
          assert.equal(sample.posterPointer, 'none', 'Hidden collection cannot intercept pointer input');
          near(Number(sample.copyOpacity), 1, 'Keep PERSPECTIVE visible until the crossfade', .01);
        } else {
          near(sample.frame.x - sample.stroke / 2, sample.poster.x, 'Reveal at final frame position');
          near(sample.frame.width + sample.stroke, sample.poster.width, 'Reveal at final frame width');
          near(sample.frame.height + sample.stroke, sample.posterMinimum, 'Reveal at final frame height');
          assert(sample.invites.x >= sample.frame.x && sample.invites.right <= sample.frame.right,
            'INVITES stays inside the revealed frame');
        }
      }
      await scroll(page, initial.snapshot.handoverEnd * .5);
      const half = await read(page);
      near(half.copy.width, initial.copy.width, 'Type must not stretch during handover');
      near(half.copy.height, initial.copy.height, 'Type must not stretch vertically');
      // Begin with real content in view, then return using wheel input rather
      // than starting a new page-load animation or only jumping to the top.
      await scroll(page, Math.min(half.maxScroll, initial.snapshot.handoverEnd + viewport.height * .5));
      const reading = await read(page);
      assert(reading.scroll > initial.snapshot.handoverEnd && reading.state === 'complete');
      await page.mouse.move(10, 10);
      for (const [position, expected] of [[.75, 'handover'], [.3, 'clearing']]) {
        const target = initial.snapshot.handoverEnd * position;
        await page.mouse.wheel(0, target - (await read(page)).scroll);
        await page.waitForFunction(y => Math.abs(scrollY - y) <= 1, target);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const returned = await read(page);
        assert.equal(returned.state, expected, 'Return from reading reaches the expected scroll stage');
        await page.waitForTimeout(150);
        const paused = await read(page);
        for (const key of ['x', 'y', 'width', 'height']) near(paused.frame[key], returned.frame[key], 'Wheel pause freezes the frame: ' + key, .1);
        await page.screenshot({ path: path.join(artifacts, `return-${expected}-${viewport.width}.png`) });
      }
      // The endpoint must be reachable even if the feed is shorter than a viewport.
      await page.evaluate(() => document.querySelector('.collection-poster').replaceChildren());
      await page.waitForTimeout(60);
      assert((await read(page)).maxScroll >= Math.floor(initial.snapshot.handoverEnd));
      await scroll(page, initial.snapshot.handoverEnd - 1);
      const last = await read(page);
      near(last.frame.x - last.stroke / 2, last.poster.x, 'Joined left border');
      near(last.frame.width + last.stroke, last.poster.width, 'Joined width');
      await scroll(page, Math.ceil(initial.snapshot.handoverEnd));
      const complete = await read(page);
      assert.equal(complete.state, 'complete');
      assert.equal(complete.clip, 'none');
      assert.equal(complete.frameOpacity, '0');
      assert.equal(complete.border, 'rgb(0, 0, 0)');
      assert(!complete.overflow);
      await scroll(page, 0);
      const reversed = await read(page);
      assert.equal(reversed.state, 'building', 'Reverse all the way to the perspective opening');
      assert(reversed.snapshot.openingComplete && reversed.snapshot.reversible,
        'Keep the first autoplay completed while enabling scroll reversal');
      near(reversed.frame.x - reversed.stroke / 2, reversed.image.x + reversed.image.width * 98 / 954,
        'Closed frame follows the original horizontal perspective ray');
      near(reversed.frame.y - reversed.stroke / 2, reversed.image.y + reversed.image.height * 654 / 953,
        'Closed frame follows the original vertical perspective ray');
      near(reversed.copy.width, reversed.image.width * 188 / 954, 'Type contracts with the opening');
      await page.screenshot({ path: path.join(artifacts, 'reversed-' + viewport.width + '.png') });
      // Both directions use identical geometry, including the opening and its
      // join to the existing handover. Reversing input never starts a timer.
      const samples = [];
      for (const progress of [.04, .3, .099, .101, .499, .501, .75]) {
        await scroll(page, initial.snapshot.handoverEnd * progress);
        samples.push(await read(page));
      }
      assert.equal(samples[1].state, 'clearing', 'Scrolling down reopens the perspective panel');
      assert.equal(samples[6].state, 'handover');
      for (const [beforeJoin, afterJoin] of [[2, 3], [4, 5]]) {
        for (const key of ['x', 'y', 'width', 'height']) {
          near(samples[beforeJoin].frame[key], samples[afterJoin].frame[key], 'Soft stage join: ' + key, 1);
        }
      }
      for (let index = samples.length - 1; index >= 0; index--) {
        await scroll(page, samples[index].scroll);
        const returning = await read(page);
        for (const key of ['x', 'y', 'width', 'height']) {
          near(returning.frame[key], samples[index].frame[key], 'Same frame in either direction: ' + key, .1);
          near(returning.copy[key], samples[index].copy[key], 'Same type in either direction: ' + key, .1);
        }
        near(Number(returning.posterOpacity), Number(samples[index].posterOpacity), 'Same content opacity', .01);
      }
      for (const position of [.99, .94, .91, .89, .85]) {
        await scroll(page, initial.snapshot.handoverEnd * position);
        const sample = await read(page);
        if (position > .9) {
          assert(Number(sample.posterOpacity) > 0, 'Reverse crossfade reveals the collection');
          near(sample.frame.width + sample.stroke, sample.poster.width, 'Reverse fades before contracting');
          near(sample.frame.height + sample.stroke, sample.posterMinimum, 'Reverse frame height is already finished');
        } else assert.equal(Number(sample.posterOpacity), 0, 'Reverse hides collection before contraction');
      }
      // The middle of each stage stays linear; only its joins ease gently.
      // Pausing the scroll must pause the animation, including grid cropping.
      for (const positions of [[.07, .05, .03], [.38, .3, .22], [.85, .75, .65]]) {
        const motion = [];
        for (const position of positions) {
          await scroll(page, initial.snapshot.handoverEnd * position);
          motion.push(await read(page));
        }
        for (const key of ['x', 'y', 'width', 'height']) {
          const firstRate = (motion[1].frame[key] - motion[0].frame[key]) / (motion[1].scroll - motion[0].scroll);
          const secondRate = (motion[2].frame[key] - motion[1].frame[key]) / (motion[2].scroll - motion[1].scroll);
          near(firstRate, secondRate, 'Moving edge stays in line with scroll: ' + key, .02);
        }
        if (motion[0].state === 'building') {
          const clips = motion.map(sample => sample.gridClip.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number));
          assert.notDeepEqual(clips[0], clips[1], 'The grid crop moves with scroll');
          for (let edge = 0; edge < 4; edge++) {
            const firstRate = (clips[1][edge] - clips[0][edge]) / (motion[1].scroll - motion[0].scroll);
            const secondRate = (clips[2][edge] - clips[1][edge]) / (motion[2].scroll - motion[1].scroll);
            near(firstRate, secondRate, 'Grid crop stays in line with scroll', .01);
          }
        }
        await page.waitForTimeout(150);
        const paused = await read(page);
        for (const key of ['x', 'y', 'width', 'height']) {
          near(paused.frame[key], motion[2].frame[key], 'Paused scroll freezes frame: ' + key, .1);
        }
        assert.equal(paused.gridClip, motion[2].gridClip, 'Paused scroll freezes the grid crop');
      }
      await context.close();
      console.log('PASS: stable frame, short content, border handoff, reverse scroll at ' + viewport.width);
    }

    // Sample the moving panel against its border on actual animation frames.
    {
      const { page, context } = await open({}, async page => {
        await page.addInitScript(() => {
          window.welcomeSamples = [];
          const sample = () => {
            const intro = document.querySelector('.collection-intro');
            const outline = document.querySelector('.collection-welcome-frame rect');
            if (outline && ['building', 'clearing'].includes(intro.dataset.welcomeState)) {
              const a = outline.getBoundingClientRect();
              const b = document.querySelector('.collection-perspective-copy').getBoundingClientRect();
              const image = document.querySelector('.collection-intro__image').getBoundingClientRect();
              const clip = getComputedStyle(document.querySelector('.collection-intro__artwork'), '::after').clipPath;
              window.welcomeSamples.push({ state: intro.dataset.welcomeState,
                error: Math.max(Math.abs(a.x - .5 - b.x), Math.abs(a.y - .5 - b.y),
                  Math.abs(a.width + 1 - b.width), Math.abs(a.height + 1 - b.height)),
                x: b.x - image.x, y: b.y - image.y, width: b.width, height: b.height,
                imageWidth: image.width, imageHeight: image.height, clip, scroll: scrollY });
            }
            if (performance.now() < 8000) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
      });
      await ready(page);
      const samples = await page.evaluate(() => window.welcomeSamples);
      assert(samples.some(s => s.state === 'building'));
      assert(samples.some(s => s.state === 'clearing'));
      for (const sample of samples) {
        assert(sample.error < 1, 'White panel and outline must share all four edges');
        near(sample.scroll, 0, 'Opening scroll');
        const sx = sample.width / sample.imageWidth;
        const sy = sample.height / sample.imageHeight;
        near(sample.x / sample.imageWidth, (98 / (954 - 188)) * (1 - sx), 'Horizontal perspective ray', .001);
        near(sample.y / sample.imageHeight, (654 / (953 - 188)) * (1 - sy), 'Vertical perspective ray', .001);
        assert(sample.clip.startsWith('inset('));
      }
      await context.close();
      console.log('PASS: white panel, typography, outline and perspective rays stay aligned');
    }

    for (const action of ['click', 'wheel', 'touch', 'keyboard', 'scroll', 'background']) {
      const { page, context } = await open({ hasTouch: true });
      await page.waitForFunction(() => ['building', 'clearing'].includes(document.querySelector('.collection-intro')?.dataset.welcomeState));
      if (action === 'click') await page.mouse.click(20, 20);
      if (action === 'wheel') await page.mouse.wheel(0, 50);
      if (action === 'touch') await page.touchscreen.tap(20, 20);
      if (action === 'keyboard') await page.keyboard.press('Escape');
      if (action === 'scroll') await scroll(page, 50);
      if (action === 'background') await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(80);
      const finished = await read(page);
      assert(finished.snapshot.openingComplete, action + ' must finish the entrance');
      assert(['ready', 'handover', 'complete'].includes(finished.state));
      await page.waitForTimeout(250);
      near((await read(page)).scroll, finished.scroll, 'No autoplay scroll after ' + action);
      await context.close();
      console.log('PASS: interrupt with ' + action);
    }

    for (const scenario of ['reduced', 'motion-change', 'missing-image', 'slow-image', 'missing-script', 'no-js']) {
      const { page, context } = await open({
        ...(scenario === 'reduced' ? { reducedMotion: 'reduce' } : {}),
        ...(scenario === 'no-js' ? { javaScriptEnabled: false } : {})
      }, async page => {
        if (scenario === 'missing-image') await page.route('**/header-image.jpg', route => route.abort());
        if (scenario === 'slow-image') await page.route('**/header-image.jpg', async route => {
          await new Promise(resolve => setTimeout(resolve, 1500));
          await route.abort().catch(() => {});
        });
        if (scenario === 'missing-script') await page.route('**/collection-welcome.js*', route => route.abort());
      });
      if (scenario === 'motion-change') await page.emulateMedia({ reducedMotion: 'reduce' });
      if (!['no-js', 'missing-script'].includes(scenario)) {
        await page.waitForFunction(() => document.querySelector('.collection-intro').dataset.welcomeState === 'static');
        const state = await read(page);
        assert.equal(state.artworkOpacity, '1');
        assert.equal(state.copyOpacity, '1');
        assert.equal(state.clip, 'none');
        assert.equal(state.posterOpacity, '1');
      } else {
        assert.equal(await page.locator('[data-collection-welcome] .collection-poster').evaluate(node => getComputedStyle(node).opacity), '1');
        assert.equal(await page.locator('.collection-intro__image').evaluate(node => getComputedStyle(node).opacity), '1');
      }
      await context.close();
      console.log('PASS: static fallback for ' + scenario);
    }

    {
      const { page, context } = await open();
      await ready(page);
      const original = await read(page);
      await scroll(page, original.snapshot.handoverEnd * .5);
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(100);
      const rotated = await read(page);
      near(rotated.scroll / rotated.snapshot.handoverEnd, .5, 'Resize retains handover progress', .01);
      assert(!rotated.overflow);
      const maps = await page.evaluate(() => {
        const root = document.querySelector('[data-collection-welcome]');
        const old = { version: 1, leadIn: 900, handoverStart: 900, handoverEnd: 2700 };
        return [450, 1800, 2900].map(y => CollectionWelcome.scrollFor(root, y, old));
      });
      near(maps[0], 0, 'Legacy intro scroll');
      near(maps[1], rotated.snapshot.handoverEnd / 2, 'Legacy handover scroll');
      near(maps[2], rotated.snapshot.handoverEnd + 200, 'Legacy content scroll');
      await scroll(page, 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.evaluate(() => CollectionWelcome.autoplayOnLoad), false, 'Reload must not replay completed opening');
      await ready(page);
      const link = page.locator('[data-collection-project="welcome-test-project"]');
      await link.waitFor();
      await link.focus();
      assert.equal((await read(page)).state, 'complete', 'Keyboard focus exposes the collection');
      const departure = (await read(page)).scroll;
      await link.click();
      await page.waitForURL('**/projects/?project=welcome-test-project');
      await page.waitForFunction(() => !document.body.classList.contains('is-collection-navigating'));
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.body.classList.contains('is-collection-navigating')
        && !document.querySelector('[data-collection-welcome]').hidden);
      await page.waitForTimeout(100);
      assert.equal((await read(page)).snapshot.openingComplete, true);
      near((await read(page)).scroll, departure, 'Back restores content position', 2);
      await scroll(page, 0);
      const closed = await read(page);
      assert.equal(closed.state, 'building', 'Return from a project retains the reverse entrance');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.collection-intro')?.dataset.welcomeState === 'building');
      assert.equal(await page.evaluate(() => CollectionWelcome.autoplayOnLoad), false);
      await page.waitForTimeout(200);
      const reloaded = await read(page);
      assert(reloaded.snapshot.reversible, 'Reload restores the scroll-controlled entrance');
      near(reloaded.copy.width, closed.copy.width, 'Reload must not reopen a closed entrance');
      await page.mouse.move(10, 10);
      await page.mouse.wheel(0, reloaded.snapshot.handoverEnd - reloaded.scroll);
      await page.waitForFunction(end => Math.abs(scrollY - end) <= 1, reloaded.snapshot.handoverEnd);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal((await read(page)).state, 'complete', 'Scroll down after reload reveals the collection');
      await scroll(page, reloaded.snapshot.handoverEnd * .3);
      const beforeReturnResize = await read(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(100);
      const afterReturnResize = await read(page);
      assert.equal(afterReturnResize.state, 'clearing');
      near(afterReturnResize.scroll / afterReturnResize.snapshot.handoverEnd, .3, 'Resize retains the return stage', .005);
      near(afterReturnResize.copy.width / afterReturnResize.image.width,
        beforeReturnResize.copy.width / beforeReturnResize.image.width, 'Resize retains the panel contraction', .005);
      await context.close();
      console.log('PASS: resize, legacy history, reload, keyboard and project round trip');
    }
    // Stored v2 positions from the old 45svh range keep their relative welcome
    // position or their distance into the reading view with the longer range.
    for (const savedScroll of [202.5, 655]) {
      const { page, context } = await open({}, async page => {
        await page.addInitScript(savedScroll => {
          history.replaceState({ collectionView: { scroll: savedScroll, homeScroll: savedScroll,
            homeWelcome: { version: 2, leadIn: 0, openingComplete: true, reversible: true,
              handoverStart: 0, handoverEnd: 405, handoverExtra: 0 } } }, '');
        }, savedScroll);
      });
      await page.waitForFunction(savedScroll => {
        const root = document.querySelector('[data-collection-welcome]');
        const end = window.CollectionWelcome?.snapshot(root)?.handoverEnd;
        const expected = savedScroll < 405 ? end * savedScroll / 405 : end + savedScroll - 405;
        return end > 0 && Math.abs(scrollY - expected) <= 1;
      }, savedScroll);
      const restored = await read(page);
      assert(restored.snapshot.reversible && restored.snapshot.version === 2);
      assert.equal(await page.evaluate(() => CollectionWelcome.autoplayOnLoad), false);
      if (savedScroll > 405) assert.equal(restored.state, 'complete', 'Restore the same reading offset');
      await context.close();
    }
    console.log('PASS: saved v2 welcome and reading positions adapt to the longer range');
    assert.deepEqual(errors, [], 'No browser exceptions');
    console.log('PASS: welcome acceptance checks');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

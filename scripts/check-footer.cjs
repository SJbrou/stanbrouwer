// Footer geometry and visibility through the existing page transitions.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { attachMocks, address } = require('./check-invites.cjs');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (_) { playwright = require('../docs/design-exploration/browser-check/node_modules/playwright-core'); }
const artifacts = path.resolve(__dirname, '../docs/footer-check');
const grid = '**/black-white-perspective-grid-background-vector.jpg';
const near = (a, b, label) => assert(Math.abs(a - b) < 1, `${label}: ${a} vs ${b}`);
const settled = page => page.waitForFunction(() => !document.querySelector('.collection-route')
  && !document.body.classList.contains('is-collection-navigating'));
const geometry = page => page.locator('main:not([hidden]) > .collection-outro').evaluate(footer => {
  const image = footer.querySelector('img'), rect = image.getBoundingClientRect();
  const paper = footer.parentElement.querySelector('.collection-poster').getBoundingClientRect();
  return { y: rect.y + scrollY, width: rect.width, height: rect.height,
    paperBottom: paper.bottom + scrollY, overlap: paper.bottom - rect.top,
    bottom: rect.bottom, position: getComputedStyle(footer).position, style: footer.getAttribute('style') };
});
const scroll = async (page, visibility) => {
  await page.evaluate(visibility => {
    const image = document.querySelector('[data-collection-welcome] > .collection-outro img');
    const top = image.getBoundingClientRect().top + scrollY;
    scrollTo(0, visibility === 'hidden' ? window.CollectionWelcome?.snapshot(image.closest('main'))?.handoverEnd || 1
      : visibility === 'partial' ? top - innerHeight + 80 : document.documentElement.scrollHeight);
  }, visibility);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
async function observe(page, selector) {
  return page.evaluate(selector => {
    const image = document.querySelector('main:not([hidden]) > .collection-outro img');
    window.footerOriginal = image;
    window.footerParent = image.parentElement;
    window.footerFrames = [];
    window.footerDone = false;
    const original = { ...image.getBoundingClientRect().toJSON(), scroll: scrollY,
      paneScroll: image.closest('main').querySelector('.booking-content')?.scrollTop,
      paperBottom: image.closest('main').querySelector('.collection-poster').getBoundingClientRect().bottom };
    const sample = () => {
      const overlay = document.querySelector('.collection-route');
      if (overlay) {
        const layer = overlay.querySelector('.collection-route__floor');
        const copy = layer?.querySelector('img');
        if (copy && !window.footerCopy) window.footerCopy = copy;
        const paper = overlay.querySelector('.collection-route__paper');
        const paperClip = getComputedStyle(paper).clipPath;
        const values = paperClip.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number);
        let frameError = 0;
        if (overlay.classList.contains('collection-route--fixed') && values) {
          const [top, right = top, bottom = top, left = right] = values;
          const box = paper.getBoundingClientRect();
          const outline = overlay.querySelector('.collection-route__frame rect').getBoundingClientRect();
          frameError = Math.max(Math.abs(box.x + left - (outline.x - .5)),
            Math.abs(box.y + top - (outline.y - .5)),
            Math.abs(box.width - left - right - (outline.width + 1)),
            Math.abs(box.height - top - bottom - (outline.height + 1)));
        }
        window.footerFrames.push({ phase: overlay.dataset.transitionPhase,
          box: copy?.getBoundingClientRect().toJSON(), opacity: layer ? Number(getComputedStyle(layer).opacity) : null,
          backdrop: Number(getComputedStyle(overlay, '::before').opacity),
          mask: layer && getComputedStyle(layer).clipPath,
          paperClip, frameError,
          sameImage: !copy || copy === window.footerCopy,
          paneScroll: overlay.querySelector('.collection-route__snapshot .booking-content')?.scrollTop,
          originalStayed: image.parentElement === window.footerParent,
          snapshotVisible: [...overlay.querySelectorAll('.collection-route__snapshot .collection-outro img')]
            .some(node => getComputedStyle(node).visibility !== 'hidden') });
      }
      if (!window.footerDone) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.footerCopy = null;
    if (selector) document.querySelector(selector).click();
    return original;
  }, selector);
}
async function finish(page) {
  // A screenshot may finish after the overlay has already been removed. The
  // recorded frames still prove that the complete animation actually ran.
  await page.waitForFunction(() => document.querySelector('.collection-route') || window.footerFrames?.length);
  await settled(page);
  return page.evaluate(() => {
    window.footerDone = true;
    const image = document.querySelector('main:not([hidden]) > .collection-outro img');
    const rect = image.getBoundingClientRect();
    const copy = window.footerCopy;
    return { frames: window.footerFrames, originalStayed: window.footerOriginal.parentElement === window.footerParent,
      handoff: copy && { x: parseFloat(copy.style.left), y: parseFloat(copy.style.top),
        width: parseFloat(copy.style.width), height: parseFloat(copy.style.height) },
      destination: { ...rect.toJSON(), available: image.complete && image.naturalWidth > 0,
        visible: rect.top < innerHeight && rect.bottom > 0 },
      leaks: document.querySelectorAll('.collection-route, .collection-route__floor, .collection-route__floor-placeholder').length };
  });
}
function checkFrames(result, original, visible, label) {
  assert(result.frames.length > 8, `${label}: paper animation must run`);
  assert(result.originalStayed && result.frames.every(frame => frame.originalStayed), `${label}: originals stay in their page`);
  assert.equal(result.leaks, 0, `${label}: no transition layers remain`);
  assert(result.frames.every(frame => !frame.snapshotVisible), `${label}: paper snapshots preserve space without a second grid`);
  assert(result.frames.every(frame => frame.sameImage), `${label}: reuse the same image for the whole transition`);
  assert(result.frames.every(frame => frame.frameError < 1), `${label}: the visible border matches all four paper edges: ${JSON.stringify(result.frames.filter(frame => frame.frameError >= 1).slice(0, 2))}`);
  assert.notEqual(result.frames[0].paperClip, 'none', `${label}: initialize clipping before the first paint`);
  for (const frame of result.frames) {
    if (frame.box) assert.equal(frame.mask, 'none', `${label}: the moving paper covers a continuous grid`);
    if (['contract', 'hold', 'lift-away', 'crossfade-out'].includes(frame.phase)) {
      assert.equal(!!frame.box, visible, `${label}: only a visible source gets a departure copy`);
      if (frame.box) for (const key of ['x', 'y', 'width', 'height']) near(frame.box[key], original[key], `${label}: stationary departure ${key}`);
      near(frame.backdrop, 1, `${label}: destination hidden until expansion`);
      if (visible) assert.equal(frame.opacity, 1, `${label}: constant source appearance`);
      if (original.paneScroll != null) near(frame.paneScroll, original.paneScroll, `${label}: freeze the inner booking scroll`);
    }
  }
  const arrival = result.frames.filter(frame => ['expand', 'rise-in', 'crossfade-in'].includes(frame.phase));
  assert(arrival.length > 2, `${label}: sample the arrival`);
  assert(arrival.every(frame => frame.backdrop === 1), `${label}: one opaque backdrop prevents a second grid showing through`);
  if (visible && result.destination.available) {
    assert(arrival.every(frame => frame.opacity === 1), `${label}: keep the shared grid opaque through handoff`);
    // RAF observers sample before the final draw, which is followed by atomic
    // overlay removal. Its retained image styles record the exact handoff.
    for (const key of ['x', 'y', 'width', 'height']) near(result.handoff[key], result.destination[key], `${label}: seamless final ${key}`);
    const direction = Math.sign(result.destination.y - original.y);
    for (let index = 1; index < arrival.length; index++) {
      assert((arrival[index].box.y - arrival[index - 1].box.y) * direction >= -.1, `${label}: grid moves continuously toward its destination`);
    }
    if (Math.abs(original.y - result.destination.y) < 1) {
      for (const frame of arrival) for (const key of ['x', 'y', 'width', 'height']) near(frame.box[key], original[key], `${label}: aligned grid never moves ${key}`);
    }
  }
}

(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const errors = [];
  const open = async (viewport, options = {}, configure, description = 'A short project description.') => {
    const context = await browser.newContext({ viewport, ...options });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await attachMocks(page);
    // Keep the event mock and supply one short project for direct/SPA comparisons.
    await page.route('https://docs.google.com/**', async route => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('sheet') !== 'PROJECTS') return route.fallback();
      const callback = url.searchParams.get('tqx')?.match(/responseHandler:([^;]+)/)?.[1];
      const values = ['October', 'Footer test project', 'Design', '', '', description];
      const table = { cols: 'ABCDEF'.split('').map(id => ({ id, label: '', type: 'string' })),
        rows: [{ c: values.map(v => v ? { v } : null) }] };
      await route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify({ status: 'ok', table })});` });
    });
    if (configure) await configure(page);
    return { context, page };
  };
  const homeReady = async page => {
    await page.goto(`${address}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-collection-invite]');
    await page.waitForFunction(() => ['ready', 'static'].includes(document.querySelector('.collection-intro')?.dataset.welcomeState));
  };
  try {
    const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
    if (!process.argv.includes('--geometry-only')) for (const viewport of viewports.filter(viewport => !process.argv.includes('--mobile-only') || viewport.width === 390)) {
      for (const visibility of ['hidden', 'partial', 'full'].filter(value => !process.argv.includes('--full-only') || value === 'full')) {
        const { context, page } = await open(viewport);
        await homeReady(page);
        await scroll(page, visibility);
        if (visibility === 'full') await page.screenshot({ path: path.join(artifacts, `bottom-before-${viewport.width}.png`) });
        const original = await observe(page, '[data-collection-invite]');
        if (visibility !== 'hidden') {
          await page.waitForFunction(() => document.querySelector('.collection-route')?.dataset.transitionPhase === 'hold');
          await page.screenshot({ path: path.join(artifacts, `${visibility}-hold-${viewport.width}.png`) });
        }
        if (visibility === 'full') {
          await page.waitForFunction(() => document.querySelector('.collection-route')?.dataset.transitionPhase === 'expand');
          await page.screenshot({ path: path.join(artifacts, `bottom-expansion-${viewport.width}.png`) });
        }
        const result = await finish(page);
        if (visibility === 'full') await page.screenshot({ path: path.join(artifacts, `bottom-arrival-${viewport.width}.png`) });
        checkFrames(result, original, visibility !== 'hidden', `${viewport.width}/${visibility}`);
        const spa = await geometry(page);
        assert.equal(spa.position, 'relative');
        assert.equal(spa.style, null, 'No inherited viewport coordinates');
        near(spa.overlap, Math.min(152, viewport.width * .12), 'Event uses the homepage overlap');
        assert(spa.bottom >= viewport.height, 'The event footer follows the complete content');
        const direct = await context.newPage();
        await attachMocks(direct);
        await direct.goto(page.url(), { waitUntil: 'networkidle' });
        const loaded = await geometry(direct);
        for (const key of ['y', 'width', 'height']) near(spa[key], loaded[key], `Direct event and SPA ${key}`);
        await direct.close();
        await page.bringToFront();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (visibility === 'full') {
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const eventOriginal = await observe(page, null);
          await page.goBack();
          checkFrames(await finish(page), eventOriginal, true, `${viewport.width}/event-return`);
        } else {
          await page.goBack();
          await settled(page);
        }
        await page.waitForFunction(() => !document.querySelector('[data-collection-welcome]').hidden);
        near(await page.evaluate(() => scrollY), original.scroll, 'History restores the home scroll');
        // Repeat routes and browser-forward navigation without accumulating copies.
        await page.goForward();
        await settled(page);
        await page.evaluate(() => document.querySelector('[data-invite-page] [data-collection-home]').click());
        await page.waitForFunction(() => document.querySelector('.collection-route'));
        await settled(page);
        await scroll(page, 'partial');
        const projectOriginal = await observe(page, '[data-collection-project]');
        checkFrames(await finish(page), projectOriginal, true, `${viewport.width}/project`);
        const projectSpa = await geometry(page);
        near(projectSpa.overlap, Math.min(152, viewport.width * .12), 'Project uses the homepage overlap');
        near(projectSpa.bottom, viewport.height, 'Short project grid ends at the viewport bottom');
        await page.reload({ waitUntil: 'networkidle' });
        const projectDirect = await geometry(page);
        for (const key of ['y', 'width', 'height']) near(projectSpa[key], projectDirect[key], `Direct project and SPA ${key}`);
        if (visibility === 'full') {
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const returning = await observe(page, '[data-project-page] [data-collection-home]');
          checkFrames(await finish(page), returning, true, `${viewport.width}/direct-project-return`);
        }
        await context.close();
        console.log(`Passed ${viewport.width}px ${visibility} footer, history, event and project layouts`);
      }
    }
    // A destination with long content takes its grid below the viewport. It
    // must stay in document flow, including after a direct reload.
    for (const viewport of viewports) {
      const description = Array.from({ length: 14 }, (_, index) =>
        `## Section ${index + 1}\nA longer description with enough content to grow the paper naturally. The perspective footer follows the complete article.\n\n`).join('');
      const { context, page } = await open(viewport, {}, undefined, description);
      await homeReady(page);
      await scroll(page, 'full');
      const original = await observe(page, '[data-collection-project]');
      const result = await finish(page);
      checkFrames(result, original, true, `${viewport.width}/long-project`);
      assert(result.destination.y > viewport.height, 'Long project footer ends below the viewport');
      assert(result.frames.some(frame => frame.phase === 'expand' && frame.box.y > original.y + 20),
        'The shared grid moves toward the long page footer rather than fading in place');
      const spa = await geometry(page);
      near(spa.overlap, Math.min(152, viewport.width * .12), 'Long project retains the shared overlap');
      await page.reload({ waitUntil: 'networkidle' });
      const direct = await geometry(page);
      for (const key of ['y', 'width', 'height']) near(direct[key], spa[key], 'Long project direct versus animated ' + key);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      near((await geometry(page)).bottom, viewport.height, 'Long project footer is reachable at the document bottom');
      // Every public project render keeps the original footer node and asset.
      assert(await page.evaluate(() => {
        const host = document.querySelector('[data-project-page]');
        const image = host.querySelector('.project-detail__ground-image');
        CollectionProjects.status(host, 'Loading project…', 'Please wait.');
        const loading = image === host.querySelector('.project-detail__ground-image');
        CollectionProjects.status(host, 'Unable to load', 'Try again.', () => {});
        const error = image === host.querySelector('.project-detail__ground-image');
        CollectionProjects.renderIndex(host, []);
        const index = image === host.querySelector('.project-detail__ground-image');
        CollectionProjects.render(host, { title: 'Short project', description: 'A short description.', slug: 'short' });
        return loading && error && index && image === host.querySelector('.project-detail__ground-image')
          && host.querySelectorAll('.project-detail__ground-image').length === 1;
      }), 'Project loading, errors, index and content share one footer');
      await context.close();
      console.log(`Passed ${viewport.width}px long destination and persistent project footer`);
    }
    {
      const { context, page } = await open({ width: 844, height: 390 });
      await page.goto(`${address}/invites/?event=rehaul-test-event`, { waitUntil: 'networkidle' });
      assert(await page.locator('.booking-frame').evaluate(node => node.getBoundingClientRect().height >= 512),
        'Landscape booking retains its minimum and grows with content');
      const arrival = await geometry(page);
      assert(arrival.y > 390, 'Landscape footer stays below the minimum-height panel');
      near(arrival.overlap, Math.min(152, 844 * .12), 'Landscape uses the same responsive overlap');
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      near((await geometry(page)).bottom, 390, 'Landscape footer is reachable');
      assert(await page.locator('.booking-content').evaluate(node => node.scrollHeight <= node.clientHeight + 1
        && getComputedStyle(node).overflowY === 'visible'), 'Landscape content uses document scrolling');
      await context.close();
      console.log('Passed landscape layout and document scrolling');
    }
    if (!process.argv.includes('--geometry-only')) {
    // Booking steps grow naturally while keeping their original footer.
    {
      const { context, page } = await open({ width: 1440, height: 900 });
      await page.goto(`${address}/invites/?event=rehaul-test-event`, { waitUntil: 'networkidle' });
      const reference = await geometry(page);
      await page.evaluate(() => {
        window.bookingFooter = document.querySelector('[data-invite-page] > .collection-outro img');
        window.bookingPane = document.querySelector('[data-invite-page] .booking-content');
      });
      const checkBooking = async () => {
        await page.waitForFunction(() => !document.querySelector('.booking-frame[data-transition-phase]'));
        const actual = await geometry(page);
        for (const key of ['width', 'height']) near(actual[key], reference[key], `Booking step footer ${key}`);
        near(actual.overlap, 152, 'Booking steps retain the shared overlap');
        near(await page.evaluate(() => scrollY), 0, 'Forward booking starts at the top');
        assert(await page.locator('[data-invite-page] .booking-content').evaluate(node => node.scrollHeight <= node.clientHeight + 1),
          'Booking content fits its naturally growing paper');
        assert(await page.evaluate(() => window.bookingFooter === document.querySelector('[data-invite-page] > .collection-outro img')
          && window.bookingPane === document.querySelector('[data-invite-page] .booking-content')),
        'Booking steps preserve the original pane and footer');
        assert.equal(await page.locator('.collection-route, .collection-route__floor').count(), 0);
      };
      await page.locator('[data-action="plus"][data-id="general"]').click();
      await page.locator('button[type="submit"]').click();
      await page.getByRole('heading', { name: 'Who is joining?' }).waitFor();
      await checkBooking();
      await page.locator('input[name="firstName"]').fill('Jana');
      await page.locator('input[name="lastName"]').fill('Franck');
      await page.locator('input[name="email"]').fill('jana@example.com');
      await page.locator('button[type="submit"]').click();
      await page.getByRole('heading', { name: 'One last look.' }).waitFor();
      await checkBooking();
      await page.locator('[data-place-order]').click();
      await page.getByRole('heading', { name: "You're in." }).waitFor();
      await checkBooking();
      await context.close();
      console.log('Passed reservation steps with full-length paper and a natural footer');
    }
    for (const kind of ['lift', 'footer']) {
      const { context, page } = await open({ width: 1440, height: 900 });
      await page.goto(`${address}/projects/design-preview/`, { waitUntil: 'networkidle' });
      await page.locator(`[data-project-transition="${kind}"]`).click();
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const original = await observe(page, '[data-project-preview-switch]');
      checkFrames(await finish(page), original, true, `${kind}/preview`);
      await context.close();
      console.log(`Passed ${kind} transition preview`);
    }
    for (const mode of ['failure', 'slow', 'reduced', 'resize']) {
      let releaseImage;
      const imageGate = new Promise(resolve => { releaseImage = resolve; });
      const { context, page } = await open({ width: 1440, height: 900 }, mode === 'reduced' ? { reducedMotion: 'reduce' } : {}, async page => {
        if (mode === 'failure') await page.route(grid, route => route.abort());
        if (mode === 'slow') await page.route(grid, async route => {
          await imageGate;
          await route.fallback();
        });
      });
      await homeReady(page);
      await scroll(page, 'partial');
      const started = Date.now();
      await page.evaluate(() => document.querySelector('[data-collection-invite]').click());
      if (mode !== 'reduced') {
        await page.waitForFunction(() => document.querySelector('.collection-route'));
        assert(Date.now() - started < 400, 'Unavailable image must not delay the paper animation');
        if (mode === 'failure' || mode === 'slow') assert.equal(await page.locator('.collection-route__floor').count(), 0);
        if (mode === 'resize') await page.setViewportSize({ width: 860, height: 650 });
      }
      releaseImage();
      await settled(page);
      await page.waitForFunction(() => !document.querySelector('[data-invite-page]').hidden);
      const result = await geometry(page);
      near(result.overlap, Math.min(152, (await page.evaluate(() => innerWidth)) * .12), `${mode}: footer keeps the shared overlap`);
      near(result.height, result.width * 521 / 1920, `${mode}: reserve the image aspect ratio`);
      assert.equal(await page.locator('.collection-route__floor, .collection-route__floor-placeholder').count(), 0);
      await context.close();
      console.log(`Passed ${mode} footer fallback`);
    }
    }
    assert.deepEqual(errors, [], 'No browser errors');
    console.log('Footer checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

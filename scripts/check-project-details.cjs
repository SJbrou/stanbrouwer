// Browser acceptance checks. Set PLAYWRIGHT_MODULE / CHROMIUM_PATH for a local installation.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (_) { playwright = require('../docs/design-exploration/browser-check/node_modules/playwright-core'); }
const address = process.env.PROJECT_PREVIEW_URL || 'http://127.0.0.1:4317';
const artifacts = path.resolve(__dirname, '../docs/project-details-check');
const navigationOnly = process.argv.includes('--navigation-only');
const failuresOnly = process.argv.includes('--failures-only');
const description = 'An everyday object, seen from another angle.\n\n## The idea\nA **small experiment** in light and proportion.\n\n- Keep the materials simple.\n- Leave room for discovery.\n\n## The process\n1. Observe.\n2. Make.\n3. Refine.\n\nVisit [the collection](https://example.com/work).\n\n<script>window.sheetInjection = true</script>\n[Unsafe](javascript:alert(1))';
const rows = [
  ['August', 'Airco tube light ', 'DIY', `${address}/assets/img/de_loods.jpg`, 'https://example.com/project', description],
  ['September', 'Notes without an image', '', '', '', 'A project with no image.\n\nIt still has a complete page.'],
  ['October', 'A deliberately long project title that needs to wrap gracefully on a small screen', 'Design', '', '', `${description}\n\n## Further studies\n${'A longer paragraph about making and observing familiar objects. '.repeat(90)}`],
  ['July', 'Broken image', 'DIY', `${address}/missing-project-image.jpg`, '', description],
  ['June', 'External only', 'Reference', '', 'https://example.com/reference', ''],
  ['May', 'F is a URL', 'Notes', '', '', 'https://example.com/description']
];
const response = { status: 'ok', table: { cols: 'ABCDEF'.split('').map(id => ({ id, label: '', type: 'string' })), rows: rows.map(values => ({ c: values.map(v => v ? { v } : null) })) } };
const soundsResponse = { status: 'ok', table: {
  cols: 'ABCDE'.split('').map(id => ({ id, label: '', type: 'string' })),
  rows: [{ c: ['June', 'A track that stays', 'SoundCloud', '02:34', 'https://soundcloud.com/example/stays'].map(v => ({ v })) }]
} };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const errors = [];
  const setup = async (viewport, reducedMotion = 'reduce', projectDelay = 0, includeAudio = false) => {
    const context = await browser.newContext({ viewport, reducedMotion });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'warning') console.log(message.text()); });
    let requests = 0;
    let playerRequests = 0;
    if (includeAudio) {
      await page.route('https://soundcloud.com/oembed**', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify({ title: 'A track that stays', author_name: 'Collection',
          thumbnail_url: `${address}/assets/img/de_loods.jpg`, html: '<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fexample%2Fstays"></iframe>' })
      }));
      await page.route('https://w.soundcloud.com/player/**', route => {
        if (new URL(route.request().url()).pathname.endsWith('/api.js')) return route.fulfill({
          contentType: 'application/javascript', body: `window.fixtureWidgetBindings = 0;
            window.SC = {Widget: Object.assign(frame => ({bind(event, callback) {
              window.fixtureWidgetBindings += 1;
              addEventListener('message', message => {
                if (message.source === frame.contentWindow && message.data?.event === event) callback();
              });
            }}), {Events: {PLAY:'play', PAUSE:'pause', FINISH:'finish'}})};`
        });
        playerRequests += 1;
        return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Test audio player</title>
          <button style="position:absolute;top:4.7rem;left:4rem;width:4rem" onclick="startPlayer()">Start audio</button><script>
          window.playerToken = crypto.randomUUID();
          window.playerElapsed = 0;
          window.playerCommands = [];
          window.playerPlaying = new URL(location.href).searchParams.get('auto_play') === 'true';
          window.startPlayer = () => { window.playerPlaying = true; parent.postMessage({event: 'play'}, '*'); };
          addEventListener('message', event => {
            try {
              const command = JSON.parse(event.data).method;
              window.playerCommands.push(command);
              if (command === 'play') window.startPlayer();
              if (command === 'pause') { window.playerPlaying = false; parent.postMessage({event: 'pause'}, '*'); }
            } catch (_) {}
          });
          setInterval(() => { if (window.playerPlaying) window.playerElapsed += 100; }, 100);
        </script>` });
      });
    }
    await page.route('https://docs.google.com/**', async route => {
      const url = new URL(route.request().url());
      const callback = new URLSearchParams(url.search).get('tqx')?.match(/responseHandler:([^;]+)/)?.[1];
      if (!callback) return route.abort();
      const isProjects = url.searchParams.get('sheet') === 'PROJECTS';
      if (isProjects) { requests += 1; if (projectDelay) await sleep(projectDelay); }
      const sheet = isProjects ? response : includeAudio && url.searchParams.get('sheet') === 'SOUNDS'
        ? soundsResponse : { status: 'ok', table: { cols: [], rows: [] } };
      await route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify(sheet)});` });
    });
    return { context, page, requestCount: () => requests, playerRequestCount: () => playerRequests };
  };
  const settled = page => page.waitForFunction(() => {
    const canonical = new URL(document.querySelector('link[rel="canonical"]').href);
    return !document.querySelector('.collection-route') && !document.body.classList.contains('is-collection-navigating')
      && canonical.pathname === location.pathname && canonical.search === location.search;
  });
  const fit = async page => {
    const geometry = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth,
      broken: [...document.querySelectorAll('[data-project-page]:not([hidden]) h1, [data-project-page]:not([hidden]) p, .project-design-controls button, .project-design-controls select')]
        .filter(node => node.getBoundingClientRect().width && (node.getBoundingClientRect().right > innerWidth + 1 || node.getBoundingClientRect().left < -1)).map(node => node.textContent.slice(0, 60)) }));
    assert(geometry.overflow <= geometry.width, `Horizontal overflow: ${JSON.stringify(geometry)}`);
    assert.deepEqual(geometry.broken, [], 'Content must fit inside the viewport');
  };
  const refinedModular = async page => {
    assert.equal(await page.locator('.project-detail--modular').count(), 1);
    assert.equal(await page.locator('.project-detail__footer').count(), 0);
    assert.equal(await page.locator('[data-project-page] .collection-image-window, [data-project-page] .collection-image-window__chrome, [data-project-page] figcaption').count(), 0, 'Project image must have no window or caption');
    const photo = page.locator('[data-project-page] .project-detail__image');
    if (await photo.count()) await photo.evaluate(image => image.decode());
    const geometry = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      const row = rect('.project-detail__meta-row');
      const action = rect('.project-detail__external');
      const nav = rect('.project-detail__nav');
      const content = rect('.project-detail__content');
      const imageNode = document.querySelector('.project-detail__image');
      const image = imageNode?.getBoundingClientRect();
      const title = rect('.project-detail__title');
      return {
        infoInBar: document.querySelector('.project-detail__nav').contains(document.querySelector('.project-detail__meta-row'))
          && row.top >= nav.top && row.bottom <= nav.bottom && nav.bottom <= title.top,
        actionInRow: !action || action.top >= row.top && action.bottom <= row.bottom,
        hiddenLabels: [...document.querySelectorAll('.project-detail__meta dt')].every(node => {
          const label = node.getBoundingClientRect();
          return label.width <= 1 && label.height <= 1;
        }),
        imageInsideContent: !image || imageNode.closest('.project-detail__content')
          && image.left >= content.left && image.right <= content.right && image.top >= content.top && image.bottom <= content.bottom,
        alignedWithTitle: !image || Math.abs(image.top - title.top) <= 1 && image.left >= title.right,
        naturalProportions: !image || Math.abs(image.width / image.height - imageNode.naturalWidth / imageNode.naturalHeight) < 0.01,
        textClear: !image || [...document.querySelectorAll('.project-detail__title, .project-detail__meta dd, .project-detail__external, .project-detail__section p, .project-detail__section h2')]
          .every(node => {
            const text = node.getBoundingClientRect();
            return text.right <= image.left || text.left >= image.right || text.bottom <= image.top || text.top >= image.bottom;
          })
      };
    });
    assert(geometry.infoInBar && geometry.actionInRow, 'Date, category and Open project must share the navigation bar above the title');
    assert(geometry.hiddenLabels, 'Date and category labels must not take visible space');
    assert(geometry.imageInsideContent, 'The image must sit fully inside the content panel');
    assert(geometry.alignedWithTitle, 'The image must sit beside the title');
    assert(geometry.naturalProportions, 'The image must retain its natural proportions');
    assert(geometry.textClear, 'The image must not cover titles, values, actions or body text');
  };
  const noContentRules = async page => {
    const rules = await page.evaluate(() => [...document.querySelectorAll('.project-detail__header, .project-detail__meta, .project-detail__meta-row, .project-detail__body, .project-detail__section, .project-detail__footer, .project-detail__index li')]
      .filter(node => {
        const style = getComputedStyle(node);
        return parseFloat(style.borderTopWidth) || parseFloat(style.borderBottomWidth);
      }).map(node => node.className));
    assert.deepEqual(rules, [], 'Content below the header must not have horizontal rules');
  };
  try {
    if (!navigationOnly && !failuresOnly) for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      const { context, page } = await setup(viewport);
      await page.goto(`${address}/projects/design-preview/`);
      assert.equal(await page.locator('[data-project-design="modular"]').getAttribute('aria-pressed'), 'true');
      for (const variant of ['editorial', 'split', 'modular']) {
        await page.locator(`[data-project-design="${variant}"]`).click();
        assert.equal(await page.locator(`[data-project-design="${variant}"]`).getAttribute('aria-pressed'), 'true');
        for (const example of ['image', 'text', 'long']) {
          await page.locator('[data-project-example]').selectOption(example);
          await page.evaluate(() => document.fonts.ready);
          await fit(page);
          await noContentRules(page);
          assert.equal(await page.locator('[data-project-page] .project-detail__figure').count(), example === 'text' ? 0 : 1);
          if (variant === 'modular') await refinedModular(page);
          if ([390, 1440].includes(viewport.width) && example !== 'text') {
            await page.screenshot({ path: path.join(artifacts, `${variant}-${example}-${viewport.width}.png`), fullPage: true });
          }
        }
      }
      await page.locator('[data-project-example]').selectOption('airco-tube-light');
      assert.equal(await page.locator('[data-project-page] strong').textContent(), 'small experiment');
      assert.equal(await page.locator('[data-project-page] script').count(), 0);
      assert.equal(await page.locator('[data-project-page] a[href^="javascript:"]').count(), 0);
      assert.equal(await page.evaluate(() => window.sheetInjection), undefined);
      assert.equal(await page.locator('[data-project-page] ol li').count(), 3);
      await page.locator('[data-project-replay]').click();
      await settled(page);
      await context.close();
      console.log(`Layout and Markdown passed at ${viewport.width}px`);
    }

    if (!failuresOnly) for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const { context, page, requestCount, playerRequestCount } = await setup(viewport, 'no-preference', 0, true);
      await page.goto(address);
      const sound = page.getByRole('button', { name: 'Play A track that stays on SoundCloud' });
      if (viewport.width >= 960) await sound.click();
      else {
        await sound.waitFor();
        // Scroll to the mobile preview, then start inside the player without selecting the row.
        await page.evaluate(() => {
          const row = document.querySelector('#collection-sounds .collection-row');
          scrollTo(0, row.getBoundingClientRect().top + scrollY + row.offsetHeight / 2 - innerHeight / 2);
        });
      }
      await page.locator('.collection-media__frame--soundcloud').waitFor();
      await page.waitForFunction(() => window.fixtureWidgetBindings >= 3);
      let player = page.frames().find(frame => frame.url().startsWith('https://w.soundcloud.com/player/'));
      if (!player) player = await page.waitForEvent('framenavigated', {
        predicate: frame => frame.url().startsWith('https://w.soundcloud.com/player/')
      });
      await player.waitForFunction(() => !!window.playerToken);
      if (viewport.width < 960) {
        assert.equal(await player.evaluate(() => window.playerPlaying), false);
        await player.getByRole('button', { name: 'Start audio' }).click();
      }
      await page.waitForFunction(() => document.querySelector('.collection-media-window__content')?.dataset.soundcloudPlaying === 'true');
      await player.waitForFunction(() => window.playerPlaying);
      const originalPlayer = await player.evaluate(() => ({ token: window.playerToken, elapsed: window.playerElapsed }));
      const link = page.locator('[data-collection-project="airco-tube-light"]');
      await link.waitFor();
      assert.equal(await link.locator('.collection-cell').count(), 3);
      assert.equal(await page.locator('#collection-projects [data-full-value*="everyday"]').count(), 0);
      assert.equal(await page.locator('#collection-projects a[href="https://example.com/reference"]').count(), 1);
      assert.equal(await page.locator('[data-collection-project="f-is-a-url"]').count(), 1);
      await link.scrollIntoViewIfNeeded();
      // Focusing a feed row completes the existing scroll-driven welcome frame.
      await link.focus();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      await page.evaluate(() => {
        // A browser may scroll again to bring the clicked row clear of a media window.
        document.querySelector('[data-collection-project="airco-tube-light"]').addEventListener('click', () => {
          window.collectionDepartureScroll = scrollY;
        }, { once: true });
        window.transitionPhases = [];
        new MutationObserver(records => {
          for (const record of records) {
            if (record.type === 'attributes') window.transitionPhases.push(record.target.dataset.transitionPhase);
            for (const node of record.addedNodes) if (node.dataset?.transitionPhase) window.transitionPhases.push(node.dataset.transitionPhase);
          }
        }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-transition-phase'] });
      });
      const projectFocal = await link.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await link.click();
      const scroll = await page.evaluate(() => window.collectionDepartureScroll);
      assert(Number.isFinite(scroll), 'Record the scroll position at the actual navigation click');
      const squareHandle = await page.waitForFunction(() => {
        const overlay = document.querySelector('.collection-route');
        if (overlay?.dataset.transitionPhase !== 'hold') return false;
        const rect = overlay.querySelector('rect');
        return { x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')),
          width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height')) };
      }, null, { polling: 'raf' });
      const square = await squareHandle.jsonValue();
      assert.equal(await page.locator('#collection-media-window').isVisible(), true, 'Playing media must remain available during the transition');
      assert(await page.locator('#collection-media-window').evaluate(node => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.left + 8, rect.top + 8));
      }), 'The media window must remain above the transition overlay');
      assert(Math.abs(square.width - square.height) < 1);
      assert(square.width >= 111 && square.width <= 176);
      assert(Math.abs(square.x + square.width / 2 - projectFocal.x) < 1,
        'The clicked project link must be the transition perspective point');
      assert(Math.abs(square.y + square.height / 2 - projectFocal.y) < 1,
        'The clicked project link must be the transition perspective point');
      await page.screenshot({ path: path.join(artifacts, `transition-square-${viewport.width}.png`) });
      await settled(page);
      assert(page.url().includes('/projects/?project=airco-tube-light'));
      assert.equal(await page.locator('[data-project-page] h1').textContent(), 'Airco tube light');
      assert.equal(await page.evaluate(() => document.activeElement.localName), 'h1');
      assert.equal(await page.locator('[data-project-page] .project-detail__external').getAttribute('href'), 'https://example.com/project');
      await refinedModular(page);
      await noContentRules(page);
      assert.equal(await page.locator('.collection-media-dock > #collection-media-window').count(), 1);
      assert.equal(await player.evaluate(() => window.playerToken), originalPlayer.token, 'Navigation must preserve the existing iframe');
      assert(await player.evaluate(elapsed => window.playerPlaying && window.playerElapsed > elapsed, originalPlayer.elapsed), 'Playback must continue through navigation');
      assert.equal(await player.evaluate(() => window.playerCommands.includes('pause')), false, 'Navigation must not pause the track');
      await page.getByRole('button', { name: 'Pause track', exact: true }).click();
      await player.waitForFunction(() => !window.playerPlaying);
      await page.getByRole('button', { name: 'Play track', exact: true }).click();
      await player.waitForFunction(() => window.playerPlaying);
      await page.getByRole('button', { name: 'Minimize audio player' }).click();
      assert.equal(await page.locator('#collection-media-window.is-minimized').count(), 1);
      assert.equal(await player.evaluate(() => window.playerPlaying), true);
      await page.getByRole('button', { name: 'Maximize audio player' }).click();
      if (viewport.width < 960) {
        await page.getByRole('button', { name: 'Close media window' }).click();
        assert.equal(await page.locator('#collection-media-window-toggle').isVisible(), true);
        assert.equal(await player.evaluate(() => window.playerPlaying), true);
        await page.locator('#collection-media-window-toggle').click();
      }
      assert.deepEqual([...new Set(await page.evaluate(() => window.transitionPhases))].sort(), ['contract', 'expand', 'hold']);
      await page.evaluate(() => scrollTo(0, 250));
      await page.waitForTimeout(50);
      const detailScroll = await page.evaluate(() => scrollY);
      await page.goBack();
      await settled(page);
      await page.goForward();
      await settled(page);
      assert(Math.abs(await page.evaluate(() => scrollY) - detailScroll) <= 2, 'Forward should restore detail scroll');
      const backLink = page.locator('[data-project-page] [data-collection-home]');
      await backLink.scrollIntoViewIfNeeded();
      const backFocal = await backLink.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await backLink.click();
      const returnSquareHandle = await page.waitForFunction(() => {
        const overlay = document.querySelector('.collection-route');
        if (overlay?.dataset.transitionPhase !== 'hold') return false;
        const rect = overlay.querySelector('rect');
        return { x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')),
          width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height')) };
      }, null, { polling: 'raf' });
      const returnSquare = await returnSquareHandle.jsonValue();
      assert(Math.abs(returnSquare.x + returnSquare.width / 2 - backFocal.x) < 1,
        `The PROJECTS back arrow must be the return transition perspective point (${JSON.stringify({ returnSquare, backFocal })})`);
      assert(Math.abs(returnSquare.y + returnSquare.height / 2 - backFocal.y) < 1,
        `The PROJECTS back arrow must be the return transition perspective point (${JSON.stringify({ returnSquare, backFocal })})`);
      await settled(page);
      const returnScroll = await page.evaluate(() => scrollY);
      assert(Math.abs(returnScroll - scroll) <= 2, `Return should restore collection scroll: ${returnScroll} instead of ${scroll}`);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.collectionProject), 'airco-tube-light');
      await page.goBack();
      await settled(page);
      assert.equal(await page.locator('[data-project-page]').getAttribute('hidden'), null);
      await page.goBack();
      await settled(page);
      assert(Math.abs(await page.evaluate(() => scrollY) - scroll) <= 2, 'Browser Back should restore collection scroll');
      await page.goForward();
      await settled(page);
      assert.equal(await page.locator('[data-project-page] h1').textContent(), 'Airco tube light');
      assert.equal(requestCount(), 1, 'Navigation should reuse the loaded sheet');
      await page.setViewportSize(viewport.width >= 960 ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      await page.setViewportSize(viewport);
      await page.locator('#collection-media-window').waitFor();
      assert.equal(await player.evaluate(() => window.playerToken), originalPlayer.token);
      assert.equal(await player.evaluate(() => window.playerPlaying), true);
      assert.equal(playerRequestCount(), 1, 'History, controls and resizing must not reload the audio iframe');
      await page.screenshot({ path: path.join(artifacts, `playing-media-${viewport.width}.png`) });
      await fit(page);
      await context.close();
      console.log(`Animated navigation, history and persistent playback passed at ${viewport.width}px`);
    }

    if (!failuresOnly) {
      const { context, page, requestCount } = await setup({ width: 390, height: 844 });
      await page.goto(`${address}/projects/?project=notes-without-an-image`);
      await page.getByRole('heading', { name: 'Notes without an image' }).waitFor();
      assert.equal(await page.locator('.project-detail__figure').count(), 0);
      assert.equal(await page.locator('.project-detail__meta dd').textContent(), 'September');
      assert.equal(await page.locator('.project-detail__external').count(), 0);
      await page.locator('[data-collection-home]').click();
      await page.locator('#collection-projects [data-collection-project]').first().waitFor();
      await settled(page);
      assert.equal(await page.locator('[data-collection-project="notes-without-an-image"]').isVisible(), true,
        'Returning from a direct detail URL should focus its project in the collection');
      const resumedImage = await page.locator('.collection-intro__image').boundingBox();
      assert(resumedImage.y + resumedImage.height < 0,
        `Returning to a project should resume at the collection content instead of the welcome image (${JSON.stringify({ resumedImage, scrollY: await page.evaluate(() => scrollY) })})`);
      const resumedProject = await page.locator('[data-collection-project="notes-without-an-image"]').boundingBox();
      assert(resumedProject.y >= 0 && resumedProject.y < 844,
        'The returned collection should keep the current project link in view');
      assert.equal(requestCount(), 1);
      await page.goto(`${address}/projects/?project=broken-image`);
      await page.getByRole('heading', { name: 'Broken image' }).waitFor();
      await page.waitForFunction(() => !document.querySelector('.project-detail__figure'));
      assert.equal(await page.locator('.project-detail__aside').count(), 0);
      assert.equal(await page.locator('.project-detail.has-image').count(), 0);
      await page.goto(`${address}/projects/?project=unknown`);
      await page.getByRole('heading', { name: 'Project not found' }).waitFor();
      await page.goto(`${address}/projects/`);
      await page.locator('.project-detail__index a').first().waitFor();
      await page.locator('.project-detail__index a').first().click();
      await settled(page);
      await page.getByRole('heading', { name: 'Airco tube light' }).waitFor();
      await context.close();
      console.log('Direct URLs, missing content, reduced motion and project index passed');
    }

    {
      const { context, page } = await setup({ width: 390, height: 844 });
      const fail = route => route.abort();
      await page.route('https://docs.google.com/**', fail);
      await page.goto(`${address}/projects/?project=airco-tube-light`);
      await page.getByRole('heading', { name: 'Project unavailable' }).waitFor();
      await page.unroute('https://docs.google.com/**', fail);
      await page.getByRole('button', { name: 'Try again' }).click();
      await page.getByRole('heading', { name: 'Airco tube light' }).waitFor();
      await context.close();
      console.log('Sheet failure and retry recovered');
    }

    {
      const { context, page } = await setup({ width: 1440, height: 900 }, 'no-preference');
      await page.route(`${address}/`, async route => { await sleep(5000); await route.continue(); });
      await page.goto(`${address}/projects/?project=airco-tube-light`);
      await page.getByRole('heading', { name: 'Airco tube light' }).waitFor();
      await page.locator('[data-collection-home]').click();
      await settled(page);
      await page.getByRole('heading', { name: 'Loading collection…' }).waitFor();
      await page.waitForFunction(() => document.querySelector('[data-collection-welcome]')?.hidden === false);
      assert.equal(await page.locator('.collection-route').count(), 0);
      assert.equal(await page.locator('[data-collection-welcome]').evaluate(node => node.inert), false);
      await context.close();
      console.log('Slow loading reveals a usable loading state and completes');
    }

    {
      const { context, page } = await setup({ width: 1440, height: 900 }, 'no-preference');
      await page.goto(`${address}/projects/design-preview/`);
      await page.locator('[data-project-replay]').click();
      await page.setViewportSize({ width: 390, height: 844 });
      await settled(page);
      assert.equal(await page.locator('[data-project-page]').evaluate(node => node.inert), false);
      await fit(page);
      await context.close();
      console.log('Interrupted transition recovered');
    }
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log(`All project-detail checks passed. Screenshots: ${artifacts}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

(() => {
  'use strict';
  const data = window.MobilePreviewData;
  const options = window.COLLECTION_PREVIEW_OPTIONS;
  const home = document.querySelector('[data-collection-welcome]');
  const detail = document.querySelector('[data-mobile-detail]');
  const nav = document.querySelector('.mobile-chapter-nav');
  const index = document.querySelector('#mobile-chapter-index');
  const dialog = document.querySelector('.mobile-media-dialog');
  const dock = document.querySelector('.mobile-bottom-dock');
  const audio = dock.querySelector('.mobile-audio');
  const bookingDock = dock.querySelector('.mobile-booking-dock');
  const status = document.querySelector('[data-mobile-status]');
  const welcome = window.CollectionWelcome.initialise(home);
  const views = ['collection', 'project', 'invite', 'details', 'overview', 'confirmation'];
  const params = new URLSearchParams(location.search);
  const saved = history.state?.mobilePreview;
  let view = views.includes(params.get('view')) ? params.get('view') : 'collection';
  let homeScroll = saved?.homeScroll || 0;
  let counts = saved?.counts || {};
  let details = saved?.details || {};
  let confirmed = saved?.confirmed || null;
  let player = saved?.player || null;
  let currentProject = Number(params.get('project')) || 0;
  let busy = false;
  let scrollFrame;
  let chapterOverride;
  let chapterOverrideScroll = 0;
  let rowOverride;
  const rowRecords = new Map();
  const previews = new Map();
  const previewWindow = window.MobilePreviewWindow.create(document.querySelector('#collection-image-window'));
  const chapterIds = ['invites', 'words', 'sounds', 'places', 'projects'];
  const article = document.createElement('article');
  article.className = 'collection-poster project-detail project-detail--modular has-ground booking-frame';
  const pane = document.createElement('div');
  pane.className = 'booking-content';
  const host = document.createElement('div');
  host.className = 'booking-host';
  pane.append(host); article.append(pane);
  const ground = document.createElement('footer');
  ground.className = 'collection-outro project-detail__ground';
  ground.setAttribute('aria-hidden', 'true');
  const grid = document.createElement('img');
  grid.className = 'collection-outro__image project-detail__ground-image';
  grid.src = window.COLLECTION_PROJECTS_CONFIG.transitionGridImage;
  grid.alt = ''; grid.width = 1920; grid.height = 521;
  ground.append(grid); detail.append(article, ground);
  const bookingMotion = window.TZInviteExperience.createMotion(article, pane);
  const selection = () => data.event().ticketTypes.filter(ticket => counts[ticket.id] > 0).map(ticket => ({ ...ticket, count: counts[ticket.id] }));
  const total = () => selection().reduce((sum, ticket) => sum + ticket.count, 0);
  const titleFor = row => row.values[row.sourceIndexes.indexOf(1)] || row.label;
  const urlFor = (next, extra = {}) => {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ entrance: data.entrance, fixture: data.fixture, view: next, ...extra });
    url.hash = '';
    return url;
  };
  function save() {
    if (busy) return;
    if (view === 'collection') homeScroll = scrollY;
    history.replaceState({ ...history.state, collectionView: { scroll: homeScroll, homeWelcome: welcome.snapshot() }, mobilePreview: { view, scroll: scrollY, homeScroll, counts, details, confirmed, player, entered: welcome.snapshot()?.entered } }, '', location.href);
  }
  function announce(message) { status.textContent = message; }
  function closeIndex() {
    index.hidden = true; nav.classList.remove('is-expanded');
    nav.querySelector('button').setAttribute('aria-expanded', 'false');
    nav.querySelector('button').textContent = 'Index +';
  }
  function imageDialog(title, source) {
    dialog.querySelector('h2').textContent = title;
    const content = dialog.querySelector('[data-dialog-content]');
    const image = document.createElement('img'); image.src = source; image.alt = title;
    image.addEventListener('error', () => { const message = document.createElement('p'); message.textContent = 'This image is unavailable.'; content.replaceChildren(message); }, { once: true });
    content.replaceChildren(image); dialog.showModal();
  }
  function readingDialog(title) {
    dialog.querySelector('h2').textContent = title;
    const content = dialog.querySelector('[data-dialog-content]'); content.replaceChildren();
    for (const text of ['A room becomes a place through the things we do together.', 'A long table, a little light, and enough room for an idea to grow. Small details become an invitation to see the familiar again.', 'This is a sample reading preview. Links in the public collection keep their original destinations.']) {
      const p = document.createElement('p'); p.textContent = text; content.append(p);
    }
    dialog.showModal();
  }
  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  function syncAudio() {
    audio.hidden = !player;
    if (player) {
      audio.querySelector('[data-audio-title]').textContent = player.title;
      audio.querySelector('[data-audio-time]').textContent = `Sample ${Math.floor(player.elapsed / 60)}:${String(player.elapsed % 60).padStart(2, '0')} / ${player.duration}`;
      const play = audio.querySelector('[data-audio-play]');
      play.textContent = player.playing ? 'Ⅱ' : '▷'; play.setAttribute('aria-label', player.playing ? 'Pause sample audio' : 'Play sample audio');
    }
    for (const [entry, record] of rowRecords) if (record.row.media?.kind === 'soundcloud') {
      const playing = !!player?.playing && player.title === titleFor(record.row);
      entry.classList.toggle('is-playing', playing);
      entry.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${titleFor(record.row)} (sample audio)`);
    }
    if (dialog.open && dialog.dataset.audio === 'true') {
      const button = dialog.querySelector('[data-dialog-play]');
      if (button) button.textContent = player?.playing ? 'Pause sample' : 'Play sample';
      const progress = dialog.querySelector('progress');
      if (progress && player) progress.value = player.elapsed;
    }
    measureDock();
  }
  function playRow(row) {
    const title = titleFor(row);
    if (player?.title === title) player.playing = !player.playing;
    else player = { title, playing: true, elapsed: 0, duration: row.values[row.sourceIndexes.indexOf(3)] || '04:12' };
    syncAudio(); save(); announce(`${player.playing ? 'Playing' : 'Paused'} sample: ${title}`);
  }
  audio.querySelector('[data-audio-play]').addEventListener('click', () => { player.playing = !player.playing; syncAudio(); save(); });
  audio.querySelector('[data-audio-close]').addEventListener('click', () => { player = null; syncAudio(); save(); });
  audio.querySelector('[data-audio-expand]').addEventListener('click', () => {
    dialog.dataset.audio = 'true'; dialog.querySelector('h2').textContent = player.title;
    const content = document.createElement('div'); content.className = 'mobile-dialog-audio';
    const p = document.createElement('p'); p.textContent = 'Sample audio player. Playback is simulated in this design preview.';
    const progress = document.createElement('progress'); progress.max = player.duration.split(':').reduce((minutes, seconds) => Number(minutes) * 60 + Number(seconds)); progress.value = player.elapsed; progress.setAttribute('aria-label', 'Sample playback progress');
    const button = document.createElement('button'); button.type = 'button'; button.dataset.dialogPlay = ''; button.textContent = player.playing ? 'Pause sample' : 'Play sample';
    button.addEventListener('click', () => { player.playing = !player.playing; syncAudio(); save(); });
    content.append(p, progress, button); dialog.querySelector('[data-dialog-content]').replaceChildren(content); dialog.showModal();
  });
  dialog.addEventListener('close', () => { delete dialog.dataset.audio; });
  window.setInterval(() => {
    if (!player?.playing) return;
    const [minutes, seconds] = player.duration.split(':').map(Number);
    player.elapsed += 1;
    if (player.elapsed >= minutes * 60 + seconds) { player.elapsed = minutes * 60 + seconds; player.playing = false; }
    syncAudio();
  }, 1000);
  function measureDock() {
    const hasDock = !audio.hidden || !bookingDock.hidden;
    document.body.style.setProperty('--mobile-dock-height', hasDock && !document.body.classList.contains('has-form-focus') ? dock.getBoundingClientRect().height + 'px' : '0px');
  }
  new ResizeObserver(measureDock).observe(dock);
  function syncBookingDock() {
    const source = host.querySelector('.invite-reservation-footer button, .ticket-flow-footer .invite-button');
    bookingDock.hidden = !source || view === 'collection' || view === 'project' || view === 'confirmation';
    if (!bookingDock.hidden) {
      const button = bookingDock.querySelector('button');
      const chooseTickets = view === 'invite' && total() === 0;
      button.disabled = chooseTickets ? false : source.disabled;
      button.textContent = chooseTickets ? 'Choose tickets ↓' : source.textContent;
      bookingDock.querySelector('span').textContent = `${total()} ${total() === 1 ? 'ticket' : 'tickets'}`;
    }
    measureDock();
  }
  bookingDock.querySelector('button').addEventListener('click', () => {
    if (view === 'invite' && total() === 0) {
      const section = host.querySelector('.invite-detail__reservation');
      section.scrollIntoView({ block: 'start', behavior: 'instant' });
      const heading = section.querySelector('h2'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
    } else host.querySelector('.invite-reservation-footer button, .ticket-flow-footer .invite-button')?.click();
  });
  document.addEventListener('focusin', event => {
    if (event.target.matches('input, textarea, select')) { document.body.classList.add('has-form-focus'); measureDock(); }
  });
  document.addEventListener('focusout', () => requestAnimationFrame(() => {
    if (!document.activeElement.matches('input, textarea, select')) { document.body.classList.remove('has-form-focus'); measureDock(); }
  }));
  options.bindRow = (entry, section, row) => {
    rowRecords.set(entry, { row, section });
    if (!row.destination) entry.setAttribute('role', 'button');
    entry.addEventListener('focus', () => setPreview(previews.get(section), entry, true));
    entry.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse' && !event.buttons) setPreview(previews.get(section), entry, true);
    });
    entry.addEventListener('click', event => {
      event.preventDefault();
      setPreview(previews.get(section), entry, true);
      if (row.media?.kind === 'soundcloud') playRow(row);
      else if (section.classList.contains('collection-subsection--projects')) {
        currentProject = [0, 1, 2].find(i => data.project(i).title === titleFor(row)) || 0;
        navigate('project');
      } else if (row.media?.kind === 'image') imageDialog(titleFor(row), row.media.source);
      else readingDialog(titleFor(row));
    });
    if (!row.destination) entry.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); entry.click(); } });
  };
  function setPreview(preview, entry, explicit = false) {
    if (!preview) return;
    const row = rowRecords.get(entry)?.row;
    if (!row) return;
    if (explicit) {
      preview.dismissed = null;
      selectChapter(preview.tab.toLowerCase(), entry);
    }
    preview.selected = entry;
    const source = data.previewImage(row, preview.tab);
    for (const candidate of previews.values()) {
      const showing = candidate === preview && preview.dismissed !== entry;
      candidate.trigger.setAttribute('aria-expanded', String(showing));
      candidate.entries.forEach(item => item.classList.toggle('is-active', showing && item === entry));
    }
    if (preview.dismissed === entry) { previewWindow.hide(); return; }
    previewWindow.show({ source, title: titleFor(row), section: preview.tab, trigger: preview.trigger,
      expand: () => imageDialog(titleFor(row), source),
      dismiss: () => { preview.dismissed = entry; preview.trigger.setAttribute('aria-expanded', 'false'); preview.entries.forEach(item => item.classList.remove('is-active')); }
    });
  }
  function hidePreview() {
    previews.forEach(preview => {
      preview.trigger.setAttribute('aria-expanded', 'false');
      preview.entries.forEach(item => item.classList.remove('is-active'));
    });
    previewWindow.hide();
  }
  function selectChapter(id, entry) {
    chapterOverride = id; chapterOverrideScroll = scrollY; rowOverride = entry;
    scheduleScroll();
  }
  options.onRowsRendered = (target, collection, subsection) => {
    for (const [entry] of rowRecords) if (!entry.isConnected) rowRecords.delete(entry);
    const section = target.closest('.collection-subsection');
    section.querySelector('[data-section-preview]')?.remove(); previews.delete(section);
    const entries = [...target.querySelectorAll('.collection-row')];
    for (const entry of entries) {
      const columns = entry.querySelector('.collection-row__columns');
      const cells = [...columns.children];
      const visible = [...new Set([0, 1, cells.length - 1])].filter(index => index < cells.length);
      columns.dataset.mobileColumnCount = visible.length;
      cells.forEach((cell, index) => {
        cell.classList.toggle('mobile-column', visible.includes(index));
        cell.classList.toggle('mobile-column--date', index === 0);
        cell.classList.toggle('mobile-column--title', index === 1);
        cell.classList.toggle('mobile-column--final', index > 1 && index === cells.length - 1);
        cell.title = cell.dataset.fullValue;
      });
    }
    if (!entries.length) return;
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.dataset.sectionPreview = '';
    trigger.textContent = 'Preview ↗'; trigger.setAttribute('aria-label', `Show ${subsection.tab.toLowerCase()} preview window`);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'collection-image-window'); section.querySelector('h2').append(trigger);
    const preview = { trigger, tab: subsection.tab, entries, selected: entries[0], dismissed: null }; previews.set(section, preview);
    trigger.addEventListener('click', () => setPreview(preview, preview.selected, true));
    scheduleScroll();
  };
  options.onInvitesRendered = (target, events) => {
    for (const link of target.querySelectorAll('[data-collection-invite]')) {
      const event = events.find(event => event.id === link.dataset.collectionInvite);
      if (event) {
        const metadata = document.createElement('small'); metadata.className = 'mobile-invite-date';
        metadata.textContent = `${event.dateLabel}, ${event.startTime}`;
        link.querySelector('span').append(metadata);
      }
      link.href = urlFor('invite'); link.addEventListener('click', event => { event.preventDefault(); navigate('invite'); });
    }
  };
  function updateScroll() {
    scrollFrame = undefined;
    if (view !== 'collection') { hidePreview(); save(); return; }
    const welcomeState = home.querySelector('.collection-intro').dataset.welcomeState;
    nav.hidden = welcomeState !== 'complete' && !(welcomeState === 'static' && home.querySelector('.collection-poster').getBoundingClientRect().top <= 96);
    coverButton.hidden = welcomeState === 'complete';
    let current = 'invites';
    for (const id of chapterIds) if (home.querySelector('#' + id + '-title').getBoundingClientRect().top <= 96) current = id;
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = 'projects';
    // A compact final section cannot always reach the top of the viewport.
    // Keep an explicitly opened section selected until the document moves again.
    if (chapterOverride && Math.abs(scrollY - chapterOverrideScroll) > 2) { chapterOverride = undefined; rowOverride = undefined; }
    if (chapterOverride) current = chapterOverride;
    const label = nav.querySelector('[data-current-chapter]'); label.textContent = current[0].toUpperCase() + current.slice(1); label.href = '#' + current + '-title';
    const section = home.querySelector('.collection-subsection--' + current);
    const preview = previews.get(section);
    if (!preview || section.getBoundingClientRect().bottom < 49 || (nav.hidden && !preview.entries.includes(rowOverride))) hidePreview();
    else {
      const usableBottom = innerHeight - (!audio.hidden ? dock.getBoundingClientRect().height : 0) - 220;
      const usableTop = nav.getBoundingClientRect().bottom;
      const centre = (usableTop + usableBottom) / 2;
      const visible = preview.entries.filter(entry => { const r = entry.getBoundingClientRect(); return r.bottom > usableTop && r.top < usableBottom; });
      const nearest = visible.sort((a, b) => Math.abs(a.getBoundingClientRect().top + a.getBoundingClientRect().height / 2 - centre) - Math.abs(b.getBoundingClientRect().top + b.getBoundingClientRect().height / 2 - centre))[0];
      setPreview(preview, (preview.entries.includes(rowOverride) && rowOverride) || nearest || preview.selected);
    }
    save();
  }
  const scheduleScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); };
  // Welcome rendering and document scroll can settle in different animation frames.
  new MutationObserver(scheduleScroll).observe(home.querySelector('.collection-intro'), { attributes: true, attributeFilter: ['data-welcome-state'] });
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', () => { placeCoverButton(); scheduleScroll(); });
  window.addEventListener('collection-welcome-settled', scheduleScroll);
  const coverButton = document.createElement('button'); coverButton.type = 'button'; coverButton.className = 'mobile-cover-action';
  const coverLabel = document.createElement('span'); coverLabel.textContent = data.entrance === 'tap' ? 'Open collection' : 'Explore collection';
  const coverArrow = document.createElement('span'); coverArrow.textContent = '↓'; coverArrow.setAttribute('aria-hidden', 'true'); coverButton.append(coverLabel, coverArrow);
  home.querySelector('.collection-intro').append(coverButton);
  function placeCoverButton() { const artwork = home.querySelector('.collection-intro__artwork'); home.style.setProperty('--mobile-cover-button-top', artwork.offsetTop + artwork.offsetHeight + 16 + 'px'); }
  coverButton.addEventListener('click', async () => { await welcome.enter(); scheduleScroll(); home.querySelector('#invites-title').focus({ preventScroll: true }); });
  home.querySelector('#invites-title').tabIndex = -1;
  nav.querySelector('[data-index-toggle]').addEventListener('click', () => {
    const open = index.hidden; index.hidden = !open; nav.classList.toggle('is-expanded', open);
    nav.querySelector('button').setAttribute('aria-expanded', String(open)); nav.querySelector('button').textContent = open ? 'Index −' : 'Index +';
  });
  nav.addEventListener('keydown', event => { if (event.key === 'Escape') { closeIndex(); nav.querySelector('button').focus(); } });
  nav.addEventListener('click', async event => {
    const link = event.target.closest('a'); if (!link) return;
    event.preventDefault(); closeIndex();
    if (link.hasAttribute('data-cover-link')) {
      chapterOverride = undefined; rowOverride = undefined;
      if (welcome.cover) welcome.cover(); else scrollTo({ top: 0, behavior: 'instant' });
      placeCoverButton(); scheduleScroll(); coverButton.focus({ preventScroll: true });
    } else {
      await welcome.enter();
      const target = home.querySelector(link.getAttribute('href')); target.tabIndex = -1;
      target.scrollIntoView({ block: 'start', behavior: 'instant' }); target.focus({ preventScroll: true }); selectChapter(target.id.replace('-title', ''));
    }
  });
  function renderProject() {
    const temporary = document.createElement('div');
    window.CollectionProjects.render(temporary, data.project(currentProject), 'modular');
    const surface = temporary.querySelector('article');
    article.classList.toggle('has-image', surface.classList.contains('has-image'));
    host.append(...surface.children);
    host.querySelector('[data-collection-home]').href = urlFor('collection');
    host.querySelector('[data-collection-home]').addEventListener('click', event => { event.preventDefault(); navigate('collection', undefined, 'projects'); });
    host.querySelector('.project-detail__external')?.addEventListener('click', event => { event.preventDefault(); readingDialog('Sample external project'); });
    host.querySelector('.project-detail__image')?.addEventListener('error', () => { article.classList.remove('has-image'); host.querySelector('.project-detail__aside')?.remove(); }, { once: true });
  }
  function seed() {
    if (!total()) counts.general = 1;
    if (['overview', 'confirmation'].includes(view) && !details.email) details = { firstName: 'Jana', lastName: 'Franck', email: 'jana@example.com' };
    if (view === 'confirmation' && !confirmed) confirm();
  }
  function confirm() { confirmed = { event: data.event(), selection: selection(), details: { ...details }, orderId: 'SAMPLE-0127', timestamp: '2026-08-01T12:00:00Z' }; }
  function renderBooking() {
    const event = data.event();
    article.classList.add(view === 'invite' ? 'invite-detail' : 'ticket-detail');
    article.setAttribute(view === 'invite' ? 'data-invite-surface' : 'data-ticket-surface', '');
    if (view === 'invite') {
      const navigation = document.createElement('nav'); navigation.className = 'project-detail__nav'; navigation.setAttribute('aria-label', 'Event navigation');
      const back = document.createElement('a'); back.className = 'project-detail__back'; back.href = urlFor('collection'); back.textContent = '← Collection'; back.addEventListener('click', event => { event.preventDefault(); navigate('collection', undefined, 'invites'); });
      const signature = document.createElement('span'); signature.className = 'project-detail__signature'; signature.textContent = 'PERSPECTIVE'; navigation.append(back, signature);
      const content = document.createElement('div'); host.append(navigation, content);
      window.TZInviteDetail.render(content, event, { now: data.now, counts, details, separateDetails: true,
        onCountsChange: value => { counts = value; confirmed = null; syncBookingDock(); save(); },
        onContinue: () => navigate('details') });
    } else {
      seed();
      window.TZTicketing.render(host, view, { event, selection: selection(), details, confirmed }, {
        onDetailsChange: value => { details = value; confirmed = null; save(); },
        onDetails: value => { details = value; navigate('overview'); },
        onBack: next => navigate(next), onConfirm: () => { confirm(); navigate('confirmation'); },
        onSync: () => {}, onTicket: () => readingDialog('Sample ticket')
      });
      host.querySelectorAll('[data-ticket-back]').forEach(link => { link.href = urlFor(link.dataset.ticketBack); });
    }
    window.TZInviteExperience.arrangeSheet(host, article, event, selection(), view, { inviteUrl: urlFor('invite').href, onChangeTickets: () => navigate('invite') });
    const progress = document.createElement('ol'); progress.className = 'mobile-booking-progress'; progress.setAttribute('aria-label', 'Reservation progress');
    for (const [step, label] of [['invite', 'Tickets'], ['details', 'Your details'], ['overview', 'Review'], ['confirmation', 'Confirmation']]) {
      const item = document.createElement('li'); item.textContent = label; if (view === step) item.setAttribute('aria-current', 'step'); progress.append(item);
    }
    host.querySelector('.project-detail__nav').after(progress);
    if (view === 'confirmation') {
      const note = document.createElement('p'); note.className = 'mobile-sample-note'; note.textContent = 'Sample confirmation. No reservation has been sent.'; progress.after(note);
      host.querySelectorAll('[data-ticket-name]').forEach(button => { button.textContent = 'View sample'; });
    }
  }
  function renderPage() {
    closeIndex(); document.body.classList.remove('has-form-focus');
    home.hidden = view !== 'collection'; detail.hidden = view === 'collection'; nav.hidden = true;
    if (view === 'collection') { welcome.resume(); window.Collection.resume(); }
    else {
      welcome.suspend(); window.Collection.suspend();
      detail.className = 'collection-page project-detail-page' + (view === 'project' ? '' : ' booking-experience booking-sheet booking-sheet--ruled ' + (view === 'invite' ? 'invite-page' : 'ticket-page'));
      article.className = 'collection-poster project-detail project-detail--modular has-ground booking-frame';
      article.removeAttribute('data-invite-surface'); article.removeAttribute('data-ticket-surface'); host.replaceChildren();
      if (view === 'project') renderProject(); else renderBooking();
    }
    document.title = `${view === 'collection' ? 'PERSPECTIVE' : view === 'project' ? data.project(currentProject).title : view === 'invite' ? data.event().title : { details: 'Your details', overview: 'Review', confirmation: 'Sample confirmation' }[view]} — Mobile preview`;
    syncAudio(); syncBookingDock(); scheduleScroll();
    if (parent !== window) parent.postMessage({ type: 'perspective-view', view }, location.origin);
  }
  async function navigate(next, restore, returnChapter) {
    if (!views.includes(next) || busy) return;
    if (dialog.open) dialog.close();
    if (restore == null) save();
    const outgoing = view;
    busy = true;
    if (restore == null) history.pushState(null, '', urlFor(next, next === 'project' ? { project: currentProject } : {}));
    const change = () => {
      view = next; renderPage();
      window.scrollTo({ top: restore ?? (view === 'collection' ? homeScroll : 0), behavior: 'instant' });
    };
    try {
      if (outgoing !== 'collection' && next !== 'collection' && restore == null) await bookingMotion.transition(change, false, { focus: true });
      else {
        change();
        if (next === 'collection' && restore == null && returnChapter && homeScroll <= 1) {
          await welcome.enter();
          home.querySelector('#' + returnChapter + '-title').scrollIntoView({ block: 'start', behavior: 'instant' });
          selectChapter(returnChapter);
        }
      }
    } finally { busy = false; save(); scheduleScroll(); }
    if (next !== 'collection' && restore == null) { const heading = host.querySelector('h1, h2'); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true }); }
  }
  window.addEventListener('popstate', async () => {
    bookingMotion.cancel(); busy = false;
    const previous = new URLSearchParams(location.search);
    const next = previous.get('view') || 'collection';
    currentProject = Number(previous.get('project')) || 0;
    const entry = history.state?.mobilePreview;
    if (data.fixtures.includes(previous.get('fixture')) && previous.get('fixture') !== data.fixture) {
      data.setFixture(previous.get('fixture'));
      counts = entry?.counts || {}; details = entry?.details || {}; confirmed = entry?.confirmed || null;
      previews.forEach(preview => preview.trigger.remove()); previews.clear(); rowRecords.clear(); previewWindow.reset();
      await window.Collection.refresh();
    }
    if (entry?.homeScroll != null) homeScroll = entry.homeScroll;
    navigate(next, entry?.scroll || 0);
  });
  window.addEventListener('message', async event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'perspective-preview') return;
    if (event.data.fixture !== data.fixture && data.fixtures.includes(event.data.fixture)) {
      data.setFixture(event.data.fixture); counts = {}; details = {}; confirmed = null;
      previews.forEach(preview => preview.trigger.remove()); previews.clear(); rowRecords.clear(); previewWindow.reset();
      await window.Collection.refresh();
    }
    if (views.includes(event.data.view)) {
      if (view === event.data.view) { renderPage(); history.replaceState(history.state, '', urlFor(view)); save(); }
      else await navigate(event.data.view);
    }
  });
  window.addEventListener('pagehide', save);
  const ready = window.Collection.initialise(options);
  renderPage(); placeCoverButton();
  Promise.all([ready, welcome.ready, document.fonts.ready]).then(() => {
    // A replay can remove this iframe while fonts or image decoding are settling.
    if (!home.isConnected || !document.body) return;
    placeCoverButton();
    if (saved?.scroll != null) window.scrollTo({ top: saved.scroll, behavior: 'instant' });
    else if (location.hash) {
      const target = home.querySelector(location.hash);
      if (target) Promise.resolve(welcome.enter()).then(() => {
        target.scrollIntoView({ block: 'start', behavior: 'instant' }); selectChapter(target.id.replace('-title', ''));
      });
    }
    syncAudio(); scheduleScroll();
    document.body.dataset.mobilePreviewReady = 'true';
  });
})();

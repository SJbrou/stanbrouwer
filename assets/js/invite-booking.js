(function () {
  'use strict';

  var config = window.TZ_BOOKING_CONFIG;
  var controllers = new WeakMap();
  var paths = {};
  ['invite', 'details', 'overview', 'confirmation'].forEach(function (step) {
    paths[step] = new URL(config[step + 'Url'], window.location.href).pathname;
  });
  function stepFor(url) {
    return Object.keys(paths).find(function (step) { return paths[step] === url.pathname; });
  }
  function read(key) {
    try { return JSON.parse(sessionStorage.getItem('tz_' + key) || 'null'); } catch (_) { return null; }
  }
  function write(key, value) {
    try {
      if (value == null) sessionStorage.removeItem('tz_' + key);
      else sessionStorage.setItem('tz_' + key, JSON.stringify(value));
    } catch (_) { /* The current flow also works when browser storage is unavailable. */ }
  }
  function savedState() {
    return { event: read('event'), selection: read('selection') || [], details: read('details') || {}, confirmed: read('confirmed') };
  }
  function complete(details) {
    return details && ['firstName', 'lastName', 'email'].every(function (key) { return typeof details[key] === 'string' && details[key].trim(); }) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email);
  }
  function create(page) {
    var article = page.querySelector('.booking-frame');
    var pane = page.querySelector('.booking-content');
    var host = page.querySelector('.booking-host');
    var motion = window.TZInviteExperience.createMotion(article, pane);
    var state = savedState();
    var version = 0;
    var busy = false;
    var pending;
    var currentStep = 'invite';
    var navigationVersion = 0;
    var renderedUrl;

    function saveScroll() {
      if (busy || page.hidden || renderedUrl !== location.href || window.CollectionPageTransition.isRestoring(page)
        || document.body.classList.contains('is-collection-navigating')) return;
      history.replaceState(Object.assign({}, history.state, {
        collectionView: Object.assign({}, history.state?.collectionView, { scroll: scrollY })
      }), '', location.href);
    }

    function persist() {
      ['event', 'selection', 'details', 'confirmed'].forEach(function (key) { write(key, state[key]); });
    }
    function route(step) {
      var url = new URL(config[step + 'Url'], location.href);
      if (state.event?.id) url.searchParams.set('event', state.event.id);
      return url;
    }
    function chrome(step) {
      currentStep = step;
      page.classList.toggle('invite-page', step === 'invite');
      page.classList.toggle('ticket-page', step !== 'invite');
      article.classList.toggle('invite-detail', step === 'invite');
      article.classList.toggle('ticket-poster', step !== 'invite');
      article.classList.toggle('ticket-detail', step !== 'invite');
      article.toggleAttribute('data-invite-surface', step === 'invite');
      article.toggleAttribute('data-ticket-surface', step !== 'invite');
      article.classList.remove('has-image');
      host.replaceChildren();
    }
    function inviteHost() {
      var nav = document.createElement('nav');
      nav.className = 'project-detail__nav';
      nav.setAttribute('aria-label', 'Event navigation');
      nav.innerHTML = '<a class="project-detail__back" data-collection-home href="' + window.TZInvites.escapeAttribute(config.homeUrl + '#collection-invites') + '">← COLLECTION</a><span class="project-detail__signature">PERSPECTIVE</span>';
      var content = document.createElement('div');
      content.id = 'invite-content';
      content.className = 'invite-content';
      host.append(nav, content);
      return content;
    }
    function metadata(url) {
      var titles = { details: 'Your details', overview: 'Review reservation', confirmation: 'Reservation confirmed' };
      document.title = (titles[currentStep] || state.event?.title || 'Invite') + ' - ' + config.siteTitle;
      var canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = url.href;
    }
    function notify(url) {
      window.dispatchEvent(new CustomEvent('tz-booking-route', { detail: { url: url.href } }));
    }
    function message(title, copy, retry) {
      chrome('invite');
      window.TZInviteDetail.message(inviteHost(), title, copy, config.homeUrl + '#collection-invites', retry);
    }
    function render(step, url) {
      renderedUrl = url.href;
      chrome(step);
      if (step === 'invite') {
        var counts = Object.fromEntries(state.selection.map(function (ticket) { return [ticket.id, ticket.count]; }));
        window.TZInviteDetail.render(inviteHost(), state.event, {
          counts: counts, separateDetails: true,
          onCountsChange: function (next) {
            state.selection = state.event.ticketTypes.filter(function (ticket) { return next[ticket.id] > 0; }).map(function (ticket) { return Object.assign({}, ticket, { count: next[ticket.id] }); });
            state.confirmed = null;
            persist();
          },
          onContinue: function (reservation) {
            state.selection = reservation.selection;
            state.confirmed = null;
            persist();
            navigate(route('details'));
          }
        });
      } else {
        if (step === 'overview' && !complete(state.details)) {
          window.TZTicketing.render(host, step, Object.assign({}, state, { details: null }));
        } else window.TZTicketing.render(host, step, state, {
          onDetailsChange: function (details) { state.details = details; state.confirmed = null; persist(); },
          onDetails: function (details) { state.details = details; persist(); navigate(route('overview')); },
          onBack: function (destination) { navigate(route(destination)); },
          onConfirm: function (reservation) {
            if (!state.confirmed) state.confirmed = Object.assign({}, reservation, {
              orderId: 'ORD-' + Date.now().toString(36).toUpperCase(), timestamp: new Date().toISOString()
            });
            persist();
            navigate(route('confirmation'));
          },
          onTicket: window.TZTicketing.downloadTicket,
          onSync: window.TZTicketing.syncReservation
        });
        host.querySelectorAll('[data-ticket-back]').forEach(function (link) { link.href = route(link.getAttribute('data-ticket-back')).href; });
        var statusLink = host.querySelector('.ticket-status a');
        if (statusLink) {
          statusLink.href = state.event ? route('invite').href : config.homeUrl + '#collection-invites';
          statusLink.textContent = state.event ? 'Back to invite' : 'Back to collection';
          if (state.event) statusLink.addEventListener('click', function (click) {
            if (click.button || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
            click.preventDefault(); navigate(route('invite'));
          });
          else statusLink.setAttribute('data-collection-home', '');
        }
      }
      window.TZInviteExperience.arrangeSheet(host, article, state.event, state.selection, step, {
        keepSyncNotice: true, inviteUrl: route('invite').href,
        onChangeTickets: function () { navigate(route('invite')); }
      });
      page.setAttribute('aria-busy', 'false');
      article.setAttribute('aria-busy', 'false');
      if (!page.hidden) metadata(url);
    }
    function matching(url) { return !url.searchParams.get('event') || url.searchParams.get('event') === state.event?.id; }

    async function show(url) {
      url = new URL(url, location.href);
      var request = ++version;
      var step = stepFor(url);
      if (!step) return;
      if (step !== 'invite') {
        state = savedState();
        if (!matching(url)) state = { event: null, selection: [], details: {}, confirmed: null };
        render(step, url);
        return;
      }
      var id = url.searchParams.get('event');
      if (!id) { message('Choose an invite', 'Return to the collection to choose an event.'); return; }
      message('Loading invite', 'Reading the event details.');
      page.setAttribute('aria-busy', 'true');
      article.setAttribute('aria-busy', 'true');
      try {
        var events = await window.TZInvites.load();
        if (request !== version) return;
        var event = events.find(function (candidate) { return candidate.id === id && candidate.publish; });
        if (!event) { message('Invite not found', 'This event may no longer be available.'); return; }
        var previous = state.event?.id === id ? state : savedState();
        state = previous.event?.id === id ? previous : { selection: [], details: {}, confirmed: null };
        state.event = event;
        // Refresh prices and limits from the invite before reusing a saved selection.
        state.selection = event.ticketTypes.map(function (ticket) {
          var chosen = state.selection.find(function (saved) { return saved.id === ticket.id; });
          return Object.assign({}, ticket, { count: Math.max(0, Math.min(ticket.max, Number(chosen?.count) || 0)) });
        }).filter(function (ticket) { return ticket.count > 0; });
        persist();
        render('invite', url);
      } catch (error) {
        if (request !== version) return;
        console.warn('Invite load failed:', error);
        message('Invite unavailable', 'The event details could not be loaded. Please try again.', function () { show(url); });
      }
    }

    async function navigate(url, options) {
      url = new URL(url, location.href);
      options = options || {};
      if (busy) { pending = { url: url, options: options }; return; }
      if (!options.pop) saveScroll();
      busy = true;
      var navigation = ++navigationVersion;
      ++version;
      var top = options.pop ? options.state?.scroll ?? history.state?.collectionView?.scroll ?? 0 : 0;
      if (!options.pop) history.pushState(Object.assign({}, history.state, {
        collectionView: Object.assign({}, history.state?.collectionView, { scroll: 0 })
      }), '', url.href);
      notify(url);
      var loading, restoration;
      await motion.transition(async function () {
        if (navigation !== navigationVersion) return;
        if (matching(url) && state.event) render(stepFor(url), url);
        else loading = show(url);
        restoration = window.CollectionPageTransition.restoreScroll(page, top);
        if (loading) {
          var ready = false;
          loading.then(function () { ready = true; });
          await Promise.race([loading, new Promise(function (resolve) { setTimeout(resolve, 2200); })]);
          if (!ready) {
            loading.then(async function () {
              if (navigation === navigationVersion) { await restoration.finish(); saveScroll(); }
            });
            return;
          }
        }
        if (navigation === navigationVersion) await restoration.finish();
      }, !options.pop);
      if (navigation !== navigationVersion) return;
      if (!page.hidden && location.href === url.href) { metadata(url); notify(url); }
      busy = false;
      saveScroll();
      if (pending) {
        var next = pending;
        pending = null;
        if (!page.hidden) navigate(next.url, next.options);
      }
    }
    return {
      show: show, navigate: navigate, saveScroll: saveScroll,
      cancel: function () {
        ++version;
        ++navigationVersion;
        pending = null;
        busy = false;
        window.CollectionPageTransition.cancelRestore(page);
        motion.cancel();
      }
    };
  }
  function controller(page) {
    if (!controllers.has(page)) controllers.set(page, create(page));
    return controllers.get(page);
  }
  window.TZBooking = {
    isUrl: function (url) { return url.origin === location.origin && !!stepFor(url); },
    showUrl: function (page, url) { return controller(page).show(url); },
    navigate: function (page, url, options) { return controller(page).navigate(url, options); },
    cancel: function (page) { controllers.get(page)?.cancel(); }
  };
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.querySelector('[data-booking-page]');
    if (!page || window.CollectionBookingNavigation) return;
    history.scrollRestoration = 'manual';
    var booking = controller(page);
    var loaded = booking.show(new URL(location.href));
    var restoration = window.CollectionPageTransition.restoreScroll(page, history.state?.collectionView?.scroll ?? 0);
    loaded.then(async function () { await restoration.finish(); booking.saveScroll(); });
    var scrollFrame;
    window.addEventListener('scroll', function () {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(function () { scrollFrame = null; booking.saveScroll(); });
    }, { passive: true });
    window.addEventListener('pagehide', booking.saveScroll);
    window.addEventListener('popstate', function (event) {
      var url = new URL(location.href);
      if (window.TZBooking.isUrl(url)) booking.navigate(url, { pop: true, state: event.state?.collectionView });
      else location.assign(url.href);
    });
  });
})();

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var stage = document.querySelector('[data-invite-preview-stage]');
    if (!stage) return;
    var config = window.COLLECTION_PROJECTS_CONFIG;
    var api = window.TZInvites;
    var params = new URLSearchParams(window.location.search);
    var layouts = {
      detail: 'Detail sheet: the project detail header, a larger image, and one column aligned with the left edge of the frame.',
      side: 'Side column: the same detail header, with the event story and booking action beside each other.',
      ruled: 'Ruled sheet: the same detail header, with full-width sections and rows that follow the collection page.',
      quiet: 'Quiet column: the earlier narrow column and small image, for comparison.'
    };
    var views = ['invite', 'details', 'overview', 'confirmation', 'reference'];
    var fixtures = ['open', 'closed', 'no-image', 'long'];
    var layout = Object.hasOwn(layouts, params.get('layout')) ? params.get('layout') : 'ruled';
    var motion = 'point';
    var view = views.includes(params.get('view')) ? params.get('view') : 'invite';
    var fixture = fixtures.includes(params.get('fixture')) ? params.get('fixture') : 'closed';
    var state;
    // A fixed clock makes the open and closed examples independent of today's date.
    var now = new Date('2026-08-01T12:00:00Z');
    var viewControl = document.querySelector('[data-preview-view]');
    var fixtureControl = document.querySelector('[data-preview-fixture]');
    var description = document.querySelector('[data-preview-description]');
    var layoutControl = document.querySelector('[data-preview-layout]');
    var controls = document.querySelector('.invite-preview-controls');
    var busy = false;
    var lastActionPoint = null;
    var article = document.createElement('article');
    var pane = document.createElement('div');
    var host = document.createElement('div');
    var focal = document.createElement('div');
    article.className = 'collection-poster project-detail project-detail--modular has-ground booking-frame';
    pane.className = 'booking-content';
    host.className = 'booking-host';
    focal.className = 'booking-focal';
    focal.setAttribute('aria-hidden', 'true');
    focal.innerHTML = '<span class="booking-focal__point"></span><span class="booking-focal__label">PERSPECTIVE</span>';
    pane.append(host);
    article.append(pane, focal);
    stage.replaceChildren(article, ground());
    var bookingMotion = window.TZInviteExperience.createMotion(article, pane);

    // Keep the preview toolbar outside the naturally growing paper.
    new ResizeObserver(function () {
      stage.style.setProperty('--booking-toolbar-height', controls.getBoundingClientRect().height + 'px');
    }).observe(controls);
    pane.addEventListener('click', function (event) {
      var action = event.target.closest('button, a');
      if (action) lastActionPoint = actionPoint(action, event);
    }, true);
    pane.addEventListener('submit', function (event) {
      lastActionPoint = actionPoint(event.submitter || event.target.querySelector('button[type="submit"]'));
    }, true);
    function actionPoint(element, event) {
      if (event?.detail && event.clientX) return { x: event.clientX, y: event.clientY };
      var rect = element?.getBoundingClientRect();
      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    }

    function example(name) {
      var event = {
        id: 'preview-de-loods', title: 'Summer Evening', publish: true,
        dateIso: '2026-08-15', dateLabel: 'Sat 15 Aug 2026', startTime: '18:00', endTime: '23:00',
        location: 'De Loods, Hoorn', address: '', heroImage: config.exampleImage,
        introMarkdown: '**An evening together.**',
        detailsMarkdown: 'Join us for food, drinks, and music at De Loods.',
        ticketingOpen: '2026-07-01T00:00:00Z', ticketingClose: '2026-08-15T18:00:00Z',
        ticketTypes: [
          { id: 'general', name: 'General admission', descriptionMarkdown: 'An evening at De Loods. Food, music, and good company.', price: '€12.50', max: 4 },
          { id: 'supporter', name: 'Supporter', descriptionMarkdown: 'A little extra support for the next gathering.', price: '€20', max: 2 }
        ]
      };
      if (name === 'closed') event.ticketingClose = '2026-07-31T18:00:00Z';
      if (name === 'no-image') event.heroImage = '';
      if (name === 'long') {
        event.title = 'An evening of listening, making, and neighbourhood stories.';
        event.introMarkdown = '**A gathering for curious neighbours.**';
        event.detailsMarkdown = 'Some evenings need a little more room. We are opening the doors at De Loods for a shared meal, new music, and conversations that carry on long after the last song.\n\nCome on your own, bring a friend, or meet someone new at the table. The programme moves between listening sessions and small hands-on workshops.\n\n### Good to know\n\n- Doors open at 18:00; dinner starts at 19:00.\n- Vegetarian food and alcohol-free drinks are available.\n- The venue has step-free access. Let us know if you need a hand.\n\nEvery ticket includes the full evening. Supporter tickets help us keep future gatherings accessible.';
        event.ticketTypes.push({ id: 'community', name: 'Community / reduced admission', descriptionMarkdown: 'For anyone who would benefit from a lower price. No questions asked.', price: '€5', max: 3 });
      }
      return event;
    }

    function reset() {
      state = { event: example(fixture), counts: {}, details: {}, confirmed: null };
    }

    function selection() {
      return state.event.ticketTypes.filter(function (ticket) { return state.counts[ticket.id] > 0; }).map(function (ticket) {
        return Object.assign({}, ticket, { count: state.counts[ticket.id] });
      });
    }

    function seed(includeDetails) {
      if (!selection().length) state.counts.general = 2;
      if (includeDetails && !state.details.firstName && !state.details.lastName && !state.details.email) {
        state.details = { firstName: 'Jana', lastName: 'Franck', email: 'jana@example.com' };
      }
      if (view === 'confirmation' && !state.confirmed) confirm();
    }

    function confirm() {
      state.confirmed = {
        event: state.event, selection: selection(), details: Object.assign({}, state.details),
        orderId: 'DEMO-0127', timestamp: '2026-08-01T12:00:00Z'
      };
    }

    async function transition(change, focus, origin) {
      if (busy) return;
      busy = true;
      controls.querySelectorAll('select, button').forEach(function (control) { control.disabled = true; });
      controls.querySelector('details').inert = true;
      try {
        await bookingMotion.transition(function () {
          change();
          render();
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, false, { origin: origin, focus: focus });
      } finally {
        controls.querySelectorAll('select, button').forEach(function (control) { control.disabled = false; });
        controls.querySelector('details').inert = false;
        busy = false;
      }
    }

    function navigate(next, focus, demo) {
      var origin = lastActionPoint;
      lastActionPoint = null;
      return transition(function () {
        view = next;
        if (demo && view !== 'invite' && view !== 'reference') seed(true);
      }, focus, origin);
    }

    function ground() {
      var footer = document.createElement('footer');
      footer.className = 'collection-outro project-detail__ground invite-outro';
      footer.setAttribute('aria-hidden', 'true');
      var image = document.createElement('img');
      image.className = 'collection-outro__image project-detail__ground-image';
      image.src = config.transitionGridImage;
      image.alt = '';
      footer.append(image);
      return footer;
    }

    function sampleTicket(confirmed, name, count) {
      stage.querySelector('.invite-preview-sample-ticket')?.remove();
      var ticket = document.createElement('section');
      ticket.className = 'invite-preview-sample-ticket';
      ticket.tabIndex = -1;
      ticket.setAttribute('aria-label', 'Sample ticket');
      ticket.innerHTML = '<p class="invite-kicker">SAMPLE TICKET</p><h3>' + api.escapeHtml(confirmed.event.title) + '</h3>' +
        '<p>' + api.escapeHtml(name) + ' × ' + api.escapeHtml(count) + '</p>' +
        '<p>' + api.escapeHtml(confirmed.details.firstName + ' ' + confirmed.details.lastName) + ' / ' + api.escapeHtml(confirmed.orderId) + '</p>' +
        '<p>This example is not valid for admission.</p><button type="button">Close sample</button>';
      host.querySelector('.ticket-confirmation .booking-action').append(ticket);
      ticket.querySelector('button').addEventListener('click', function () {
        ticket.remove();
        stage.querySelector('[data-ticket-name]')?.focus();
      });
      ticket.focus({ preventScroll: true });
      ticket.scrollIntoView({ block: 'nearest' });
    }

    function arrangeContent() {
      var inviteUrl = new URL(window.location.href);
      inviteUrl.searchParams.set('view', 'invite');
      var arrange = layout === 'quiet' ? window.TZInviteExperience.arrange : window.TZInviteExperience.arrangeSheet;
      arrange(host, article, state.event, selection(), view, {
        inviteUrl: inviteUrl.href, onChangeTickets: function () { navigate('invite', true); }
      });
    }

    function render() {
      stage.removeAttribute('data-project-page');
      stage.className = 'collection-page project-detail-page booking-experience invite-preview invite-preview--' + layout;
      if (layout !== 'quiet' || view === 'reference') stage.classList.add('booking-sheet');
      if (layout === 'ruled') stage.classList.add('booking-sheet--ruled');
      article.className = 'collection-poster project-detail project-detail--modular has-ground booking-frame';
      article.removeAttribute('data-invite-surface');
      article.removeAttribute('data-ticket-surface');
      article.removeAttribute('data-event-id');
      layoutControl.value = layout;
      viewControl.value = view;
      fixtureControl.value = fixture;
      description.textContent = view === 'reference' ? 'The project detail content, inside the same frame.' : layouts[layout];
      var url = new URL(window.location.href);
      url.search = new URLSearchParams({ layout: layout, motion: motion, view: view, fixture: fixture }).toString();
      history.replaceState(null, '', url);
      host.replaceChildren();

      if (view === 'reference') {
        stage.setAttribute('data-project-page', '');
        stage.classList.add('invite-preview--reference');
        var reference = window.CollectionProjects.examples[fixture === 'long' ? 'long' : fixture === 'no-image' ? 'text' : 'image'];
        var temporary = document.createElement('div');
        window.CollectionProjects.render(temporary, reference, 'modular');
        var surface = temporary.querySelector('article');
        article.classList.toggle('has-image', surface.classList.contains('has-image'));
        host.append.apply(host, Array.from(surface.children));
        return;
      }

      if (view === 'invite') {
        stage.classList.add('invite-page');
        article.classList.add('invite-detail');
        article.setAttribute('data-invite-surface', '');
        var nav = document.createElement('nav');
        nav.className = 'project-detail__nav';
        nav.setAttribute('aria-label', 'Event navigation');
        nav.innerHTML = '<a class="project-detail__back" href="' + api.escapeAttribute(config.homeUrl) + '">← COLLECTION</a><span class="project-detail__signature">PERSPECTIVE</span>';
        var inviteContent = document.createElement('div');
        host.append(nav, inviteContent);
        window.TZInviteDetail.render(inviteContent, state.event, {
          now: now, counts: state.counts, details: state.details, separateDetails: true,
          onCountsChange: function (counts) { state.counts = counts; state.confirmed = null; },
          onDetailsChange: function (details) { state.details = details; state.confirmed = null; },
          onContinue: function () { navigate('details', true); }
        });
      } else {
        seed(false);
        stage.classList.add('ticket-page');
        article.classList.add('ticket-poster', 'ticket-detail');
        article.setAttribute('data-ticket-surface', '');
        window.TZTicketing.render(host, view, {
          event: state.event, selection: selection(), details: state.details, confirmed: state.confirmed
        }, {
          onDetailsChange: function (details) { state.details = details; state.confirmed = null; },
          onDetails: function (details) { state.details = details; navigate('overview', true); },
          onBack: function (destination) { navigate(destination, true); },
          onConfirm: function () { confirm(); navigate('confirmation', true); },
          onTicket: sampleTicket,
          onSync: function () {}
        });
        host.querySelectorAll('[data-ticket-back]').forEach(function (link) {
          var destination = new URL(url);
          destination.searchParams.set('view', link.getAttribute('data-ticket-back'));
          link.href = destination.href;
        });
        host.querySelectorAll('[data-ticket-name]').forEach(function (button) { button.textContent = 'View sample'; });
      }
      arrangeContent();
    }

    layoutControl.addEventListener('change', function () {
      var next = layoutControl.value;
      transition(function () { layout = next; }, false);
    });
    document.querySelector('[data-preview-replay]').addEventListener('click', function () {
      transition(function () {}, false);
    });
    document.querySelector('[data-preview-next]').addEventListener('click', function () {
      var sequence = ['invite', 'details', 'overview', 'confirmation'];
      navigate(sequence[(sequence.indexOf(view) + 1) % sequence.length], false, true);
    });
    viewControl.addEventListener('change', function () {
      navigate(viewControl.value, false, true);
    });
    fixtureControl.addEventListener('change', function () {
      var next = fixtureControl.value;
      transition(function () {
        fixture = next;
        reset();
        if (view !== 'invite' && view !== 'reference') seed(true);
      }, false);
    });
    reset();
    if (view !== 'invite' && view !== 'reference') seed(true);
    render();
  });
})();

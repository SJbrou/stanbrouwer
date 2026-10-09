(function () {
  'use strict';

  // Shared composition keeps the design preview and the real booking pages identical.
  function arrange(host, article, event, selection, step, options) {
    options = options || {};
    host.querySelector('.ticket-progress')?.remove();
    host.querySelectorAll('.ticket-section-heading .invite-kicker, .ticket-confirmation__heading .invite-kicker, .project-detail__nav .project-detail__meta-row, .invite-ticket-row__type > small').forEach(function (node) { node.remove(); });
    if (!options.keepSyncNotice) host.querySelector('[data-sync]')?.remove();
    if (step === 'invite') {
      var content = host.querySelector('.invite-detail__content');
      if (!content) return;
      var header = content.querySelector('.project-detail__header');
      var about = content.querySelector('.invite-detail__section:not(.invite-detail__reservation)');
      var reservation = content.querySelector('.invite-detail__reservation');
      if (about) {
        about.querySelector('h2')?.remove();
        about.removeAttribute('aria-labelledby');
        about.setAttribute('aria-label', 'About this event');
      }
      var lead = document.createElement('div');
      lead.className = 'booking-lead';
      lead.append(header);
      var meta = document.createElement('p');
      meta.className = 'booking-event-meta';
      var time = [event.startTime, event.endTime].filter(Boolean).join(' – ');
      var location = [event.location, event.address && event.address !== event.location ? event.address : ''].filter(Boolean).join(', ');
      meta.textContent = [event.dateLabel || event.dateIso, time, location].filter(Boolean).join(' / ');
      lead.append(meta);
      if (about) lead.append(about);
      reservation.classList.add('booking-action');
      reservation.querySelector('h2').textContent = 'Choose your tickets.';
      var next = reservation.querySelector('button[type="submit"]');
      if (next) next.textContent = 'Next: your details →';
      content.classList.add('booking-layout-body');
      content.replaceChildren(lead, reservation);
      return;
    }
    host.querySelector('.ticket-event-header__figure')?.remove();
    article.classList.remove('has-image');
    var section = host.querySelector('.ticket-flow-section, .ticket-confirmation');
    if (!section) return;
    var heading = section.querySelector('.ticket-section-heading, .ticket-confirmation__heading');
    var action = document.createElement('div');
    action.className = 'booking-action';
    section.querySelectorAll('.ticket-flow-section > .ticket-table-wrap').forEach(function (node) { node.remove(); });
    if (step === 'details') {
      var note = document.createElement('p');
      note.className = 'booking-selection-note';
      var total = selection.reduce(function (sum, ticket) { return sum + Number(ticket.count); }, 0);
      note.append(total + (total === 1 ? ' ticket selected. ' : ' tickets selected. '));
      var link = document.createElement('a');
      link.href = options.inviteUrl;
      link.textContent = 'Change tickets';
      link.addEventListener('click', function (click) {
        if (click.button || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
        click.preventDefault();
        options.onChangeTickets();
      });
      note.append(link);
      heading.append(note);
    }
    Array.from(section.children).forEach(function (node) { if (node !== heading) action.append(node); });
    heading.classList.add('booking-lead');
    section.classList.add('booking-layout-body');
    section.replaceChildren(heading, action);
    host.querySelectorAll('.ticket-table__description, .ticket-table tbody th small, .ticket-review__tickets > h3, .ticket-confirmation__tickets > h3').forEach(function (node) { node.remove(); });
  }

  // The selected sheet composition is shared by the preview and every live booking step.
  function arrangeSheet(host, article, event, selection, step, options) {
    var content = host.querySelector('.invite-detail__content, .ticket-flow-section, .ticket-confirmation');
    if (!content || !event) return;
    var figure = step !== 'invite' ? host.querySelector('.ticket-event-header__figure') : null;
    figure?.remove();
    arrange(host, article, event, selection, step, options);
    addSheetMetadata(host, event);
    var lead = content.querySelector('.booking-lead');
    var action = content.querySelector('.booking-action');
    var header;
    if (step === 'invite') {
      header = lead.querySelector('.project-detail__header');
      lead.querySelector('.booking-event-meta')?.remove();
    } else {
      header = document.createElement('header');
      header.className = 'project-detail__header';
      var eventHeader = host.querySelector('.ticket-event-header');
      var eventTitle = eventHeader.querySelector('h1');
      eventTitle.classList.add('booking-sheet-context');
      header.append(eventTitle);
      eventHeader.remove();
      var headingRow = document.createElement('div');
      headingRow.className = 'project-detail__heading-row';
      headingRow.append(lead.querySelector('h2'));
      if (figure) headingRow.append(figure);
      header.append(headingRow);
      article.classList.toggle('has-image', !!figure);
    }
    header.classList.add('booking-sheet-header');
    var columns = document.createElement('div');
    columns.className = 'booking-sheet-columns';
    columns.append(lead, action);
    content.replaceChildren(header, columns);
  }

  function addSheetMetadata(host, event) {
    var nav = host.querySelector('.project-detail__nav');
    var row = document.createElement('div');
    row.className = 'project-detail__meta-row booking-sheet-meta';
    var list = document.createElement('dl');
    list.className = 'project-detail__meta';
    var location = [event.location, event.address && event.address !== event.location ? event.address : ''].filter(Boolean).join(', ');
    [
      ['Date', event.dateLabel || event.dateIso],
      ['Time', [event.startTime, event.endTime].filter(Boolean).join(' – ')],
      ['Location', location]
    ].forEach(function (entry) {
      if (!entry[1]) return;
      var item = document.createElement('div');
      var label = document.createElement('dt');
      label.className = 'project-detail__meta-label';
      label.textContent = entry[0];
      var value = document.createElement('dd');
      value.textContent = entry[1];
      item.append(label, value);
      list.append(item);
    });
    row.append(list);
    var signature = nav.querySelector('.project-detail__signature');
    signature.textContent = 'PERSPECTIVE';
    nav.insertBefore(row, signature);
  }

  function createMotion(article, pane) {
    var page = article.closest('.collection-page');
    var renderer = window.CollectionPageTransition;
    var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    var lastPoint;
    var running;
    function interrupt() { if (running) { running.interrupted = true; running.finish?.(); } }
    function cancel() {
      if (!running) return;
      running.cancelled = true;
      interrupt();
      running.cleanup();
      running = null;
    }
    window.addEventListener('resize', interrupt);
    document.addEventListener('visibilitychange', function () { if (document.hidden) interrupt(); });
    preference.addEventListener('change', interrupt);
    function capture(element, click) {
      var rect = element?.getBoundingClientRect();
      lastPoint = click?.detail ? { x: click.clientX, y: click.clientY }
        : rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    }
    pane.addEventListener('click', function (click) {
      var action = click.target.closest('a, button');
      if (action) capture(action, click);
    }, true);
    pane.addEventListener('submit', function (submit) {
      capture(submit.submitter || submit.target.querySelector('button[type="submit"]'));
    }, true);
    return {
      cancel: cancel,
      transition: async function (change, useActionPoint, options) {
        if (running) return;
        options = options || {};
        var task = { interrupted: false, cancelled: false };
        running = task;
        var origin = options.origin || (useActionPoint ? lastPoint : null);
        lastPoint = null;
        var transition;
        var unlock;
        var previousInert = pane.inert;
        var cleaned = false;
        task.cleanup = function () {
          if (cleaned) return;
          cleaned = true;
          transition?.overlay.remove();
          unlock?.();
          delete article.dataset.motion;
          delete article.dataset.transitionPhase;
          pane.inert = previousInert;
          article.setAttribute('aria-busy', 'false');
        };
        function animate(duration, draw) {
          return new Promise(function (resolve) {
            var frame, watchdog, done = false;
            function finish() {
              if (done) return;
              done = true;
              cancelAnimationFrame(frame);
              clearTimeout(watchdog);
              if (!task.cancelled) draw(1);
              task.finish = null;
              resolve();
            }
            task.finish = finish;
            if (task.interrupted || preference.matches) { finish(); return; }
            draw(0);
            var start = performance.now();
            function tick(now) {
              var progress = Math.min(1, (now - start) / duration);
              draw(progress);
              if (progress === 1 || task.interrupted) finish();
              else frame = requestAnimationFrame(tick);
            }
            watchdog = setTimeout(finish, duration + 100);
            frame = requestAnimationFrame(tick);
          });
        }
        pane.inert = true;
        article.setAttribute('aria-busy', 'true');
        var changed = false;
        async function apply() {
          if (changed || task.cancelled) return;
          changed = true;
          await change();
          if (!task.cancelled) article.setAttribute('aria-busy', 'true');
        }
        try {
          if (preference.matches || document.hidden || !window.CSS?.supports('clip-path', 'inset(0)')) await apply();
          else {
            var start = renderer.visibleFrame(page);
            var point = origin || { x: start.x + start.width / 2, y: start.y + start.height / 2 };
            point = { x: Math.max(8, Math.min(innerWidth - 8, point.x)), y: Math.max(8, Math.min(innerHeight - 8, point.y)) };
            var dot = { x: point.x - 3, y: point.y - 3, width: 6, height: 6 };
            // Capture the visible document before its height or scroll changes.
            transition = renderer.create(page, 'point');
            unlock = renderer.lockScroll();
            article.dataset.motion = 'point';
            article.dataset.transitionPhase = transition.overlay.dataset.transitionPhase = 'leaving';
            await animate(480, function (p) {
              var eased = renderer.ease(p);
              transition.point(renderer.mix(start, dot, eased), point, eased, 1 - eased, eased);
            });
            if (task.cancelled) return;
            article.dataset.transitionPhase = transition.overlay.dataset.transitionPhase = 'point';
            await Promise.all([apply(), animate(160, function () {})]);
            if (task.cancelled) return;
            transition.capture(page);
            transition.arrive(page);
            var target = renderer.visibleFrame(page);
            article.dataset.transitionPhase = transition.overlay.dataset.transitionPhase = 'entering';
            await animate(600, function (p) {
              var eased = renderer.ease(p);
              transition.point(renderer.mix(dot, target, eased), point, 1 - eased, eased, 1 - eased, p);
            });
          }
        } catch (error) {
          console.warn('Booking transition interrupted:', error);
          await apply();
        } finally {
          task.cleanup();
          if (running === task) running = null;
          if (!task.cancelled && options.focus !== false && !page.hidden) {
            var heading = pane.querySelector('.ticket-flow-section h2, .ticket-confirmation h2') || pane.querySelector('h1');
            if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
          }
        }
      }
    };
  }

  window.TZInviteExperience = { arrange: arrange, arrangeSheet: arrangeSheet, createMotion: createMotion };
})();

(function () {
  'use strict';

  var utils = function () { return window.TZInvites; };

  function renderMessage(container, title, copy, href, retry) {
    var api = utils();
    var surface = container.closest('[data-invite-surface]');
    var section = document.createElement('section');
    var heading = document.createElement('h1');
    var paragraph = document.createElement('p');
    section.className = 'project-detail__body project-detail__notice invite-message';
    heading.className = 'project-detail__title';
    heading.tabIndex = -1;
    heading.textContent = title;
    paragraph.textContent = copy;
    section.append(heading, paragraph);
    if (retry) {
      var button = document.createElement('button');
      button.className = 'project-detail__retry';
      button.type = 'button';
      button.textContent = 'Try again';
      button.addEventListener('click', retry, { once: true });
      section.append(button);
    }
    container.replaceChildren(section);
    container.setAttribute('aria-busy', 'false');
    surface?.querySelector('.invite-detail__meta-row')?.remove();
    surface?.classList.remove('has-image');
    surface?.removeAttribute('data-event-id');
    surface?.setAttribute('aria-busy', 'false');
    container.closest('[data-invite-page]')?.setAttribute('aria-busy', 'false');
    if (api && href) {
      var back = surface?.querySelector('[data-collection-home]');
      if (back) back.href = href;
    }
  }

  function markdown(value) {
    return value ? '<div class="invite-markdown">' + utils().renderMarkdown(value) + '</div>' : '';
  }

  function text(value) {
    return utils().escapeHtml(value);
  }

  function attribute(value) {
    return utils().escapeAttribute(value);
  }

  function formField(label, name, placeholder, type, autocomplete) {
    return '<label class="invite-form-field"><span>' + text(label) + ' *</span><input name="' + attribute(name) + '" type="' + attribute(type || 'text') + '" value="" placeholder="' + attribute(placeholder || '') + '" autocomplete="' + attribute(autocomplete || '') + '" aria-required="true"><em data-error="' + attribute(name) + '"></em></label>';
  }

  function ticketRows(event) {
    if (!event.ticketTypes.length) {
      return '<p class="invite-empty invite-empty--block">Tickets are not available for this invite yet.</p>';
    }

    return event.ticketTypes.map(function (ticket) {
      return '<div class="invite-ticket-row" data-ticket-id="' + attribute(ticket.id) + '">' +
        '<div class="invite-ticket-row__type"><strong>' + text(ticket.name) + '</strong>' + markdown(ticket.descriptionMarkdown) + '<small>UP TO ' + ticket.max + ' PER RESERVATION</small></div>' +
        '<span class="invite-ticket-row__price">' + text(ticket.price) + '</span>' +
        '<div class="invite-counter"><button type="button" data-action="minus" data-id="' + attribute(ticket.id) + '" aria-label="Remove ' + attribute(ticket.name) + '" disabled>&minus;</button><output data-count="' + attribute(ticket.id) + '">0</output><button type="button" data-action="plus" data-id="' + attribute(ticket.id) + '" aria-label="Add ' + attribute(ticket.name) + '"' + (ticket.max < 1 ? ' disabled' : '') + '>+</button></div>' +
      '</div>';
    }).join('');
  }

  function metadataItem(label, value) {
    if (!value) return null;
    var item = document.createElement('div');
    var term = document.createElement('dt');
    var description = document.createElement('dd');
    term.className = 'project-detail__meta-label';
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    return item;
  }

  // Explicit state and actions let the design preview reuse the production markup.
  function renderEvent(container, event, options) {
    options = options || {};
    var api = utils();
    var surface = container.closest('[data-invite-surface]');
    var nav = surface?.querySelector('.project-detail__nav');
    var signature = nav?.querySelector('.project-detail__signature');
    var date = event.dateLabel || event.dateIso;
    var eventTime = [event.startTime, event.endTime].filter(Boolean).join(' – ');
    var location = event.address && event.address !== event.location
      ? [event.location, event.address].filter(Boolean).join(' / ')
      : event.location;
    var meta = document.createElement('dl');
    var isOpen = api.isTicketingOpen(event, options.now);
    var summary = [event.introMarkdown, event.detailsMarkdown].filter(Boolean).join('\n\n');
    var reservation = isOpen && event.ticketTypes.length
      ? '<div class="invite-ticket-table"><div class="invite-ticket-table__head" aria-hidden="true"><span>ACCESS</span><span>PRICE</span><span>QUANTITY</span></div>' + ticketRows(event) + '</div>' +
        '<form class="invite-details-form" novalidate>' +
          (options.separateDetails ? '' : '<div class="invite-form-heading"><h3>Attendee details</h3><p>Only what we need to hold your spot.</p></div>' +
          '<div class="invite-form-grid">' +
            formField('First name', 'firstName', 'Jana', 'text', 'given-name') +
            formField('Last name', 'lastName', 'Franck', 'text', 'family-name') +
            formField('Email', 'email', 'jana@example.com', 'email', 'email') +
          '</div>') +
          '<div class="invite-reservation-footer"><span><small>TOTAL</small><b data-total>0 tickets</b></span><button class="invite-button" type="submit" disabled>' + (options.separateDetails ? 'Continue to details' : 'Review reservation') + ' &rarr;</button></div>' +
        '</form>'
      : '<p class="invite-reservation__closed">' + (isOpen ? 'Tickets are not available yet.' : 'Reservations are closed.') + '</p>';
    var counts = {};

    event.ticketTypes.forEach(function (ticket) {
      counts[ticket.id] = Math.max(0, Math.min(ticket.max, Number(options.counts?.[ticket.id]) || 0));
    });

    meta.className = 'project-detail__meta';
    [metadataItem('DATE', [date, eventTime].filter(Boolean).join(' / ')), metadataItem('LOCATION', location)].filter(Boolean).forEach(function (item) {
      meta.append(item);
    });
    if (nav && signature) {
      nav.querySelector('.invite-detail__meta-row')?.remove();
      var metaRow = document.createElement('div');
      metaRow.className = 'project-detail__meta-row invite-detail__meta-row';
      metaRow.append(meta);
      nav.insertBefore(metaRow, signature);
    }
    if (surface) {
      surface.classList.toggle('has-image', !!event.heroImage);
      surface.dataset.eventId = event.id;
      surface.setAttribute('aria-busy', 'false');
    }
    container.closest('[data-invite-page]')?.setAttribute('aria-busy', 'false');

    var hero = event.heroImage
      ? '<figure class="project-detail__figure invite-detail__figure"><img class="project-detail__image invite-hero__image" src="' + attribute(event.heroImage) + '" alt="" loading="eager" decoding="async"></figure>'
      : '';
    container.innerHTML =
      '<div class="project-detail__content invite-detail__content">' +
        '<header class="project-detail__header"><div class="project-detail__heading-row invite-detail__heading-row">' +
          '<h1 class="project-detail__title" id="invite-title" tabindex="-1">' + text(event.title) + '</h1>' + hero +
        '</div>' + (event.inviteOnly ? '<p class="invite-access">Invitation only</p>' : '') + '</header>' +
        '<div class="project-detail__body invite-detail__body">' +
          (summary ? '<section class="project-detail__section invite-detail__section" aria-labelledby="invite-about-title"><h2 id="invite-about-title">About</h2>' + markdown(summary) + '</section>' : '') +
          '<section class="project-detail__section invite-detail__section invite-detail__reservation" aria-labelledby="invite-reservation-title"><h2 id="invite-reservation-title">Reserve your place.</h2>' + reservation + '</section>' +
        '</div>' +
      '</div>';
    container.setAttribute('aria-busy', 'false');

    var image = container.querySelector('.invite-hero__image');
    image?.addEventListener('error', function () {
      image.closest('figure')?.remove();
      surface?.classList.remove('has-image');
    }, { once: true });

    if (!isOpen || !event.ticketTypes.length) return;

    event.ticketTypes.forEach(function (ticket) { updateTicketRow(container, ticket.id, counts[ticket.id], ticket.max); });
    updateTotal(container, counts);
    var form = container.querySelector('form');
    Object.keys(options.details || {}).forEach(function (name) {
      if (form.elements[name]) form.elements[name].value = options.details[name];
    });
    form.addEventListener('input', function () {
      if (options.onDetailsChange) options.onDetailsChange(Object.fromEntries(new FormData(form).entries()));
    });

    var ticketTable = container.querySelector('.invite-ticket-table');
    ticketTable.addEventListener('click', function (clickEvent) {
      var button = clickEvent.target.closest('button[data-action]');
      if (!button || !isOpen) return;
      var id = button.getAttribute('data-id');
      var ticket = event.ticketTypes.find(function (candidate) { return candidate.id === id; });
      if (!ticket) return;
      counts[id] = Math.max(0, Math.min(ticket.max, counts[id] + (button.getAttribute('data-action') === 'plus' ? 1 : -1)));
      updateTicketRow(container, id, counts[id], ticket.max);
      updateTotal(container, counts);
      if (options.onCountsChange) options.onCountsChange(Object.assign({}, counts));
    });

    container.querySelector('form').addEventListener('submit', function (submitEvent) {
      submitEvent.preventDefault();
      var form = submitEvent.currentTarget;
      var total = Object.keys(counts).reduce(function (sum, id) { return sum + counts[id]; }, 0);
      var details = Object.fromEntries(new FormData(form).entries());
      var valid = total > 0;

      (options.separateDetails ? [] : ['firstName', 'lastName', 'email']).forEach(function (name) {
        var field = form.elements[name];
        var error = form.querySelector('[data-error="' + name + '"]');
        if (!field.value.trim()) {
          error.textContent = 'Required';
          field.classList.add('has-error');
          valid = false;
        } else {
          error.textContent = '';
          field.classList.remove('has-error');
        }
      });

      if (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
        form.elements.email.classList.add('has-error');
        form.querySelector('[data-error="email"]').textContent = 'Enter a valid email';
        valid = false;
      }
      if (!valid) {
        form.querySelector('.has-error')?.focus();
        return;
      }

      var selection = event.ticketTypes.filter(function (ticket) { return counts[ticket.id] > 0; }).map(function (ticket) {
        return { id: ticket.id, name: ticket.name, descriptionMarkdown: ticket.descriptionMarkdown, price: ticket.price, max: ticket.max, count: counts[ticket.id] };
      });
      if (options.onContinue) {
        options.onContinue({ event: event, selection: selection, details: details });
        return;
      }

      sessionStorage.setItem('tz_event', JSON.stringify(event));
      sessionStorage.setItem('tz_selection', JSON.stringify(selection));
      sessionStorage.setItem('tz_details', JSON.stringify(details));
      sessionStorage.removeItem('tz_confirmed');
      window.location.href = '/tickets/overview/';
    });
  }

  function updateTicketRow(container, id, count, max) {
    var row = Array.prototype.find.call(container.querySelectorAll('[data-ticket-id]'), function (candidate) {
      return candidate.getAttribute('data-ticket-id') === id;
    });
    if (!row) return;
    row.querySelector('[data-count]').textContent = count;
    row.querySelector('[data-action="minus"]').disabled = count < 1;
    row.querySelector('[data-action="plus"]').disabled = count >= max;
    row.classList.toggle('is-selected', count > 0);
  }

  function updateTotal(container, counts) {
    var total = Object.keys(counts).reduce(function (sum, id) { return sum + counts[id]; }, 0);
    container.querySelector('[data-total]').textContent = total + (total === 1 ? ' ticket' : ' tickets');
    container.querySelector('.invite-reservation-footer .invite-button').disabled = total < 1;
  }

  window.TZInviteDetail = {
    render: renderEvent,
    message: renderMessage
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (window.TZBooking || !document.body.classList.contains('invite-body')) return;
    var target = document.getElementById('invite-content');
    var eventId = new URLSearchParams(window.location.search).get('event');
    if (!target || !window.TZInvites) return;
    if (!eventId) {
      renderMessage(target, 'Choose an invite', 'Return to the collection to choose an event.', '/');
      return;
    }

    window.TZInvites.load().then(function (events) {
      var event = events.find(function (candidate) {
        return candidate.id === eventId && candidate.publish;
      });
      if (!event) {
        renderMessage(target, 'Invite not found', 'This event may no longer be available.', '/');
        return;
      }
      renderEvent(target, event);
      document.title = event.title + ' - Stan Brouwer';
    }).catch(function (error) {
      console.warn('Invite detail load failed:', error);
      renderMessage(target, 'Invite unavailable', 'The event details could not be loaded. Please try again.', '/', function () {
        window.location.reload();
      });
    });
  });
})();

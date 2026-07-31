(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var app = document.querySelector('[data-ticket-step]');
    if (!app || !window.TZInvites) return;

    var step = app.getAttribute('data-ticket-step');
    if (step === 'tickets') renderTickets(app);
    if (step === 'details') renderDetails(app);
    if (step === 'overview') renderOverview(app);
    if (step === 'confirmation') renderConfirmation(app);
  });

  function esc(value) {
    return window.TZInvites.escapeHtml(value);
  }

  function attr(value) {
    return window.TZInvites.escapeAttribute(value);
  }

  function eventHeader(event) {
    return '<div class="invite-ticket-event-header">' +
      (event.heroImage ? '<img class="invite-ticket-event-header__image" src="' + attr(event.heroImage) + '" alt="">' : '<div class="invite-ticket-event-header__image invite-ticket-event-header__image--empty">INVITE</div>') +
      '<div class="invite-ticket-event-header__copy">' +
        '<p class="invite-kicker">INVITE</p>' +
        '<h1>' + esc(event.title) + '</h1>' +
        '<p>' + esc(event.dateLabel || event.dateIso) + ' / ' + esc(event.startTime + (event.endTime ? ' — ' + event.endTime : '')) + '</p>' +
        '<p>' + esc(event.location) + '</p>' +
      '</div>' +
    '</div>';
  }

  function steps(active) {
    var names = ['Tickets', 'Details', 'Overview'];
    return '<nav class="invite-ticket-steps" aria-label="Reservation progress">' + names.map(function (name, index) {
      var number = index + 1;
      var state = number < active ? ' is-done' : (number === active ? ' is-active' : '');
      return '<span class="invite-ticket-step' + state + '"><b>' + (number < active ? '✓' : number) + '</b>' + name + '</span>' + (number < 3 ? '<span class="invite-ticket-step__line"></span>' : '');
    }).join('') + '</nav>';
  }

  function status(container, message, href) {
    container.innerHTML = '<div class="invite-ticket-status"><p>' + esc(message) + '</p><a class="invite-button" href="' + attr(href || '/invites/') + '">Back to invites</a></div>';
  }

  function loadEvent(eventId) {
    return window.TZInvites.load().then(function (events) {
      return events.find(function (event) {
        return event.id === eventId && event.publish;
      });
    });
  }

  function renderTickets(app) {
    var eventId = new URLSearchParams(window.location.search).get('event');
    if (!eventId) {
      status(app, 'Choose an invite before reserving tickets.');
      return;
    }

    loadEvent(eventId).then(function (event) {
      if (!event) {
        status(app, 'Event not found.');
        return;
      }
      if (!window.TZInvites.isTicketingOpen(event)) {
        status(app, 'Ticket sales have closed for this event.');
        return;
      }
      if (!event.ticketTypes.length) {
        status(app, 'Tickets are not available for this event yet.');
        return;
      }

      sessionStorage.setItem('tz_event', JSON.stringify(event));
      sessionStorage.removeItem('tz_selection');
      sessionStorage.removeItem('tz_details');
      var counts = {};
      event.ticketTypes.forEach(function (ticket) { counts[ticket.id] = 0; });

      app.innerHTML = eventHeader(event) + steps(1) +
        '<section class="invite-ticket-panel" aria-labelledby="ticket-selection-title">' +
          '<div class="invite-ticket-panel__intro"><p class="invite-kicker">SELECT YOUR ACCESS</p><h2 id="ticket-selection-title">Tickets</h2></div>' +
          '<div class="invite-selection-list">' + event.ticketTypes.map(function (ticket) {
            return '<div class="invite-selection-row" data-ticket-id="' + attr(ticket.id) + '">' +
              '<div class="invite-selection-row__info"><h3>' + esc(ticket.name) + '</h3>' +
              (ticket.descriptionMarkdown ? '<div class="invite-markdown">' + window.TZInvites.renderMarkdown(ticket.descriptionMarkdown) + '</div>' : '') +
              '<span class="invite-selection-row__limit">Maximum ' + ticket.max + ' per reservation</span></div>' +
              '<div class="invite-selection-row__side"><span>' + esc(ticket.price) + '</span><div class="invite-counter"><button type="button" data-action="minus" data-id="' + attr(ticket.id) + '" aria-label="Remove ' + attr(ticket.name) + '" disabled>−</button><output data-count="' + attr(ticket.id) + '">0</output><button type="button" data-action="plus" data-id="' + attr(ticket.id) + '" aria-label="Add ' + attr(ticket.name) + '"' + (ticket.max < 1 ? ' disabled' : '') + '>+</button></div></div>' +
            '</div>';
          }).join('') + '</div>' +
          '<div class="invite-ticket-footer"><span><small>TOTAL</small><b data-total>0 tickets</b></span><button class="invite-button" type="button" data-continue disabled>Continue →</button></div>' +
        '</section>';

      app.querySelector('.invite-selection-list').addEventListener('click', function (clickEvent) {
        var button = clickEvent.target.closest('button[data-action]');
        if (!button) return;
        var id = button.getAttribute('data-id');
        var ticket = event.ticketTypes.find(function (candidate) { return candidate.id === id; });
        if (!ticket) return;
        counts[id] = Math.max(0, Math.min(ticket.max, counts[id] + (button.getAttribute('data-action') === 'plus' ? 1 : -1)));
        updateTicketRow(app, id, counts[id], ticket.max);
        updateTicketTotal(app, counts);
      });

      app.querySelector('[data-continue]').addEventListener('click', function () {
        var selection = event.ticketTypes.filter(function (ticket) { return counts[ticket.id] > 0; }).map(function (ticket) {
          return { id: ticket.id, name: ticket.name, price: ticket.price, count: counts[ticket.id] };
        });
        if (!selection.length) return;
        sessionStorage.setItem('tz_selection', JSON.stringify(selection));
        window.location.href = '/tickets/details/';
      });
    }).catch(function (error) {
      console.warn('Ticket selection load failed:', error);
      status(app, 'Ticket information is currently unavailable.');
    });
  }

  function updateTicketRow(app, id, count, max) {
    var row = app.querySelector('[data-ticket-id="' + CSS.escape(id) + '"]');
    if (!row) return;
    row.querySelector('[data-count="' + CSS.escape(id) + '"]').textContent = count;
    row.querySelector('[data-action="minus"]').disabled = count < 1;
    row.querySelector('[data-action="plus"]').disabled = count >= max;
    row.classList.toggle('is-selected', count > 0);
  }

  function updateTicketTotal(app, counts) {
    var total = Object.keys(counts).reduce(function (sum, id) { return sum + counts[id]; }, 0);
    app.querySelector('[data-total]').textContent = total + (total === 1 ? ' ticket' : ' tickets');
    app.querySelector('[data-continue]').disabled = total < 1;
  }

  function renderDetails(app) {
    var event = readSession('tz_event');
    var selection = readSession('tz_selection');
    if (!event || !selection) {
      status(app, 'No active reservation.');
      return;
    }

    var saved = readSession('tz_details') || {};
    app.innerHTML = eventHeader(event) + steps(2) +
      '<section class="invite-ticket-panel invite-ticket-panel--form"><div class="invite-ticket-panel__intro"><p class="invite-kicker">YOUR DETAILS</p><h2>Reservation details</h2></div>' +
      '<form class="invite-details-form" novalidate>' +
        formField('First name', 'firstName', saved.firstName || '', true, 'Jana') +
        formField('Last name', 'lastName', saved.lastName || '', true, 'Franck') +
        formField('Email address', 'email', saved.email || '', false, 'jana@example.com', 'email') +
        formField('City', 'city', saved.city || '', false, 'Amsterdam') +
        formField('Date of birth', 'dateOfBirth', saved.dateOfBirth || '', false, '', 'date') +
        '<label class="invite-form-field"><span>Notes <small>OPTIONAL</small></span><textarea name="notes" rows="4" placeholder="Anything we should know?">' + esc(saved.notes || '') + '</textarea><em data-error="notes"></em></label>' +
        '<div class="invite-ticket-footer"><a class="invite-back-link" href="/tickets/?event=' + encodeURIComponent(event.id) + '">← Back to tickets</a><button class="invite-button" type="submit">Continue →</button></div>' +
      '</form></section>';

    app.querySelector('form').addEventListener('submit', function (submitEvent) {
      submitEvent.preventDefault();
      var form = submitEvent.currentTarget;
      var details = Object.fromEntries(new FormData(form).entries());
      var valid = true;
      ['firstName', 'lastName'].forEach(function (name) {
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
      if (!valid) return;
      sessionStorage.setItem('tz_details', JSON.stringify(details));
      window.location.href = '/tickets/overview/';
    });
  }

  function formField(label, name, value, required, placeholder, type) {
    return '<label class="invite-form-field"><span>' + esc(label) + ' ' + (required ? '<b>*</b>' : '<small>OPTIONAL</small>') + '</span><input name="' + attr(name) + '" type="' + attr(type || 'text') + '" value="' + attr(value) + '" placeholder="' + attr(placeholder || '') + '" autocomplete="' + attr(name) + '"><em data-error="' + attr(name) + '"></em></label>';
  }

  function renderOverview(app) {
    var event = readSession('tz_event');
    var selection = readSession('tz_selection');
    var details = readSession('tz_details');
    if (!event || !selection || !details) {
      status(app, 'No active reservation.');
      return;
    }

    var total = selection.reduce(function (sum, ticket) { return sum + ticket.count; }, 0);
    app.innerHTML = eventHeader(event) + steps(3) +
      '<section class="invite-ticket-panel"><div class="invite-ticket-panel__intro"><p class="invite-kicker">CHECK EVERYTHING</p><h2>Reservation overview</h2></div>' +
      '<div class="invite-overview-block"><h3>Tickets (' + total + ')</h3>' + selection.map(function (ticket) { return '<p><span>' + esc(ticket.name) + '</span><span>× ' + ticket.count + ' / ' + esc(ticket.price) + '</span></p>'; }).join('') + '</div>' +
      '<div class="invite-overview-block"><h3>Your details</h3><p><span>Name</span><span>' + esc(details.firstName + ' ' + details.lastName) + '</span></p>' + (details.email ? '<p><span>Email</span><span>' + esc(details.email) + '</span></p>' : '') + (details.city ? '<p><span>City</span><span>' + esc(details.city) + '</span></p>' : '') + (details.notes ? '<p><span>Notes</span><span>' + esc(details.notes) + '</span></p>' : '') + '</div>' +
      '<div class="invite-ticket-footer"><a class="invite-back-link" href="/tickets/details/">← Back</a><button class="invite-button" type="button" data-place-order>Place reservation →</button></div></section>';

    app.querySelector('[data-place-order]').addEventListener('click', function (clickEvent) {
      clickEvent.currentTarget.disabled = true;
      sessionStorage.setItem('tz_confirmed', JSON.stringify({ event: event, selection: selection, details: details, orderId: 'ORD-' + Date.now().toString(36).toUpperCase(), timestamp: new Date().toISOString() }));
      window.location.href = '/tickets/confirmation/';
    });
  }

  function renderConfirmation(app) {
    var confirmed = readSession('tz_confirmed');
    if (!confirmed) {
      status(app, 'No confirmed reservation found.');
      return;
    }

    var event = confirmed.event;
    var total = confirmed.selection.reduce(function (sum, ticket) { return sum + ticket.count; }, 0);
    app.innerHTML = '<section class="invite-confirmation"><p class="invite-kicker">RESERVATION CONFIRMED</p><h1>See you there.</h1><p class="invite-confirmation__lead">Your ' + total + ' ticket' + (total === 1 ? '' : 's') + ' for <strong>' + esc(event.title) + '</strong> have been reserved.</p><p class="invite-confirmation__order">Order reference: <strong>' + esc(confirmed.orderId) + '</strong></p><div class="invite-sync" data-sync><b>Saving your reservation…</b><span>Keep this page open for a moment.</span></div><div class="invite-confirmation__event">' + eventHeader(event) + '</div><div class="invite-confirmation__tickets">' + confirmed.selection.map(function (ticket) { return '<div><span>' + esc(ticket.name) + ' × ' + ticket.count + '</span><button class="invite-button invite-button--small" type="button" data-ticket-name="' + attr(ticket.name) + '" data-ticket-count="' + ticket.count + '">Download ticket</button></div>'; }).join('') + '</div><a class="invite-button" href="/invites/?event=' + encodeURIComponent(event.id) + '">Back to invite</a></section>';

    app.querySelectorAll('[data-ticket-name]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (event.ticketPdf) {
          window.open(event.ticketPdf, '_blank', 'noopener');
        } else {
          generatePdf(event, confirmed.details, button.getAttribute('data-ticket-name'), button.getAttribute('data-ticket-count'), confirmed.orderId);
        }
      });
    });
    syncReservation(confirmed, app.querySelector('[data-sync]'));
  }

  function syncReservation(confirmed, notice) {
    var payload = {
      token: window.TZ_WEBHOOK_TOKEN || '',
      timestamp: confirmed.timestamp,
      orderId: confirmed.orderId,
      eventId: confirmed.event.id,
      eventTitle: confirmed.event.title,
      eventDate: confirmed.event.dateLabel || confirmed.event.dateIso,
      eventTime: confirmed.event.startTime + (confirmed.event.endTime ? ' — ' + confirmed.event.endTime : ''),
      eventLocation: confirmed.event.location,
      firstName: confirmed.details.firstName,
      lastName: confirmed.details.lastName,
      email: confirmed.details.email || '',
      city: confirmed.details.city || '',
      dateOfBirth: confirmed.details.dateOfBirth || '',
      notes: confirmed.details.notes || '',
      totalTickets: confirmed.selection.reduce(function (sum, ticket) { return sum + ticket.count; }, 0),
      tickets: confirmed.selection.map(function (ticket) { return { name: ticket.name, count: ticket.count }; })
    };

    if (!window.TZ_WEBHOOK_URL) {
      notice.innerHTML = '<b>Reservation confirmed.</b><span>Registration sheet sync is not configured.</span>';
      return;
    }

    fetch(window.TZ_WEBHOOK_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) })
      .then(function () { notice.innerHTML = '<b>Reservation saved.</b><span>Your reservation was sent to the registration sheet.</span>'; })
      .catch(function () { notice.innerHTML = '<b>Reservation confirmed.</b><span>Could not sync automatically. Please contact the organiser.</span>'; });
  }

  function generatePdf(event, details, ticketName, count, orderId) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { window.alert('Ticket PDF library is not loaded.'); return; }
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(event.title, 18, 19);
    doc.setFontSize(10);
    doc.text((event.dateLabel || event.dateIso) + ' / ' + event.location, 18, 30);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(15);
    doc.text('TICKET', 18, 63);
    doc.setFontSize(11);
    [['Ticket type', ticketName], ['Quantity', String(count)], ['Name', details.firstName + ' ' + details.lastName], ['Order reference', orderId]].forEach(function (row, index) {
      doc.setFont('helvetica', 'bold');
      doc.text(row[0], 18, 78 + index * 10);
      doc.setFont('helvetica', 'normal');
      doc.text(row[1], 75, 78 + index * 10);
    });
    doc.rect(10, 50, 190, 75);
    doc.setFontSize(9);
    doc.text('Generated by stanbrouwer.com', 18, 280);
    doc.save(event.id + '-' + ticketName.toLowerCase().replace(/\s+/g, '-') + '.pdf');
  }

  function readSession(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (error) { return null; }
  }
})();

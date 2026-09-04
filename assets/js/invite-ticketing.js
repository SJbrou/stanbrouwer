(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var app = document.querySelector('[data-ticket-step]');
    if (!app || !window.TZInvites) return;

    var step = app.getAttribute('data-ticket-step');
    if (step === 'details') renderDetails(app);
    if (step === 'overview') renderOverview(app);
    if (step === 'confirmation') renderConfirmation(app);
  });

  function esc(value) {
    return window.TZInvites.escapeHtml(value == null ? '' : value);
  }

  function attr(value) {
    return window.TZInvites.escapeAttribute(value == null ? '' : value);
  }

  function eventChrome(event, activeStep) {
    var eventUrl = '/invites/?event=' + encodeURIComponent(event.id);
    var eventTime = event.startTime + (event.endTime ? ' &mdash; ' + event.endTime : '');
    var media = event.heroImage
      ? '<img class="ticket-event-header__image" src="' + attr(event.heroImage) + '" alt="">'
      : '<div class="ticket-event-header__image ticket-event-header__image--empty">INVITE</div>';

    return '<a class="invite-back-link ticket-back-link" href="' + eventUrl + '">Back to invite</a>' +
      '<header class="ticket-event-header">' +
        '<div class="ticket-event-header__copy">' +
          '<p class="invite-kicker">RESERVATION</p>' +
          '<h1>' + esc(event.title) + '</h1>' +
          '<dl class="ticket-event-meta">' +
            '<div><dt>WHEN</dt><dd>' + esc(event.dateLabel || event.dateIso) + '<br><span>' + eventTime + '</span></dd></div>' +
            '<div><dt>WHERE</dt><dd>' + esc(event.location) + (event.address && event.address !== event.location ? '<br><span>' + esc(event.address) + '</span>' : '') + '</dd></div>' +
          '</dl>' +
        '</div>' + media +
      '</header>' + progress(activeStep);
  }

  function progress(active) {
    var names = ['Details', 'Review', 'Done'];
    return '<nav class="ticket-progress" aria-label="Reservation progress"><ol>' + names.map(function (name, index) {
      var step = index + 1;
      var state = step < active ? ' is-complete' : (step === active ? ' is-current' : '');
      var current = step === active ? ' aria-current="step"' : '';
      return '<li class="ticket-progress__step' + state + '"' + current + '><span>0' + step + '</span><b>' + esc(name) + '</b></li>';
    }).join('') + '</ol></nav>';
  }

  function status(container, message, href) {
    container.innerHTML = '<section class="ticket-status"><p class="invite-kicker">RESERVATION</p><h1>Nothing to review.</h1><p>' + esc(message) + '</p><a class="invite-button" href="' + attr(href || '/invites/') + '">Back to invites</a></section>';
  }

  function sectionHeading(kicker, title, copy, id) {
    return '<header class="ticket-section-heading">' +
      '<p class="invite-kicker">' + esc(kicker) + '</p>' +
      '<h2' + (id ? ' id="' + attr(id) + '"' : '') + '>' + esc(title) + '</h2>' +
      (copy ? '<p class="ticket-section-heading__copy">' + esc(copy) + '</p>' : '') +
    '</header>';
  }

  function selectionTable(selection, caption) {
    return '<div class="ticket-table-wrap"><table class="ticket-table">' +
      '<caption>' + esc(caption || 'Selected tickets') + '</caption>' +
      '<thead><tr><th scope="col">ACCESS</th><th scope="col">QUANTITY</th><th scope="col">UNIT PRICE</th></tr></thead>' +
      '<tbody>' + selection.map(function (ticket) {
        var description = ticket.descriptionMarkdown
          ? '<div class="ticket-table__description">' + window.TZInvites.renderMarkdown(ticket.descriptionMarkdown) + '</div>'
          : '';
        var limit = ticket.max ? '<small>UP TO ' + esc(ticket.max) + ' PER RESERVATION</small>' : '';
        return '<tr><th scope="row"><strong>' + esc(ticket.name) + '</strong>' + description + limit + '</th>' +
          '<td data-label="Quantity">&times; ' + esc(ticket.count) + '</td>' +
          '<td data-label="Unit price">' + esc(ticket.price) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function facts(title, rows) {
    return '<section class="ticket-facts-block"><h3>' + esc(title) + '</h3><dl class="ticket-facts">' + rows.filter(function (row) {
      return row[1];
    }).map(function (row) {
      return '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>';
    }).join('') + '</dl></section>';
  }

  function eventFactRows(event) {
    return [
      ['Date', event.dateLabel || event.dateIso],
      ['Time', event.startTime + (event.endTime ? ' - ' + event.endTime : '')],
      ['Location', event.location],
      ['Address', event.address && event.address !== event.location ? event.address : '']
    ];
  }

  function renderDetails(app) {
    var event = readSession('tz_event');
    var selection = readSession('tz_selection');
    if (!event || !selection || !selection.length) {
      status(app, 'Start from an invite and choose at least one ticket.');
      return;
    }

    var saved = readSession('tz_details') || {};
    app.innerHTML = eventChrome(event, 1) +
      '<section class="ticket-flow-section" aria-labelledby="ticket-details-title">' +
        sectionHeading('01 / DETAILS', 'Who is joining?', 'Only the essentials, so we can hold your place.', 'ticket-details-title') +
        selectionTable(selection, 'Your ticket selection') +
        '<form class="ticket-details-form" novalidate>' +
          '<div class="ticket-form-grid">' +
            formField('First name', 'firstName', saved.firstName || '', 'Jana', 'text', 'given-name') +
            formField('Last name', 'lastName', saved.lastName || '', 'Franck', 'text', 'family-name') +
            formField('Email', 'email', saved.email || '', 'jana@example.com', 'email', 'email') +
          '</div>' +
          '<div class="ticket-flow-footer"><a class="invite-back-link" href="/invites/?event=' + encodeURIComponent(event.id) + '">Back to tickets</a><button class="invite-button" type="submit">Review reservation &rarr;</button></div>' +
        '</form>' +
      '</section>';

    app.querySelector('form').addEventListener('submit', function (submitEvent) {
      submitEvent.preventDefault();
      var form = submitEvent.currentTarget;
      var details = Object.fromEntries(new FormData(form).entries());
      var valid = true;

      ['firstName', 'lastName', 'email'].forEach(function (name) {
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

  function formField(label, name, value, placeholder, type, autocomplete) {
    return '<label class="invite-form-field"><span>' + esc(label) + ' *</span><input name="' + attr(name) + '" type="' + attr(type || 'text') + '" value="' + attr(value) + '" placeholder="' + attr(placeholder) + '" autocomplete="' + attr(autocomplete) + '" aria-required="true"><em data-error="' + attr(name) + '"></em></label>';
  }

  function renderOverview(app) {
    var event = readSession('tz_event');
    var selection = readSession('tz_selection');
    var details = readSession('tz_details');
    if (!event || !selection || !selection.length || !details) {
      status(app, 'Start from an invite and complete your reservation details.');
      return;
    }

    app.innerHTML = eventChrome(event, 2) +
      '<section class="ticket-flow-section" aria-labelledby="ticket-overview-title">' +
        sectionHeading('02 / REVIEW', 'One last look.', 'Check the details below. You can still go back and make changes.', 'ticket-overview-title') +
        '<div class="ticket-review">' +
          '<section class="ticket-review__tickets"><h3>TICKETS</h3>' + selectionTable(selection, 'Tickets in this reservation') + '</section>' +
          '<div class="ticket-review__facts">' +
            facts('EVENT', eventFactRows(event)) +
            facts('GUEST', [['Name', details.firstName + ' ' + details.lastName], ['Email', details.email]]) +
          '</div>' +
        '</div>' +
        '<div class="ticket-flow-footer"><a class="invite-back-link" href="/invites/?event=' + encodeURIComponent(event.id) + '#invite-reservation-title">Change details</a><button class="invite-button" type="button" data-place-order>Confirm reservation &rarr;</button></div>' +
      '</section>';

    app.querySelector('[data-place-order]').addEventListener('click', function (clickEvent) {
      clickEvent.currentTarget.disabled = true;
      sessionStorage.setItem('tz_confirmed', JSON.stringify({
        event: event,
        selection: selection,
        details: details,
        orderId: 'ORD-' + Date.now().toString(36).toUpperCase(),
        timestamp: new Date().toISOString()
      }));
      window.location.href = '/tickets/confirmation/';
    });
  }

  function confirmationTable(selection) {
    return '<div class="ticket-table-wrap"><table class="ticket-table ticket-table--downloads"><caption>Your tickets</caption>' +
      '<thead><tr><th scope="col">ACCESS</th><th scope="col">QUANTITY</th><th scope="col">TICKET</th></tr></thead><tbody>' +
      selection.map(function (ticket) {
        return '<tr><th scope="row"><strong>' + esc(ticket.name) + '</strong></th><td data-label="Quantity">&times; ' + esc(ticket.count) + '</td><td data-label="Ticket"><button class="invite-button invite-button--small" type="button" data-ticket-name="' + attr(ticket.name) + '" data-ticket-count="' + attr(ticket.count) + '">Download</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderConfirmation(app) {
    var confirmed = readSession('tz_confirmed');
    if (!confirmed) {
      status(app, 'No confirmed reservation was found.');
      return;
    }

    var event = confirmed.event;
    var total = confirmed.selection.reduce(function (sum, ticket) { return sum + Number(ticket.count || 0); }, 0);
    app.innerHTML = eventChrome(event, 3) +
      '<section class="ticket-confirmation" aria-labelledby="ticket-confirmation-title">' +
        '<header class="ticket-confirmation__heading"><p class="invite-kicker">RESERVATION CONFIRMED</p><h2 id="ticket-confirmation-title">You\'re in.</h2><p>Your ' + total + ' ticket' + (total === 1 ? '' : 's') + ' for <strong>' + esc(event.title) + '</strong> ' + (total === 1 ? 'is' : 'are') + ' reserved.</p></header>' +
        '<div class="invite-sync" data-sync aria-live="polite"><b>Saving your reservation&hellip;</b><span>Keep this page open for a moment.</span></div>' +
        '<div class="ticket-confirmation__facts">' +
          facts('RESERVATION', [['Reference', confirmed.orderId], ['Reserved for', confirmed.details.firstName + ' ' + confirmed.details.lastName], ['Email', confirmed.details.email]]) +
          facts('EVENT', eventFactRows(event)) +
        '</div>' +
        '<section class="ticket-confirmation__tickets"><h3>TICKETS</h3>' + confirmationTable(confirmed.selection) + '</section>' +
        '<div class="ticket-flow-footer ticket-flow-footer--single"><a class="invite-button" href="/invites/?event=' + encodeURIComponent(event.id) + '">Back to invite</a></div>' +
      '</section>';

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
      eventTime: confirmed.event.startTime + (confirmed.event.endTime ? ' - ' + confirmed.event.endTime : ''),
      eventLocation: confirmed.event.location,
      firstName: confirmed.details.firstName,
      lastName: confirmed.details.lastName,
      email: confirmed.details.email || '',
      city: confirmed.details.city || '',
      dateOfBirth: confirmed.details.dateOfBirth || '',
      notes: confirmed.details.notes || '',
      totalTickets: confirmed.selection.reduce(function (sum, ticket) { return sum + Number(ticket.count || 0); }, 0),
      tickets: confirmed.selection.map(function (ticket) { return { name: ticket.name, count: ticket.count }; })
    };

    if (!window.TZ_WEBHOOK_URL) {
      notice.innerHTML = '<b>Reservation confirmed.</b><span>Registration sheet sync is not configured.</span>';
      return;
    }

    fetch(window.TZ_WEBHOOK_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) })
      .then(function () { notice.innerHTML = '<b>Reservation saved.</b><span>Your reservation was added to the guest list.</span>'; })
      .catch(function () { notice.innerHTML = '<b>Reservation confirmed.</b><span>Automatic guest-list sync failed. Please contact the organiser.</span>'; });
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

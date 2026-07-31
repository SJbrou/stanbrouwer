(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var target = document.getElementById('invite-content');
    var eventId = new URLSearchParams(window.location.search).get('event');

    if (!target || !window.TZInvites) return;
    if (!eventId) {
      renderMessage(target, 'Choose an invite from the collection.', '/');
      return;
    }

    window.TZInvites.load().then(function (events) {
      var event = events.find(function (candidate) {
        return candidate.id === eventId && candidate.publish;
      });

      if (!event) {
        renderMessage(target, 'Invite not found.', '/');
        return;
      }

      renderEvent(target, event);
      target.setAttribute('aria-busy', 'false');
      document.title = event.title + ' - Stan Brouwer';
    }).catch(function (error) {
      console.warn('Invite detail load failed:', error);
      renderMessage(target, 'Invite content unavailable.', '/');
    });

    function renderMessage(container, message, href) {
      container.replaceChildren();
      var paragraph = document.createElement('p');
      var link = document.createElement('a');
      paragraph.className = 'invite-message';
      paragraph.textContent = message + ' ';
      link.href = href;
      link.textContent = 'Go back';
      paragraph.append(link);
      container.append(paragraph);
      container.setAttribute('aria-busy', 'false');
    }

    function markdown(value) {
      return value ? '<div class="invite-markdown">' + window.TZInvites.renderMarkdown(value) + '</div>' : '<span class="invite-empty">—</span>';
    }

    function infoRow(label, value) {
      if (!value) return '';
      return '<div class="invite-table__row"><strong>' + window.TZInvites.escapeHtml(label) + '</strong><div>' + window.TZInvites.escapeHtml(value) + '</div></div>';
    }

    function markdownRow(label, value) {
      if (!value) return '';
      return '<div class="invite-table__row invite-table__row--markdown"><strong>' + window.TZInvites.escapeHtml(label) + '</strong><div>' + markdown(value) + '</div></div>';
    }

    function formField(label, name, value, required, placeholder, type) {
      return '<label class="invite-form-field"><span>' + window.TZInvites.escapeHtml(label) + ' ' + (required ? '<b>*</b>' : '<small>OPTIONAL</small>') + '</span><input name="' + window.TZInvites.escapeAttribute(name) + '" type="' + window.TZInvites.escapeAttribute(type || 'text') + '" value="' + window.TZInvites.escapeAttribute(value || '') + '" placeholder="' + window.TZInvites.escapeAttribute(placeholder || '') + '"><em data-error="' + window.TZInvites.escapeAttribute(name) + '"></em></label>';
    }

    function ticketRows(event) {
      if (!event.ticketTypes.length) {
        return '<p class="invite-empty invite-empty--block">Tickets are not available for this invite yet.</p>';
      }

      return event.ticketTypes.map(function (ticket) {
        return '<div class="invite-ticket-row" data-ticket-id="' + window.TZInvites.escapeAttribute(ticket.id) + '">' +
          '<div><strong>' + window.TZInvites.escapeHtml(ticket.name) + '</strong>' + (ticket.descriptionMarkdown ? '<div class="invite-markdown">' + window.TZInvites.renderMarkdown(ticket.descriptionMarkdown) + '</div>' : '') + '</div>' +
          '<div class="invite-ticket-row__side"><span>' + window.TZInvites.escapeHtml(ticket.price) + '</span><div class="invite-counter"><button type="button" data-action="minus" data-id="' + window.TZInvites.escapeAttribute(ticket.id) + '" aria-label="Remove ' + window.TZInvites.escapeAttribute(ticket.name) + '" disabled>−</button><output data-count="' + window.TZInvites.escapeAttribute(ticket.id) + '">0</output><button type="button" data-action="plus" data-id="' + window.TZInvites.escapeAttribute(ticket.id) + '" aria-label="Add ' + window.TZInvites.escapeAttribute(ticket.name) + '"' + (ticket.max < 1 ? ' disabled' : '') + '>+</button></div><small>MAX ' + ticket.max + '</small></div>' +
        '</div>';
      }).join('');
    }

    function renderEvent(container, event) {
      var isOpen = window.TZInvites.isTicketingOpen(event);
      var hero = event.heroImage
        ? '<img class="invite-hero__image" src="' + window.TZInvites.escapeAttribute(event.heroImage) + '" alt="" loading="eager">'
        : '<div class="invite-hero__placeholder">INVITE</div>';
      var counts = {};

      event.ticketTypes.forEach(function (ticket) { counts[ticket.id] = 0; });

      container.innerHTML =
        '<div class="invite-combined">' +
          '<header class="invite-hero">' +
            '<div class="invite-hero__copy"><p class="invite-kicker">INVITE</p><h1>' + window.TZInvites.escapeHtml(event.title) + '</h1><p class="invite-hero__date">' + window.TZInvites.escapeHtml(event.dateLabel || event.dateIso) + '</p></div>' +
            '<div class="invite-hero__media">' + hero + '</div>' +
          '</header>' +
          '<section class="invite-info-block" aria-labelledby="invite-general-information"><p class="invite-kicker">GENERAL INFORMATION</p><div class="invite-table" id="invite-general-information">' +
            infoRow('Date', event.dateLabel || event.dateIso) +
            infoRow('Time', event.startTime + (event.endTime ? ' — ' + event.endTime : '')) +
            infoRow('Location', event.location) +
            infoRow('Address', event.address) +
            infoRow('Invite', event.inviteOnly ? 'Invite only' : 'Open invitation') +
          '</div></section>' +
          '<section class="invite-info-block" aria-labelledby="invite-description"><p class="invite-kicker">INFORMATION</p><div class="invite-table" id="invite-description">' +
            markdownRow('Brief', event.introMarkdown) +
            markdownRow('Details', event.detailsMarkdown) +
            markdownRow('Programme', event.programmeMarkdown) +
            markdownRow('Practical', event.practicalMarkdown) +
          '</div></section>' +
          '<section class="invite-info-block invite-reservation" aria-labelledby="invite-reservation-title"><p class="invite-kicker">RESERVATION</p><h2 id="invite-reservation-title">Reserve your place</h2>' +
            '<div class="invite-table invite-ticket-table">' + ticketRows(event) + '</div>' +
            '<form class="invite-details-form" novalidate>' +
              formField('First name', 'firstName', '', true, 'Jana') +
              formField('Last name', 'lastName', '', true, 'Franck') +
              formField('Email address', 'email', '', false, 'jana@example.com', 'email') +
              formField('City', 'city', '', false, 'Amsterdam') +
              formField('Date of birth', 'dateOfBirth', '', false, '', 'date') +
              '<label class="invite-form-field"><span>Notes <small>OPTIONAL</small></span><textarea name="notes" rows="4" placeholder="Anything we should know?"></textarea><em data-error="notes"></em></label>' +
              '<div class="invite-reservation-footer"><span><small>TOTAL</small><b data-total>0 tickets</b></span><button class="invite-button" type="submit"' + (!isOpen || !event.ticketTypes.length ? ' disabled' : '') + '>' + (isOpen ? 'Continue / reserve →' : 'Reservations closed') + '</button></div>' +
            '</form>' +
          '</section>' +
        '</div>' +
        '<footer class="invite-outro"><img src="/assets/img/black-white-perspective-grid-background-vector.jpg" alt="Black-and-white perspective grid artwork"><div class="collection-captions"><p>a carefully curated<br>collection of experiences</p><p>Stan Brouwer<br>vol. 001</p></div></footer>';

      if (!event.ticketTypes.length) return;

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
      });

      container.querySelector('form').addEventListener('submit', function (submitEvent) {
        submitEvent.preventDefault();
        var form = submitEvent.currentTarget;
        var total = Object.keys(counts).reduce(function (sum, id) { return sum + counts[id]; }, 0);
        var details = Object.fromEntries(new FormData(form).entries());
        var valid = total > 0;

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

        sessionStorage.setItem('tz_event', JSON.stringify(event));
        sessionStorage.setItem('tz_selection', JSON.stringify(event.ticketTypes.filter(function (ticket) { return counts[ticket.id] > 0; }).map(function (ticket) {
          return { id: ticket.id, name: ticket.name, price: ticket.price, count: counts[ticket.id] };
        })));
        sessionStorage.setItem('tz_details', JSON.stringify(details));
        sessionStorage.setItem('tz_confirmed', JSON.stringify({ event: event, selection: JSON.parse(sessionStorage.getItem('tz_selection')), details: details, orderId: 'ORD-' + Date.now().toString(36).toUpperCase(), timestamp: new Date().toISOString() }));
        window.location.href = '/tickets/confirmation/';
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
    }
  });
})();

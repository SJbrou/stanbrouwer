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

    function formField(label, name, value, placeholder, type, autocomplete) {
      return '<label class="invite-form-field"><span>' + window.TZInvites.escapeHtml(label) + ' *</span><input name="' + window.TZInvites.escapeAttribute(name) + '" type="' + window.TZInvites.escapeAttribute(type || 'text') + '" value="' + window.TZInvites.escapeAttribute(value || '') + '" placeholder="' + window.TZInvites.escapeAttribute(placeholder || '') + '" autocomplete="' + window.TZInvites.escapeAttribute(autocomplete || '') + '" aria-required="true"><em data-error="' + window.TZInvites.escapeAttribute(name) + '"></em></label>';
    }

    function ticketRows(event) {
      if (!event.ticketTypes.length) {
        return '<p class="invite-empty invite-empty--block">Tickets are not available for this invite yet.</p>';
      }

      return event.ticketTypes.map(function (ticket) {
        return '<div class="invite-ticket-row" data-ticket-id="' + window.TZInvites.escapeAttribute(ticket.id) + '">' +
          '<div class="invite-ticket-row__type"><strong>' + window.TZInvites.escapeHtml(ticket.name) + '</strong>' + (ticket.descriptionMarkdown ? '<div class="invite-markdown">' + window.TZInvites.renderMarkdown(ticket.descriptionMarkdown) + '</div>' : '') + '<small>UP TO ' + ticket.max + ' PER RESERVATION</small></div>' +
          '<span class="invite-ticket-row__price">' + window.TZInvites.escapeHtml(ticket.price) + '</span>' +
          '<div class="invite-counter"><button type="button" data-action="minus" data-id="' + window.TZInvites.escapeAttribute(ticket.id) + '" aria-label="Remove ' + window.TZInvites.escapeAttribute(ticket.name) + '" disabled>&minus;</button><output data-count="' + window.TZInvites.escapeAttribute(ticket.id) + '">0</output><button type="button" data-action="plus" data-id="' + window.TZInvites.escapeAttribute(ticket.id) + '" aria-label="Add ' + window.TZInvites.escapeAttribute(ticket.name) + '"' + (ticket.max < 1 ? ' disabled' : '') + '>+</button></div>' +
        '</div>';
      }).join('');
    }

    function renderEvent(container, event) {
      var isOpen = window.TZInvites.isTicketingOpen(event);
      var hero = event.heroImage
        ? '<img class="invite-hero__image" src="' + window.TZInvites.escapeAttribute(event.heroImage) + '" alt="" loading="eager">'
        : '<div class="invite-hero__placeholder">INVITE</div>';
      var eventTime = event.startTime + (event.endTime ? ' — ' + event.endTime : '');
      var summary = [event.introMarkdown, event.detailsMarkdown].filter(Boolean).join('\n\n');
      var reservation = isOpen && event.ticketTypes.length
        ? '<div class="invite-ticket-table"><div class="invite-ticket-table__head" aria-hidden="true"><span>ACCESS</span><span>PRICE</span><span>QUANTITY</span></div>' + ticketRows(event) + '</div>' +
          '<form class="invite-details-form" novalidate>' +
            '<div class="invite-form-heading"><p class="invite-kicker">YOUR DETAILS</p><p>Only what we need to hold your spot.</p></div>' +
            '<div class="invite-form-grid">' +
              formField('First name', 'firstName', '', 'Jana', 'text', 'given-name') +
              formField('Last name', 'lastName', '', 'Franck', 'text', 'family-name') +
              formField('Email', 'email', '', 'jana@example.com', 'email', 'email') +
            '</div>' +
            '<div class="invite-reservation-footer"><span><small>TOTAL</small><b data-total>0 tickets</b></span><button class="invite-button" type="submit" disabled>Review reservation →</button></div>' +
          '</form>'
        : '<p class="invite-reservation__closed">' + (isOpen ? 'Tickets are not available yet.' : 'Reservations are closed.') + '</p>';
      var counts = {};

      event.ticketTypes.forEach(function (ticket) { counts[ticket.id] = 0; });

      container.innerHTML =
        '<div class="invite-combined">' +
          '<header class="invite-hero">' +
            '<div class="invite-hero__copy"><p class="invite-kicker">INVITE</p><h1 id="invite-title">' + window.TZInvites.escapeHtml(event.title) + '</h1>' +
              '<dl class="invite-essentials">' +
                '<div><dt>WHEN</dt><dd>' + window.TZInvites.escapeHtml(event.dateLabel || event.dateIso) + '<br><span>' + window.TZInvites.escapeHtml(eventTime) + '</span></dd></div>' +
                '<div><dt>WHERE</dt><dd>' + window.TZInvites.escapeHtml(event.location) + (event.address && event.address !== event.location ? '<br><span>' + window.TZInvites.escapeHtml(event.address) + '</span>' : '') + '</dd></div>' +
              '</dl>' + (event.inviteOnly ? '<p class="invite-access">INVITE ONLY</p>' : '') + '</div>' +
            '<div class="invite-hero__media">' + hero + '</div>' +
          '</header>' +
          (summary ? '<section class="invite-brief" aria-labelledby="invite-about"><p class="invite-kicker" id="invite-about">ABOUT</p><div class="invite-brief__copy">' + markdown(summary) + '</div></section>' : '') +
          '<section class="invite-reservation" aria-labelledby="invite-reservation-title"><header class="invite-reservation__heading"><p class="invite-kicker">TICKETS</p><h2 id="invite-reservation-title">Reserve your place.</h2></header>' + reservation +
          '</section>' +
        '</div>';

      if (!isOpen || !event.ticketTypes.length) return;

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

        sessionStorage.setItem('tz_event', JSON.stringify(event));
        sessionStorage.setItem('tz_selection', JSON.stringify(event.ticketTypes.filter(function (ticket) { return counts[ticket.id] > 0; }).map(function (ticket) {
          return { id: ticket.id, name: ticket.name, descriptionMarkdown: ticket.descriptionMarkdown, price: ticket.price, max: ticket.max, count: counts[ticket.id] };
        })));
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
  });
})();

---
layout: ticketing
title: Order Overview
permalink: /ticket-overview/
hide_navbar: true
---

<div class="tz-shop" id="tz-overview-app">
  <a href="/ticket-details/" class="tz-back-link">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon"><path fill-rule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clip-rule="evenodd" /></svg>
    Back
  </a>

  <div class="tz-shop__event-header" id="tz-event-header"></div>

  <div class="tz-steps">
    <div class="tz-step tz-step--done">
      <span class="tz-step__num">✓</span>
      <span class="tz-step__label">Tickets</span>
    </div>
    <div class="tz-step__connector tz-step__connector--done"></div>
    <div class="tz-step tz-step--done">
      <span class="tz-step__num">✓</span>
      <span class="tz-step__label">Details</span>
    </div>
    <div class="tz-step__connector tz-step__connector--done"></div>
    <div class="tz-step tz-step--active">
      <span class="tz-step__num">3</span>
      <span class="tz-step__label">Overview</span>
    </div>
  </div>

  <div class="tz-overview" id="tz-overview-content"></div>

  <div class="tz-shop__footer">
    <div class="tz-shop__total">
      <span class="tz-shop__total-label">Total</span>
      <span class="tz-shop__total-amount">Free</span>
    </div>
    <button class="tz-btn tz-btn--primary tz-btn--cta" id="tz-place-order-btn">
      Place reservation
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon"><path fill-rule="evenodd" d="M9 1.5H5.625c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5zm6.61 10.936a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 14.47a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" /></svg>
    </button>
  </div>
</div>

<script>
(function() {
  var event    = JSON.parse(sessionStorage.getItem('tz_event')     || 'null');
  var selection = JSON.parse(sessionStorage.getItem('tz_selection') || 'null');
  var details  = JSON.parse(sessionStorage.getItem('tz_details')   || 'null');

  if (!event || !selection || !details) {
    document.getElementById('tz-overview-app').innerHTML =
      '<p class="tz-error">No active reservation. <a href="/events/">Start over</a></p>';
    return;
  }

  if (!isTicketingOpen(event)) {
    document.getElementById('tz-overview-app').innerHTML =
      '<p class="tz-error">Ticket sales have closed for this event. <a href="/events/">View all events</a></p>';
    return;
  }

  // Render event header
  document.getElementById('tz-event-header').innerHTML =
    '<div class="tz-event-banner">' +
      '<div class="tz-event-banner__date-badge">' + formatDateBadge(event.date) + '</div>' +
      '<div class="tz-event-banner__info">' +
        '<h2 class="tz-event-banner__title">' + escHtml(event.title) + '</h2>' +
        '<p class="tz-event-banner__meta">' + escHtml(event.date) + ' &bull; ' + escHtml(event.time) + '</p>' +
        '<p class="tz-event-banner__location">' + escHtml(event.location) + '</p>' +
      '</div>' +
    '</div>';

  // Build overview HTML
  var ticketRows = selection.map(function(s) {
    return '<div class="tz-overview__row">' +
      '<span class="tz-overview__row-label">' + escHtml(s.name) + '</span>' +
      '<span class="tz-overview__row-qty">× ' + s.count + '</span>' +
      '<span class="tz-overview__row-price">' + escHtml(s.price) + '</span>' +
    '</div>';
  }).join('');

  var totalTickets = selection.reduce(function(a, s) { return a + s.count; }, 0);

  document.getElementById('tz-overview-content').innerHTML =
    '<section class="tz-overview__section">' +
      '<h3 class="tz-overview__section-title">Tickets (' + totalTickets + ')</h3>' +
      ticketRows +
    '</section>' +
    '<section class="tz-overview__section">' +
      '<h3 class="tz-overview__section-title">Your details</h3>' +
      '<div class="tz-overview__details">' +
        '<div class="tz-overview__detail-row"><span>Name</span><span>' + escHtml(details.firstName + ' ' + details.lastName) + '</span></div>' +
        (details.email ? '<div class="tz-overview__detail-row"><span>Email</span><span>' + escHtml(details.email) + '</span></div>' : '') +
        (details.city ? '<div class="tz-overview__detail-row"><span>City</span><span>' + escHtml(details.city) + '</span></div>' : '') +
        (details.dateOfBirth ? '<div class="tz-overview__detail-row"><span>Date of birth</span><span>' + escHtml(details.dateOfBirth) + '</span></div>' : '') +
        (details.notes ? '<div class="tz-overview__detail-row"><span>Notes</span><span>' + escHtml(details.notes) + '</span></div>' : '') +
      '</div>' +
    '</section>';

  document.getElementById('tz-place-order-btn').addEventListener('click', function() {
    if (!isTicketingOpen(event)) {
      document.getElementById('tz-overview-app').innerHTML =
        '<p class="tz-error">Ticket sales have closed for this event. <a href="/events/">View all events</a></p>';
      return;
    }

    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Processing…';

    // Store confirmation data
    sessionStorage.setItem('tz_confirmed', JSON.stringify({
      event: event,
      selection: selection,
      details: details,
      orderId: 'ORD-' + Date.now().toString(36).toUpperCase(),
      timestamp: new Date().toISOString()
    }));

    window.location.href = '/ticket-confirmation/';
  });

  function formatDateBadge(dateStr) {
    var d = new Date(dateStr);
    var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return '<span class="tz-date-badge__month">' + months[d.getMonth()] + '</span>' +
           '<span class="tz-date-badge__day">' + d.getDate() + '</span>';
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function isTicketingOpen(currentEvent) {
    return !window.TZTicketing || window.TZTicketing.isTicketingOpen(currentEvent);
  }
})();
</script>

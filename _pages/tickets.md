---
layout: ticketing
title: Select Tickets
permalink: /tickets/
hide_navbar: true
---

<!-- Embed all events data for client-side JS -->
<script>
window.TZ_EVENTS = {{ site.data.events | jsonify }};
</script>

<div class="tz-shop" id="tz-tickets-app">
  <!-- Back link -->
  <a href="/events/" class="tz-back-link">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon"><path fill-rule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clip-rule="evenodd" /></svg>
    All events
  </a>

  <!-- Event header populated by JS -->
  <div class="tz-shop__event-header" id="tz-event-header"></div>

  <!-- Progress steps -->
  <div class="tz-steps">
    <div class="tz-step tz-step--active">
      <span class="tz-step__num">1</span>
      <span class="tz-step__label">Tickets</span>
    </div>
    <div class="tz-step__connector"></div>
    <div class="tz-step">
      <span class="tz-step__num">2</span>
      <span class="tz-step__label">Details</span>
    </div>
    <div class="tz-step__connector"></div>
    <div class="tz-step">
      <span class="tz-step__num">3</span>
      <span class="tz-step__label">Overview</span>
    </div>
  </div>

  <!-- Ticket rows populated by JS -->
  <div class="tz-ticket-list" id="tz-ticket-list"></div>

  <!-- Footer bar -->
  <div class="tz-shop__footer">
    <div class="tz-shop__total">
      <span class="tz-shop__total-label">Total</span>
      <span class="tz-shop__total-amount">Free</span>
    </div>
    <button class="tz-btn tz-btn--primary" id="tz-continue-btn" disabled>
      Continue
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon"><path fill-rule="evenodd" d="M16.72 7.72a.75.75 0 011.06 0l3.75 3.75a.75.75 0 010 1.06l-3.75 3.75a.75.75 0 11-1.06-1.06l2.47-2.47H3a.75.75 0 010-1.5h16.19l-2.47-2.47a.75.75 0 010-1.06z" clip-rule="evenodd" /></svg>
    </button>
  </div>
</div>

<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var eventId = params.get('event');
  var event = (window.TZ_EVENTS || []).find(function(e) { return e.id === eventId; });

  if (!event) {
    document.getElementById('tz-tickets-app').innerHTML =
      '<p class="tz-error">Event not found. <a href="/events/">View all events</a></p>';
    return;
  }

  if (!isTicketingOpen(event)) {
    document.getElementById('tz-tickets-app').innerHTML =
      '<p class="tz-error">Ticket sales have closed for this event. <a href="/events/">View all events</a></p>';
    return;
  }

  if (!Array.isArray(event.ticket_types) || event.ticket_types.length === 0) {
    document.getElementById('tz-tickets-app').innerHTML =
      '<p class="tz-error">Tickets are not available for this event yet. <a href="/events/">View all events</a></p>';
    return;
  }

  // Store event in session
  sessionStorage.setItem('tz_event', JSON.stringify(event));
  sessionStorage.removeItem('tz_selection');
  sessionStorage.removeItem('tz_details');

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

  // Render ticket rows
  var counts = {};
  event.ticket_types.forEach(function(tt) { counts[tt.id] = 0; });

  var listEl = document.getElementById('tz-ticket-list');
  listEl.innerHTML = event.ticket_types.map(function(tt) {
    return '<div class="tz-ticket-row" id="tz-row-' + escAttr(tt.id) + '">' +
      '<div class="tz-ticket-row__info">' +
        '<span class="tz-ticket-row__name">' + escHtml(tt.name) + '</span>' +
        (tt.description ? '<span class="tz-ticket-row__desc">' + escHtml(tt.description) + '</span>' : '') +
      '</div>' +
      '<div class="tz-ticket-row__controls">' +
        '<span class="tz-ticket-row__price">' + escHtml(tt.price) + '</span>' +
        '<div class="tz-counter">' +
          '<button class="tz-counter__btn tz-counter__btn--minus" data-id="' + escAttr(tt.id) + '" aria-label="Remove">−</button>' +
          '<span class="tz-counter__val" id="tz-count-' + escAttr(tt.id) + '">0</span>' +
          '<button class="tz-counter__btn tz-counter__btn--plus" data-id="' + escAttr(tt.id) + '" aria-label="Add">+</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Wire up buttons
  listEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.tz-counter__btn');
    if (!btn) return;
    var id = btn.dataset.id;
    var tt = event.ticket_types.find(function(t) { return t.id === id; });
    if (!tt) return;
    if (btn.classList.contains('tz-counter__btn--plus')) {
      if (counts[id] < tt.max) counts[id]++;
    } else {
      if (counts[id] > 0) counts[id]--;
    }
    document.getElementById('tz-count-' + id).textContent = counts[id];
    updateRow(id, counts[id]);
    updateContinue();
  });

  function updateRow(id, count) {
    var row = document.getElementById('tz-row-' + id);
    if (count > 0) {
      row.classList.add('tz-ticket-row--selected');
    } else {
      row.classList.remove('tz-ticket-row--selected');
    }
    // Disable minus at 0
    row.querySelector('.tz-counter__btn--minus').disabled = (count === 0);
  }

  function updateContinue() {
    var total = Object.values(counts).reduce(function(a, b) { return a + b; }, 0);
    document.getElementById('tz-continue-btn').disabled = (total === 0);
  }

  document.getElementById('tz-continue-btn').addEventListener('click', function() {
    if (!isTicketingOpen(event)) {
      document.getElementById('tz-tickets-app').innerHTML =
        '<p class="tz-error">Ticket sales have closed for this event. <a href="/events/">View all events</a></p>';
      return;
    }

    var selection = event.ticket_types
      .filter(function(tt) { return counts[tt.id] > 0; })
      .map(function(tt) { return { id: tt.id, name: tt.name, price: tt.price, count: counts[tt.id] }; });
    sessionStorage.setItem('tz_selection', JSON.stringify(selection));
    window.location.href = '/ticket-details/';
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
  function escAttr(str) {
    return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function isTicketingOpen(currentEvent) {
    return !window.TZTicketing || window.TZTicketing.isTicketingOpen(currentEvent);
  }

  // Initialise minus buttons disabled
  event.ticket_types.forEach(function(tt) { updateRow(tt.id, 0); });
})();
</script>

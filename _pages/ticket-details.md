---
layout: ticketing
title: Your Details
permalink: /ticket-details/
hide_navbar: true
---

<div class="tz-shop" id="tz-details-app">
  <a href="/tickets/" class="tz-back-link" id="tz-back-btn">
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
    <div class="tz-step tz-step--active">
      <span class="tz-step__num">2</span>
      <span class="tz-step__label">Details</span>
    </div>
    <div class="tz-step__connector"></div>
    <div class="tz-step">
      <span class="tz-step__num">3</span>
      <span class="tz-step__label">Overview</span>
    </div>
  </div>

  <form class="tz-form" id="tz-details-form" novalidate>
    <div class="tz-form__row tz-form__row--two">
      <div class="tz-form__group">
        <label class="tz-form__label" for="tz-first-name">First name <span class="tz-required">*</span></label>
        <input class="tz-form__input" type="text" id="tz-first-name" name="firstName" autocomplete="given-name" required placeholder="Jana">
        <span class="tz-form__error" id="err-firstName"></span>
      </div>
      <div class="tz-form__group">
        <label class="tz-form__label" for="tz-last-name">Last name <span class="tz-required">*</span></label>
        <input class="tz-form__input" type="text" id="tz-last-name" name="lastName" autocomplete="family-name" required placeholder="Franck">
        <span class="tz-form__error" id="err-lastName"></span>
      </div>
    </div>

    <div class="tz-form__group">
      <label class="tz-form__label" for="tz-email">Email address <span class="tz-optional">(optional)</span></label>
      <input class="tz-form__input" type="email" id="tz-email" name="email" autocomplete="email" placeholder="jana@example.com">
      <span class="tz-form__error" id="err-email"></span>
    </div>

    <div class="tz-form__group">
      <label class="tz-form__label" for="tz-city">City <span class="tz-optional">(optional)</span></label>
      <input class="tz-form__input" type="text" id="tz-city" name="city" autocomplete="address-level2" placeholder="Amsterdam">
      <span class="tz-form__error" id="err-city"></span>
    </div>

    <div class="tz-form__group">
      <label class="tz-form__label" for="tz-dob">Date of birth <span class="tz-optional">(optional)</span></label>
      <input class="tz-form__input" type="date" id="tz-dob" name="dateOfBirth" autocomplete="bday">
    </div>

    <div class="tz-form__group">
      <label class="tz-form__label" for="tz-notes">Notes <span class="tz-optional">(optional)</span></label>
      <textarea class="tz-form__input tz-form__input--textarea" id="tz-notes" name="notes" rows="4" placeholder="Anything we should know?"></textarea>
    </div>

    <div class="tz-shop__footer">
      <div class="tz-shop__total">
        <span class="tz-shop__total-label">Total</span>
        <span class="tz-shop__total-amount">Free</span>
      </div>
      <button class="tz-btn tz-btn--primary" type="submit">
        Continue
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon"><path fill-rule="evenodd" d="M16.72 7.72a.75.75 0 011.06 0l3.75 3.75a.75.75 0 010 1.06l-3.75 3.75a.75.75 0 11-1.06-1.06l2.47-2.47H3a.75.75 0 010-1.5h16.19l-2.47-2.47a.75.75 0 010-1.06z" clip-rule="evenodd" /></svg>
      </button>
    </div>
  </form>
</div>

<script>
(function() {
  var event = JSON.parse(sessionStorage.getItem('tz_event') || 'null');
  var selection = JSON.parse(sessionStorage.getItem('tz_selection') || 'null');

  if (!event || !selection) {
    document.getElementById('tz-details-app').innerHTML =
      '<p class="tz-error">No active reservation. <a href="/events/">Start over</a></p>';
    return;
  }

  if (!isTicketingOpen(event)) {
    document.getElementById('tz-details-app').innerHTML =
      '<p class="tz-error">Ticket sales have closed for this event. <a href="/events/">View all events</a></p>';
    return;
  }

  // Fix back link to include event id
  document.getElementById('tz-back-btn').href = '/tickets/?event=' + encodeURIComponent(event.id);

  // Render event header (include invite-only flag if present)
  document.getElementById('tz-event-header').innerHTML =
    '<div class="tz-event-banner">' +
      '<div class="tz-event-banner__date-badge">' + formatDateBadge(event.date) + '</div>' +
      '<div class="tz-event-banner__info">' +
        '<h2 class="tz-event-banner__title">' + escHtml(event.title) + '</h2>' +
        (event.invite_only ? '<div class="tz-event-card__flag">Invite only</div>' : '') +
        '<p class="tz-event-banner__meta">' + escHtml(event.date) + ' &bull; ' + escHtml(event.time) + '</p>' +
        '<p class="tz-event-banner__location">' + escHtml(event.location) + '</p>' +
      '</div>' +
    '</div>';

  // Pre-fill saved details
  var saved = JSON.parse(sessionStorage.getItem('tz_details') || 'null');
  if (saved) {
    ['firstName','lastName','email','city','dateOfBirth','notes'].forEach(function(k) {
      var el = document.querySelector('[name="' + k + '"]');
      if (el && saved[k] != null) el.value = saved[k];
    });
  }

  // Form validation & submission
  document.getElementById('tz-details-form').addEventListener('submit', function(e) {
    e.preventDefault();

    if (!isTicketingOpen(event)) {
      document.getElementById('tz-details-app').innerHTML =
        '<p class="tz-error">Ticket sales have closed for this event. <a href="/events/">View all events</a></p>';
      return;
    }

    var valid = true;

    var fields = [
      { name: 'firstName', label: 'First name' },
      { name: 'lastName',  label: 'Last name' }
    ];

    fields.forEach(function(f) {
      var el = document.querySelector('[name="' + f.name + '"]');
      var err = document.getElementById('err-' + f.name);
      var val = el.value.trim();
      if (!val) {
        err.textContent = f.label + ' is required.';
        el.classList.add('tz-form__input--error');
        valid = false;
      } else {
        err.textContent = '';
        el.classList.remove('tz-form__input--error');
      }
    });

    if (!validateOptionalEmail()) {
      valid = false;
    }

    if (!valid) return;

    var details = {
      firstName: document.querySelector('[name="firstName"]').value.trim(),
      lastName:  document.querySelector('[name="lastName"]').value.trim(),
      email:     document.querySelector('[name="email"]').value.trim(),
      city:      document.querySelector('[name="city"]').value.trim(),
      dateOfBirth: document.querySelector('[name="dateOfBirth"]').value || null,
      notes: document.querySelector('[name="notes"]').value.trim() || ''
    };

    sessionStorage.setItem('tz_details', JSON.stringify(details));
    window.location.href = '/ticket-overview/';
  });

  // Clear errors on input
  document.querySelectorAll('.tz-form__input').forEach(function(el) {
    el.addEventListener('input', function() {
      var name = el.getAttribute('name');
      var err = document.getElementById('err-' + name);
      if (err) err.textContent = '';
      el.classList.remove('tz-form__input--error');

      if (name === 'email') {
        validateOptionalEmail();
      }
    });
  });

  function validateOptionalEmail() {
    var emailEl = document.querySelector('[name="email"]');
    var err = document.getElementById('err-email');
    var val = emailEl.value.trim();

    if (!val) {
      err.textContent = '';
      emailEl.classList.remove('tz-form__input--error');
      return true;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      err.textContent = 'Please enter a valid email address.';
      emailEl.classList.add('tz-form__input--error');
      return false;
    }

    err.textContent = '';
    emailEl.classList.remove('tz-form__input--error');
    return true;
  }

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

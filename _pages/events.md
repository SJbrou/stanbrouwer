---
layout: ticketing
title: Events
permalink: /events/
hide_navbar: true
---

<script>
window.TZ_EVENTS = {{ site.data.events | jsonify }};
</script>

<div class="tz-shop">
  <div class="tz-shop__header">
    <!-- Title moved into sections below -->
  </div>

  {% assign now_epoch = site.time | date: "%s" %}
  {% assign events_sorted = site.data.events | sort: "date_iso" %}

  <div class="tz-events-section tz-events-section--upcoming" id="tz-upcoming-section">
    <h2 class="tz-events-section__title">Upcoming Events</h2>
    <div class="tz-events-list tz-events-list--upcoming" id="tz-upcoming-list">
    {% assign has_upcoming = false %}
    {% for event in events_sorted %}
      {% assign event_epoch = event.date_iso | date: "%s" %}
      {% if event_epoch >= now_epoch and event.show_in_list != false %}
        {% assign has_upcoming = true %}
        <a class="tz-event-card" href="/tickets/?event={{ event.id }}" data-event-id="{{ event.id }}">
          <div class="tz-event-card__media">
            {% if event.image %}
              <div class="tz-event-card__thumb"><img src="{{ event.image | relative_url }}" alt="{{ event.title }}"></div>
            {% else %}
              <div class="tz-event-card__date-badge">
                <span class="tz-event-card__date-full">{{ event.date_iso | date: "%d %b" | downcase }}</span>
              </div>
            {% endif %}
          </div>
          <div class="tz-event-card__body">
            <h2 class="tz-event-card__title">{{ event.title }}</h2>
            {% if event.invite_only %}
              <div class="tz-event-card__flag">Invite only</div>
            {% endif %}
            <p class="tz-event-card__meta">
              <span class="tz-event-card__time">{{ event.date }} &bull; {{ event.time }}</span>
            </p>
            <p class="tz-event-card__location">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.079 3.218-4.332 3.218-7.327a7.5 7.5 0 10-15 0c0 2.995 1.274 5.248 3.218 7.327a19.575 19.575 0 002.682 2.282 16.985 16.985 0 001.145.742z" clip-rule="evenodd" /></svg>
              {{ event.location }}
            </p>
            <p class="tz-event-card__description">{{ event.description }}</p>
          </div>
          <div class="tz-event-card__arrow">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clip-rule="evenodd" /></svg>
          </div>
        </a>
      {% endif %}
    {% endfor %}
    </div>
    <p class="tz-no-events" id="tz-no-upcoming"{% if has_upcoming %} hidden{% endif %}>No upcoming events.</p>
  </div>

  <div style="height:24px" id="tz-past-spacer"{% unless has_upcoming %} hidden{% endunless %}></div>
  <div class="tz-events-section tz-events-section--past" id="tz-past-section">
    <h2 class="tz-events-section__title">Past Events</h2>
    <div class="tz-events-list tz-events-list--past" id="tz-past-list">
      {% for event in events_sorted reversed %}
        {% assign event_epoch = event.date_iso | date: "%s" %}
        {% if event_epoch < now_epoch and event.show_in_list != false %}
          <a class="tz-event-card tz-event-card--past tz-event-card--disabled" href="/tickets/?event={{ event.id }}" data-event-id="{{ event.id }}" aria-disabled="true">
            <div class="tz-event-card__media">
              {% if event.image %}
                <div class="tz-event-card__thumb"><img src="{{ event.image | relative_url }}" alt="{{ event.title }}"></div>
              {% else %}
                <div class="tz-event-card__date-badge">
                  <span class="tz-event-card__date-full">{{ event.date_iso | date: "%d %b" | downcase }}</span>
                </div>
              {% endif %}
            </div>
            <div class="tz-event-card__body">
              <h2 class="tz-event-card__title">{{ event.title }}</h2>
              {% if event.invite_only %}
                <div class="tz-event-card__flag">Invite only</div>
              {% endif %}
              <p class="tz-event-card__meta">
                <span class="tz-event-card__time">{{ event.date }} &bull; {{ event.time }}</span>
              </p>
              <p class="tz-event-card__description">{{ event.description }}</p>
            </div>
            <div class="tz-event-card__arrow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clip-rule="evenodd" /></svg>
            </div>
          </a>
        {% endif %}
      {% endfor %}
    </div>
  </div>

</div>

<script>
(function() {
  var upcomingList = document.getElementById('tz-upcoming-list');
  var pastList = document.getElementById('tz-past-list');
  var noUpcoming = document.getElementById('tz-no-upcoming');
  var pastSection = document.getElementById('tz-past-section');
  var pastSpacer = document.getElementById('tz-past-spacer');
  var cardsById = {};

  document.querySelectorAll('.tz-event-card[data-event-id]').forEach(function(card) {
    cardsById[card.getAttribute('data-event-id')] = card;
  });

  Object.keys(cardsById).forEach(function(eventId) {
    resetEventCard(cardsById[eventId], eventId);
  });

  (window.TZ_EVENTS || []).forEach(function(event) {
    var card = cardsById[event.id];
    var isPast;

    if (!card || event.show_in_list === false) {
      return;
    }

    isPast = window.TZTicketing ? !window.TZTicketing.isTicketingOpen(event) : false;

    if (isPast) {
      pastList.appendChild(card);
      disableEventCard(card, 'Ticket sales closed');
    } else {
      upcomingList.appendChild(card);

      if (!Array.isArray(event.ticket_types) || event.ticket_types.length === 0) {
        disableEventCard(card, 'Tickets unavailable');
      }
    }
  });

  noUpcoming.hidden = upcomingList.children.length > 0;
  pastSection.hidden = pastList.children.length === 0;
  pastSpacer.hidden = pastList.children.length === 0;

  function resetEventCard(card, eventId) {
    var status = card.querySelector('.tz-event-card__status');

    card.classList.remove('tz-event-card--disabled', 'tz-event-card--past');
    card.setAttribute('href', '/tickets/?event=' + encodeURIComponent(eventId));
    card.removeAttribute('aria-disabled');

    if (status) {
      status.remove();
    }
  }

  function disableEventCard(card, message) {
    var status = document.createElement('p');
    var description = card.querySelector('.tz-event-card__description');

    card.classList.add('tz-event-card--disabled');
    if (message === 'Ticket sales closed') {
      card.classList.add('tz-event-card--past');
    }
    card.removeAttribute('href');
    card.setAttribute('aria-disabled', 'true');

    if (card.querySelector('.tz-event-card__status')) {
      return;
    }

    status.className = 'tz-event-card__status';
    status.textContent = message;

    if (description) {
      description.insertAdjacentElement('afterend', status);
    } else {
      card.querySelector('.tz-event-card__body').appendChild(status);
    }
  }
})();
</script>

---
layout: ticketing
title: Events
permalink: /events/
---

<div class="tz-shop">
  <div class="tz-shop__header">
    <h1 class="tz-shop__title">Upcoming Events</h1>
  </div>

  <div class="tz-events-list">
    {% for event in site.data.events %}
    <a class="tz-event-card" href="/tickets/?event={{ event.id }}">
      <div class="tz-event-card__date-badge">
        <span class="tz-event-card__date-month">{{ event.date | date: "%b" | upcase }}</span>
        <span class="tz-event-card__date-day">{{ event.date | date: "%-d" }}</span>
      </div>
      <div class="tz-event-card__body">
        <h2 class="tz-event-card__title">{{ event.title }}</h2>
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
    {% endfor %}
  </div>
</div>

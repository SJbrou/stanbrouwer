---
layout: page
title: VU
permalink: /VU.html
background: '/assets/img/bg-post.jpg'
---

<section id="feed">
  <div class="container-lg">
    <h1>Thoughts</h1>

    <ul class="list-unstyled">
{% assign sorted_posts = site.posts | sort: 'date' | reverse %}
{% assign current_month = "" %}
{% assign current_year = "" %}
{% assign current_year_today = "now" | date: "%Y" %}

{% for post in sorted_posts %}
  {% if post.tags and post.tags contains "VU" %}  <!-- Filter on post.tags -->
    {% assign post_month = post.date | date: "%B" %}
    {% assign post_year = post.date | date: "%Y" %}

    {% if post_year != current_year and post_year != current_year_today %}
      <div class="year-separator">
        <span>{{ post_year }}</span>
      </div>
      {% assign current_year = post_year %}
    {% endif %}

    {% if post_month != current_month %}
      <div class="month-separator-space"></div>
      <div class="month-separator">
        <span>{{ post_month }}</span>
      </div>
      {% assign current_month = post_month %}
    {% endif %}

    <li>
      <div class="post-entry d-flex justify-content-between">
        <div class="post-details">
          <span class="post-title"><a href="{{ post.url | relative_url }}">{{ post.title }}</a></span>
          <div class="post-separator"></div>
          <span class="post-subtitle">{{ post.subtitle }}</span>
        </div>
        <span class="post-date">
          {% assign day = post.date | date: "%d" %}
          {% assign day_int = day | plus: 0 %}
          {% if day_int == 11 or day_int == 12 or day_int == 13 %}
            {{ day }}th
          {% else %}
            {% case day_int %}
              {% when 1 %}{{ day }}st
              {% when 2 %}{{ day }}nd
              {% when 3 %}{{ day }}rd
              {% else %}{{ day }}th
            {% endcase %}
          {% endif %}
        </span>
      </div>
    </li>
  {% endif %}
{% endfor %}

    </ul>
  </div>
</section>

<style>
#feed .container {
  padding: 20px;
}

#feed .month-separator {
  text-align: right; /* Align the month separator to the right */
  /* font-weight: bold; /* Optional: make it stand out more */
  font-size: 1.1rem; /* Optional: adjust size if needed */
  margin-top: 20px; /* Optional: some spacing above the month separator */
  margin-bottom: 10px; /* Optional: some spacing below */
  color: #333; /* Optional: color adjustment */
}

#feed .year-separator {
  text-align: right; /* Align the year separator to the right */
  font-weight: bold; /* Optional: make it stand out more */
  font-size: 1.2rem; /* Optional: adjust size if needed */
  margin-top: 20px; /* Optional: some spacing above the year separator */
  margin-bottom: 10px; /* Optional: some spacing below */
  color: #333; /* Optional: color adjustment */
}

/* Default layout for smaller screens */
#feed .post-entry {
  margin-bottom: 20px;
}

/* On medium (tablet) and large (desktop) screens, we will adjust the width */
@media (min-width: 768px) {
  #feed .container {
    width: 90%; /* Adjust width for tablets */
    max-width: 960px; /* Limit max width */
  }
}

@media (min-width: 1024px) {
  #feed .container {
    width: 80%; /* Make the feed wider on larger screens */
    max-width: 1200px; /* Limit max width */
  }
}

#feed .post-subtitle {
  font-size: 0.9rem; /* Slightly smaller font size */
  font-style: italic; /* Make the subtitle italic */
  margin-top: 5px; /* Add a bit of space between the title and subtitle */
}
</style>
---
layout: page
title: Thoughts feed
permalink: /thoughts-feed.html
---

<p id="feed-title">Thoughts feed</p>
<div id="thoughts-feed" class="thoughts-feed"></div>

<script>
document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("thoughts-feed");
  const title = document.getElementById("feed-title");
  const selectedTag = new URLSearchParams(window.location.search).get("tag");

  const thoughts = [
    {% assign thought_posts = site.posts | where_exp: "post", "post.tags contains 'Thoughts'" %}
    {% for post in thought_posts %}
      {
        title: {{ post.title | jsonify }},
        description: {{ post.description | default: "" | jsonify }},
        excerpt: {{ post.excerpt | strip_html | strip_newlines | truncate: 200 | jsonify }},
        date: "{{ post.date | date: '%Y-%m-%d' }}",
        url: "{{ post.url | relative_url }}",
        tags: {{ post.tags | jsonify }}
      }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ];

  const filteredThoughts = selectedTag
    ? thoughts.filter(post => post.tags.includes(selectedTag))
    : thoughts;

  title.innerText = selectedTag ? `Thoughts tagged with ${selectedTag}` : "Thoughts feed";

  if (filteredThoughts.length === 0) {
    container.innerHTML = "<p>No thoughts found for this tag.</p>";
    return;
  }

  container.innerHTML = filteredThoughts.map(post => `
    <article class="thought-card">
      <p class="thought-date">${post.date}</p>
      <h2><a href="${post.url}">${post.title}</a></h2>
      ${post.description ? `<p>${post.description}</p>` : ""}
      <p>${post.excerpt}</p>
    </article>
  `).join("");
});
</script>

<style>
#feed-title {
  margin: 0 0 0.8rem;
  font-size: 1.15rem;
  color: var(--color-text-muted);
}

.thoughts-feed {
  max-height: 70vh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.thought-card {
  scroll-snap-align: start;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.thought-card h2 {
  margin: 0.2rem 0;
  font-size: 1.2rem;
}

.thought-date {
  margin: 0;
  color: var(--color-text-muted);
}
</style>

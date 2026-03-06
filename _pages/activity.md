---
layout: page
title:
permalink: /activity.html
---

<section class="activity-intro">
  <p id="category-text">All posts by category and tag.</p>
</section>

<section class="activity-controls">
  <div id="category-filter-buttons" class="pill-row">
    <button class="category-button active" data-category="all">All</button>
    <button class="category-button" data-category="Thoughts">Thoughts</button>
    <button class="category-button" data-category="Projects">Projects</button>
    <button class="category-button" data-category="Books">Books</button>
    <button class="category-button" data-category="CV">CV</button>
  </div>

  <div id="tag-filter" class="tag-filter hidden">
    <span class="filter-label">Tag</span>
    <div id="tag-filter-buttons" class="pill-row"></div>
  </div>

  <a id="thoughts-feed-link" class="hidden" href="#">Open thoughts feed</a>
  <button id="timeline-toggle" class="hidden" type="button">Toggle CV timeline</button>
</section>

<section id="cv-timeline" class="hidden"></section>

<section id="activity-feed">
  <ul id="activity-list"></ul>
</section>

<script>
document.addEventListener("DOMContentLoaded", function () {
  const primaryCategories = ["Thoughts", "Projects", "Books", "CV"];
  const categoryButtons = document.querySelectorAll(".category-button");
  const tagFilter = document.getElementById("tag-filter");
  const tagButtonsContainer = document.getElementById("tag-filter-buttons");
  const activityList = document.getElementById("activity-list");
  const categoryText = document.getElementById("category-text");
  const timelineToggle = document.getElementById("timeline-toggle");
  const timeline = document.getElementById("cv-timeline");
  const thoughtsFeedLink = document.getElementById("thoughts-feed-link");

  const allPosts = [
    {% for post in site.posts %}
    {
      title: {{ post.title | jsonify }},
      description: {{ post.description | default: "" | jsonify }},
      url: "{{ post.url | relative_url }}",
      tags: {{ post.tags | jsonify }},
      year: "{{ post.date | date: '%Y' }}",
      month: "{{ post.date | date: '%B' }}",
      day: "{{ post.date | date: '%d' }}",
      isoDate: "{{ post.date | date: '%Y-%m-%d' }}"
    }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ];

  let selectedCategory = "all";
  let selectedTag = "all";

  function getPrimaryCategory(tags) {
    const normalized = (tags || []).map(tag => String(tag).trim());
    const matched = primaryCategories.find(category => normalized.includes(category));
    if (matched) return matched;
    if (normalized.includes("VU") || normalized.includes("Thesis")) return "Projects";
    return "Thoughts";
  }

  function getSecondaryTags(tags) {
    return (tags || []).filter(tag => !primaryCategories.includes(tag));
  }

  function getPostsForCategory(category) {
    if (category === "all") return allPosts;
    return allPosts.filter(post => getPrimaryCategory(post.tags) === category);
  }

  function getVisiblePosts() {
    const postsByCategory = getPostsForCategory(selectedCategory);
    if (selectedTag === "all") return postsByCategory;
    return postsByCategory.filter(post => getSecondaryTags(post.tags).includes(selectedTag));
  }

  function updateTagButtons() {
    const postsByCategory = getPostsForCategory(selectedCategory);
    const dynamicTags = [...new Set(postsByCategory.flatMap(post => getSecondaryTags(post.tags)))].sort();

    if (selectedCategory === "all") {
      tagFilter.classList.add("hidden");
      selectedTag = "all";
      return;
    }

    tagFilter.classList.remove("hidden");
    tagButtonsContainer.innerHTML = "";

    const allButton = document.createElement("button");
    allButton.className = `tag-button ${selectedTag === "all" ? "active" : ""}`;
    allButton.dataset.tag = "all";
    allButton.innerText = "All tags";
    tagButtonsContainer.appendChild(allButton);

    dynamicTags.forEach(tag => {
      const button = document.createElement("button");
      button.className = `tag-button ${selectedTag === tag ? "active" : ""}`;
      button.dataset.tag = tag;
      button.innerText = tag;
      tagButtonsContainer.appendChild(button);
    });

    if (selectedTag !== "all" && !dynamicTags.includes(selectedTag)) {
      selectedTag = "all";
    }
  }

  function updateURL() {
    const url = new URL(window.location.href);

    if (selectedCategory === "all") {
      url.searchParams.delete("category");
      url.searchParams.delete("tag");
    } else {
      url.searchParams.set("category", selectedCategory);
      if (selectedTag === "all") {
        url.searchParams.delete("tag");
      } else {
        url.searchParams.set("tag", selectedTag);
      }
    }

    history.replaceState({}, "", url);
  }

  function getHeaderText() {
    if (selectedCategory === "all") return "All posts by category and tag.";
    if (selectedTag !== "all") return `${selectedCategory} tagged with ${selectedTag}.`;
    return `${selectedCategory} posts.`;
  }

  function renderTimeline(posts) {
    if (selectedCategory !== "CV") {
      timeline.classList.add("hidden");
      timeline.innerHTML = "";
      timelineToggle.classList.add("hidden");
      return;
    }

    timelineToggle.classList.remove("hidden");
    timeline.innerHTML = posts.map(post => `
      <article class="timeline-item">
        <h3>${post.title}</h3>
        <p>${post.description || "CV entry"}</p>
      </article>
    `).join("");
  }

  function renderThoughtsFeedLink() {
    if (selectedCategory !== "Thoughts") {
      thoughtsFeedLink.classList.add("hidden");
      return;
    }

    const feedUrl = new URL("{{ '/thoughts-feed.html' | relative_url }}", window.location.origin);
    if (selectedTag !== "all") feedUrl.searchParams.set("tag", selectedTag);

    thoughtsFeedLink.href = feedUrl.pathname + feedUrl.search;
    thoughtsFeedLink.classList.remove("hidden");
  }

  function renderPosts() {
    const visiblePosts = getVisiblePosts();
    let currentYear = "";
    let currentMonth = "";

    activityList.innerHTML = "";

    visiblePosts.forEach(post => {
      const isNewYear = post.year !== currentYear;
      const isNewMonth = post.month !== currentMonth;

      if (isNewYear || isNewMonth) {
        const separator = document.createElement("li");
        separator.className = "year-month-separator";
        separator.innerHTML = isNewYear
          ? `<span class="year">${post.year}</span><span class="month">${post.month}</span>`
          : `<span class="month only">${post.month}</span>`;
        activityList.appendChild(separator);
        currentYear = post.year;
        currentMonth = post.month;
      }

      const item = document.createElement("li");
      item.className = "post-item";
      item.innerHTML = `
        <div class="post-details">
          <span class="post-title"><a href="${post.url}">${post.title}</a></span>
          <span class="post-date">${post.day}</span>
        </div>
        ${post.description ? `<p class="post-description">${post.description}</p>` : ""}
      `;
      activityList.appendChild(item);
    });

    categoryText.innerText = getHeaderText();
    renderTimeline(visiblePosts);
    renderThoughtsFeedLink();
  }

  categoryButtons.forEach(button => {
    button.addEventListener("click", function () {
      selectedCategory = this.dataset.category;
      selectedTag = "all";

      categoryButtons.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");

      updateTagButtons();
      renderPosts();
      updateURL();
    });
  });

  tagButtonsContainer.addEventListener("click", function (event) {
    const target = event.target;
    if (!target.classList.contains("tag-button")) return;

    selectedTag = target.dataset.tag;
    updateTagButtons();
    renderPosts();
    updateURL();
  });

  timelineToggle.addEventListener("click", function () {
    timeline.classList.toggle("hidden");
  });

  const params = new URLSearchParams(window.location.search);
  const categoryParam = params.get("category");
  const tagParam = params.get("tag");

  if (categoryParam && ["all", ...primaryCategories].includes(categoryParam)) {
    selectedCategory = categoryParam;
    categoryButtons.forEach(button => {
      button.classList.toggle("active", button.dataset.category === selectedCategory);
    });
  }

  if (tagParam) {
    selectedTag = tagParam;
  }

  updateTagButtons();
  renderPosts();
});
</script>

<style>
.activity-intro {
  margin-bottom: 1rem;
}

#category-text {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-text);
}

.activity-controls {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.category-button,
.tag-button,
#timeline-toggle {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
}

.category-button.active,
.tag-button.active,
#timeline-toggle {
  background: var(--color-accent);
  color: var(--color-background);
  border-color: var(--color-accent);
}

#timeline-toggle {
  width: fit-content;
}

#thoughts-feed-link {
  width: fit-content;
  padding: 0.25rem 0;
}

.tag-filter {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.filter-label {
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.hidden {
  display: none;
}

#activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.year-month-separator {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  border-top: 1px solid var(--color-border);
  padding-top: 0.6rem;
}

.post-item {
  margin: 0.2rem 0;
  padding: 0.35rem 0;
}

.post-details {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.post-title {
  font-weight: 600;
}

.post-date {
  color: var(--color-text-muted);
}

.post-description {
  margin: 0.2rem 0 0;
  color: var(--color-text-muted);
}

#cv-timeline {
  margin: 1rem 0 1.3rem;
  border-left: 2px solid var(--color-tertiary);
  padding-left: 1.2rem;
}

.timeline-item {
  position: relative;
  margin-bottom: 1rem;
}

.timeline-item::before {
  content: "";
  position: absolute;
  left: -1.56rem;
  top: 0.55rem;
  width: 0.68rem;
  height: 0.68rem;
  border-radius: 50%;
  background: var(--color-tertiary);
}

.timeline-item h3 {
  margin: 0;
  font-size: 1.05rem;
}

.timeline-item p {
  margin: 0.15rem 0 0;
  color: var(--color-text-muted);
}
</style>

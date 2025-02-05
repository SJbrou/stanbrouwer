---
layout: page
title:
permalink: /activity.html
background: '/assets/img/at-the-office-cropped.jpeg'
---

<!-- Conditional Text -->
<p id="category-text">
  <span id="text-content">All posts. </span><span id="caret">|</span>
</p>

<!-- Category Buttons -->
<div id="category-filter-buttons">
  <button class="category-button active" data-category="all">All</button>
  
  <!-- Generate buttons from all post tags -->
  {% assign all_categories = site.posts | map:"tags" | join: "," | split: "," | uniq | sort %}
  {% for category in all_categories %}
    {% if category != "" %}
      <button class="category-button" data-category="{{ category }}">{{ category }}</button>
    {% endif %}
  {% endfor %}
</div>

<section id="activity-feed">
  <ul id="activity-list"></ul>
</section>

<script>
document.addEventListener("DOMContentLoaded", function () {
  const buttons = document.querySelectorAll(".category-button");
  const activityList = document.getElementById("activity-list");
  const textContent = document.getElementById("text-content");
  const caret = document.getElementById("caret");
  
  // Global store intervals so we can cancel them
  let deleteInterval = null;
  let typeInterval = null;

  let activeCategories = new Set(["all"]); // Default category

  textContent.innerText = "";

  // URL update based on filters
  function updateURL() {
    const newUrl = new URL(window.location.href);
    if (activeCategories.has("all")) {
      newUrl.searchParams.delete("active");
    } else {
      newUrl.searchParams.set("active", Array.from(activeCategories).join(","));
    }
    history.pushState({}, "", newUrl);
  }

  // Update posts based on the filter.
  function updatePosts() {
    activityList.innerHTML = "";
    let currentYear = "";
    let currentMonth = "";
    let visiblePosts = [];

    const allPosts = [
      {% for post in site.posts %}
      {
        title: "{{ post.title }}",
        description: "{{ post.description | default: '&nbsp;' }}",
        url: "{{ post.url | relative_url }}",
        categories: "{{ post.tags | join: ',' }}",
        year: "{{ post.date | date: '%Y' }}",
        month: "{{ post.date | date: '%B' }}",
        day: "{{ post.date | date: '%d' }}"
      },
      {% endfor %}
    ];

    if (activeCategories.has("all")) {
      visiblePosts = allPosts;
    } else {
      visiblePosts = allPosts.filter(post => {
        const postCategories = post.categories.split(",");
        return postCategories.some(cat => activeCategories.has(cat));
      });
    }

    visiblePosts.forEach(post => {
      let separatorHTML = "";
      if (post.year !== currentYear || post.month !== currentMonth) {
        separatorHTML = `
          <li class="year-month-separator">
            <span class="year">${post.year}</span>
            <span class="month">${post.month}</span>
          </li>
        `;
        currentYear = post.year;
        currentMonth = post.month;
      }

      const postHTML = `
        ${separatorHTML}
        <li class="post-item" data-categories="${post.categories}">
          <div class="post-details">
            <span class="post-title"><a href="${post.url}">${post.title}</a></span>
            <span class="post-date">${post.day}</span>
          </div>
          ${post.description ? `<p class="post-description">${post.description}</p>` : ""}
        </li>
      `;
      activityList.insertAdjacentHTML("beforeend", postHTML);
    });

    updateConditionalText();
  }

  // The animateText function cancels any previous animation and then:
  // 1. Backspaces (deletes) the current text (fast),
  // 2. Types out the new text (slower).
function animateText(newText) {
  if (deleteInterval) {
    clearInterval(deleteInterval);
    deleteInterval = null;
  }
  if (typeInterval) {
    clearInterval(typeInterval);
    typeInterval = null;
  }

  let currentText = textContent.innerText;
  if (currentText === newText) return;

  // Determine longest commin prefix so it is not deleted.
  let commonPrefixLen = 0;
  const minLen = Math.min(currentText.length, newText.length);
  while (
    commonPrefixLen < minLen &&
    currentText.charAt(commonPrefixLen) === newText.charAt(commonPrefixLen)
  ) {
    commonPrefixLen++;
  }

  const deleteSpeed = 50;
  const typeSpeed = 80;

  // Delete characters after the common prefix.
  function startDeletion() {
    deleteInterval = setInterval(() => {
      if (currentText.length > commonPrefixLen) {
        currentText = currentText.slice(0, -1);
        textContent.innerText = currentText;
      } else {
        clearInterval(deleteInterval);
        deleteInterval = null;
        startTyping();
      }
    }, deleteSpeed);
  }

  // Type new text from the common prefix onward.
  function startTyping() {
    let index = commonPrefixLen;
    typeInterval = setInterval(() => {
      if (index < newText.length) {
        currentText += newText.charAt(index);
        textContent.innerText = currentText;
        index++;
      } else {
        clearInterval(typeInterval);
        typeInterval = null;
      }
    }, typeSpeed);
  }

  // If current text has extra characters beyond the common prefix, delete them. Else, type directly.
  if (currentText.length > commonPrefixLen) {
    startDeletion();
  } else {
    startTyping();
  }
}


  // Determine new text based on active category.
  function updateConditionalText() {
    let newText = "";
    if (activeCategories.has("all")) {
      newText = "All posts. ";
    } else if (activeCategories.size === 1) {
      const category = Array.from(activeCategories)[0].toLowerCase();
      if (category === "projects") {
        newText = "All portfolio projects. ";
      } else if (category === "thoughts") {
        newText = "All my thoughts. ";
      } else if (category === "vu") {
        newText = "All my VU projects. ";
      } else {
        newText = "All posts. ";
      }
    }
    animateText(newText);
  }

  // Button click. Ensures only a single category can be active.
  buttons.forEach(button => {
    button.addEventListener("click", function () {
      const category = this.dataset.category;

      if (category === "all") {
        activeCategories = new Set(["all"]);
      } else {
        activeCategories.clear();
        activeCategories.add(category);
      }

      // Update button active classes.
      buttons.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");

      updateURL();
      updatePosts();
    });
  });

  // Initial rendering: animate the text and render posts.
  updatePosts();
});

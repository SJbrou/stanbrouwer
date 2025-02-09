---
layout: page
title:
permalink: /activity.html
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

  // Global variables for text animation intervals.
  let deleteInterval = null;
  let typeInterval = null;
  let activeCategories = new Set(["all"]); // Default category

  // This variable tracks the version of the animation.
  // Each time updatePosts() is called, we increment this version.
  let currentAnimationVersion = 0;

  // Clear the text content on page load so it can be typed.
  textContent.innerText = "";

  // Update URL based on filters (optional)
  function updateURL() {
    const newUrl = new URL(window.location.href);
    if (activeCategories.has("all")) {
      newUrl.searchParams.delete("active");
    } else {
      newUrl.searchParams.set("active", Array.from(activeCategories).join(","));
    }
    history.pushState({}, "", newUrl);
  }

  // Remove existing items from the list one by one (bottom to top).
  // Each timeout callback checks the passed version.
  function removeItemsSequentially(version, callback) {
    let items = Array.from(activityList.children);
    if (items.length === 0) {
      callback();
      return;
    }
    // Reverse order to remove bottom-to-top.
    items.reverse();
    let index = 0;
    function removeNext() {
      if (version !== currentAnimationVersion) return; // a new animation has started, abort.
      if (index < items.length) {
        const item = items[index];
        item.classList.remove("fade-in");
        item.classList.add("fade-out");
        setTimeout(() => {
          // Before removing, check version again.
          if (version !== currentAnimationVersion) return;
          item.remove();
          index++;
          removeNext();
        }, 50); // Delay between removals (adjust as needed)
      } else {
        callback();
      }
    }
    removeNext();
  }

  // Build and append new items (sequentially with fade-in).
  // Also uses the animation version to abort if outdated.
  function renderNewItems(version) {
    let items = [];
    let currentYear = "";
    let currentMonth = "";

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

    let visiblePosts = [];
    if (activeCategories.has("all")) {
      visiblePosts = allPosts;
    } else {
      visiblePosts = allPosts.filter(post => {
        const postCategories = post.categories.split(",");
        return postCategories.some(cat => activeCategories.has(cat));
      });
    }

    visiblePosts.forEach(post => {
      // Add a year/month separator if needed.
      if (post.year !== currentYear || post.month !== currentMonth) {
        const separator = document.createElement("li");
        separator.classList.add("year-month-separator");
        separator.innerHTML = `<span class="year">${post.year}</span><span class="month">${post.month}</span>`;
        items.push(separator);
        currentYear = post.year;
        currentMonth = post.month;
      }
      // Create the post entry.
      const listItem = document.createElement("li");
      listItem.classList.add("post-item");
      listItem.setAttribute("data-categories", post.categories);
      listItem.innerHTML = `
        <div class="post-details">
          <span class="post-title"><a href="${post.url}">${post.title}</a></span>
          <span class="post-date">${post.day}</span>
        </div>
        ${post.description ? `<p class="post-description">${post.description}</p>` : ""}
      `;
      items.push(listItem);
    });

    function appendItemsSequentially(index) {
      if (version !== currentAnimationVersion) return; // abort if a new animation started
      if (index < items.length) {
        activityList.appendChild(items[index]);
        items[index].classList.add("fade-in");
        setTimeout(() => {
          if (version !== currentAnimationVersion) return;
          appendItemsSequentially(index + 1);
        }, 50);
      }
    }
    appendItemsSequentially(0);
    updateConditionalText();
  }

  // updatePosts: increments the animation version, removes current items, then renders new ones.
function updatePosts() {
  currentAnimationVersion++; // Invalidate any previous animations.
  const version = currentAnimationVersion;

  updateConditionalText(); // Update the category text immediately
  removeItemsSequentially(version, function () {
    renderNewItems(version);
  });
}


  // animateText: Cancels any current text animation and then (using common-prefix logic)
  // deletes extra characters and types the new text.
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
    let commonPrefixLen = 0;
    const minLen = Math.min(currentText.length, newText.length);
    while (
      commonPrefixLen < minLen &&
      currentText.charAt(commonPrefixLen) === newText.charAt(commonPrefixLen)
    ) {
      commonPrefixLen++;
    }
    const deleteSpeed = 30;
    const typeSpeed = 30;
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
    if (currentText.length > commonPrefixLen) {
      startDeletion();
    } else {
      startTyping();
    }
  }

  // updateConditionalText: Set the text based on the active category.
  function updateConditionalText() {
    let newText = "";
    if (activeCategories.has("all")) {
      newText = "All posts. ";
    } else if (activeCategories.size === 1) {
      const category = Array.from(activeCategories)[0].toLowerCase();
      if (category === "projects") {
        newText = "All my projects. ";
      } else if (category === "thoughts") {
        newText = "A selection of my thoughts. ";
      } else if (category === "vu") {
        newText = "All my university stuff. ";
      } else {
        newText = "All posts. ";
      }
    }
    animateText(newText);
  }

  // Button click handler: Only one category can be active.
  buttons.forEach(button => {
    button.addEventListener("click", function () {
      const category = this.dataset.category;
      if (category === "all") {
        activeCategories = new Set(["all"]);
      } else {
        activeCategories.clear();
        activeCategories.add(category);
      }
      buttons.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");
      updateURL();
      updatePosts();
    });
  });

  // Initial rendering: animate the text and render posts.
  updatePosts();
});
</script>

<style>
/* Fade-in animation for sequential appearance */
.fade-in {
  opacity: 0;
  animation: fadeInAnimation 0.2s forwards;
}
@keyframes fadeInAnimation {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fade-out animation for removal */
.fade-out {
  opacity: 1;
  animation: fadeOutAnimation 0.5s forwards;
}
@keyframes fadeOutAnimation {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}

/* Conditional text */
#category-text {
  margin-bottom: 20px;
  font-size: 1.5rem;
  font-weight: bold;
}

/* Blinking caret */
#caret {
  font-weight: bold;
  animation: blink 1s step-start infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}

/* Category Buttons */
#category-filter-buttons {
  margin-bottom: 20px;
}
.category-button {
  padding: 8px 12px;
  margin: 5px;
  border: none;
  background-color: #ddd;
  cursor: pointer;
}
.category-button.active {
  background-color: #444;
  color: white;
}

/* Activity Feed (Post List) */
#activity-list {
  list-style: none;
  padding: 0;
  min-height: 500px;
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Ensures text starts at the top */
  justify-content: flex-start;
  width: 100%;
  box-sizing: border-box;
}
.year-month-separator {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.2rem;
  font-weight: bold;
  padding: 10px 0;
  margin-top: 20px;
  margin-bottom: 10px;
}
.year-month-separator .year {
  font-size: 1.2rem;
}
.year-month-separator .month {
  font-size: 1rem;
  font-style: italic;
}
.post-item {
  list-style: none;
  padding: 10px 0;
  padding-left: 10px;
}
.post-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.post-title {
  font-weight: bold;
}
.post-title a {
  text-decoration: none;
  color: inherit;
}
.post-date {
  font-size: 14px;
  color: #555;
  min-width: 30px;
  text-align: right;
}
.post-description {
  font-size: 0.9rem;
  color: #777;
  margin-top: 4px;
}
</style>

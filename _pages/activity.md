---
layout: page
title: Activity
permalink: /activity.html
background: '/img/bg-post.jpg'
---

<section id="feed">
  <div class="container-lg">

    <!-- Category Filter Buttons -->
    <div id="category-filters">
      {% assign all_categories = site.posts | map: "tags" | uniq | sort %}
      {% for category in all_categories %}
        <button class="category-button active" data-category="{{ category }}">{{ category }}</button>
      {% endfor %}
    </div>

    <!-- Conditional Text Container -->
    <div id="conditional-text" class="conditional-text">
      <p id="recent-activity">Recent activity</p>
      <p id="text-projects" style="display: none;">My recent projects.</p>
      <p id="text-thoughts" style="display: none;">A collection of my thoughts.</p>
      <p id="text-vu" style="display: none;">University-related projects overview.</p>
    </div>

 <ul class="list-unstyled" id="postList">
  {% assign sorted_posts = site.posts | sort: 'date' | reverse %}
  <div id="post-dates"></div> <!-- Placeholder for dynamically generated dates -->

  {% for post in sorted_posts %}
    {% assign post_month = post.date | date: "%B" %}
    {% assign post_year = post.date | date: "%Y" %}
    <li class="post-item" data-categories="{{ post.tags | join: ',' }}">
      <div class="post-entry d-flex justify-content-between">
        <div class="post-details">
          <span class="post-title"><a href="{{ post.url | relative_url }}">{{ post.title }}</a></span>
          <div class="post-separator"></div>
          <span class="post-subtitle">{{ post.subtitle }}</span>
        </div>
        <span class="post-date" style="display:none;" 
              data-month="{{ post_month }}" data-year="{{ post_year }}">
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
  {% endfor %}
</ul>

  </div>
</section>

<script>
document.addEventListener("DOMContentLoaded", function () {
  const buttons = document.querySelectorAll(".category-button");
  const posts = document.querySelectorAll(".post-item");
  const postList = document.getElementById("postList"); // Container to hold posts
  const textRecent = document.getElementById("recent-activity");
  const textProjects = document.getElementById("text-projects");
  const textThoughts = document.getElementById("text-thoughts");
  const textVU = document.getElementById("text-vu");

  let activeCategories = new Set();

  // Read 'active' category from URL
  const urlParams = new URLSearchParams(window.location.search);
  const activeFilter = urlParams.get('active'); // Get the 'active' filter from URL

  if (activeFilter) {
    // Activate only the specified category
    activeCategories.add(activeFilter);
    buttons.forEach(button => {
      if (button.dataset.category === activeFilter) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  } else {
    // No filter specified, activate all categories
    buttons.forEach(button => {
      activeCategories.add(button.dataset.category);
      button.classList.add("active");
    });
  }

  function updatePosts() {
    let current_month = "";
    let current_year = "";
    let current_year_today = new Date().getFullYear();
    postList.innerHTML = ''; // Clear all posts before re-rendering

    posts.forEach(post => {
      const postCategories = post.dataset.categories.split(",");
      const isVisible = postCategories.some(cat => activeCategories.has(cat));

      // Only show posts that match the active categories
      post.style.display = isVisible ? "block" : "none";

      if (isVisible) {
        const post_date = post.querySelector(".post-date");
        const post_month = post_date.getAttribute('data-month');
        const post_year = post_date.getAttribute('data-year');

        // Add year separator if it's a new year
        if (post_year !== current_year && post_year !== current_year_today) {
          const yearElement = document.createElement('div');
          yearElement.className = 'year-separator';
          yearElement.innerHTML = `<span>${post_year}</span>`;
          postList.appendChild(yearElement);
          current_year = post_year; // Update current year
        }

        // Add month separator if it's a new month
        if (post_month !== current_month) {
          const monthElement = document.createElement('div');
          monthElement.className = 'month-separator';
          monthElement.innerHTML = `<span>${post_month}</span>`;
          postList.appendChild(monthElement);
          current_month = post_month; // Update current month
        }

        // Append the post to the list
        postList.appendChild(post); 
        post_date.style.display = "inline"; // Show the date for visible posts
      }
    });

    // Handle conditional text based on active categories
    textRecent.style.display = activeCategories.size === buttons.length ? "block" : "none";
    textProjects.style.display = activeCategories.size === 1 && activeCategories.has("Projects") ? "block" : "none";
    textThoughts.style.display = activeCategories.size === 1 && activeCategories.has("Thoughts") ? "block" : "none";
    textVU.style.display = activeCategories.size === 1 && activeCategories.has("VU") ? "block" : "none";
  }

  buttons.forEach(button => {
    button.addEventListener("click", function () {
      const category = this.dataset.category;

      if (activeCategories.has(category)) {
        activeCategories.delete(category);
        this.classList.remove("active");
      } else {
        activeCategories.add(category);
        this.classList.add("active");
      }

      // Update URL with selected filters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('active', activeCategories.size === buttons.length ? "" : Array.from(activeCategories).join(","));
      history.pushState({}, "", newUrl);

      // Re-render posts based on selected categories
      updatePosts();
    });
  });

  // Initial call to update posts based on categories
  updatePosts();
});

</script>


<style>
/* General Styles */
#feed .container {
  padding: 20px;
}

#feed .month-separator {
  text-align: right;
  font-size: 1.1rem;
  font-style: italic;
  margin-top: 20px;
  margin-bottom: 10px;
  color: #333;
}

#feed .year-separator {
  text-align: right;
  font-weight: bold;
  font-size: 1.2rem;
  margin-top: 20px;
  margin-bottom: 10px;
  color: #333;
}

#feed .post-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.post-subtitle {
  font-size: 0.9rem; /* Adjust as needed */
  font-style: italic;
  color: #666; /* Optional: makes it a bit softer */
}

#feed .post-details {
  flex: 1;
}

#feed .post-date {
  font-size: 1rem;
  font-style: italic;
  /* color: #007bff; */
  min-width: 50px;
  text-align: right;
}

/* Responsive Design */
@media (min-width: 768px) {
  #feed .container {
    width: 90%;
    max-width: 960px;
  }
}

@media (min-width: 1024px) {
  #feed .container {
    width: 80%;
    max-width: 1200px;
  }
}

/* Category Filter Styling */
#category-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
}

.category-button {
  background-color: white;
  color: #007bff;
  border: 1px solid #007bff;
  padding: 5px 10px;
  margin: 5px;
  cursor: pointer;
  border-radius: 5px;
  transition: 0.2s ease-in-out;
}

.category-button:hover, .category-button.active {
  background-color: #007bff;
  color: white;
}

/* Conditional Text */
.conditional-text {
  text-align: center;
  font-size: 1.3rem;
  margin-bottom: 15px;
}
</style>

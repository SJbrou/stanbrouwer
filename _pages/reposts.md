---
layout: page
title:
permalink: /reposts.html
---

<!-- Conditional Text -->
<p id="category-text">
  <span id="text-content">A curration of my media consumption.  </span><span id="caret">|</span>
</p>

<!-- Category Buttons -->
<div id="category-filter-buttons">
  <button class="category-button active" data-category="all">All</button>
</div>

<section id="reposts">
  <ul id="repostList"></ul>
</section>

<script>
document.addEventListener("DOMContentLoaded", async function () {
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1DCteaZ34vFsgd1D7TgJEmxqnltTqZS3GoOr99Lxb3Po/gviz/tq?tqx=out:json&sheet=Sheet1";
  const repostList = document.getElementById("repostList");
  const categoryButtonsContainer = document.getElementById("category-filter-buttons");
  const textContent = document.getElementById("text-content");
  let activeCategory = "all";
  let currentAnimationVersion = 0;

  try {
    const response = await fetch(SHEET_URL);
    const text = await response.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;

    const data = rows.map(row => ({
      title: row.c[0]?.v || "",
      link: row.c[1]?.v || "",
      subtitle: row.c[2]?.v || "",
      date: row.c[3]?.v || "",
      category: row.c[4]?.v || "" 
    }));

    // Extract unique categories
    const uniqueCategories = [...new Set(data.map(item => item.category).filter(cat => cat))];
    
    // Generate category filter buttons
    uniqueCategories.forEach(category => {
      const button = document.createElement("button");
      button.classList.add("category-button");
      button.setAttribute("data-category", category);
      button.innerText = category;
      categoryButtonsContainer.appendChild(button);
    });

    // Event listener for category filtering
    document.querySelectorAll(".category-button").forEach(button => {
      button.addEventListener("click", function () {
        document.querySelectorAll(".category-button").forEach(btn => btn.classList.remove("active"));
        this.classList.add("active");
        activeCategory = this.getAttribute("data-category");
        updatePosts();
      });
    });

    function updatePosts() {
      currentAnimationVersion++;
      const version = currentAnimationVersion;
      removeItemsSequentially(version, function () {
        renderNewItems(version);
      });
    }

    function removeItemsSequentially(version, callback) {
      let items = Array.from(repostList.children);
      if (items.length === 0) {
        callback();
        return;
      }
      items.reverse();
      let index = 0;
      function removeNext() {
        if (version !== currentAnimationVersion) return;
        if (index < items.length) {
          const item = items[index];
          item.classList.remove("fade-in");
          item.classList.add("fade-out");
          setTimeout(() => {
            if (version !== currentAnimationVersion) return;
            item.remove();
            index++;
            removeNext();
          }, 50);
        } else {
          callback();
        }
      }
      removeNext();
    }

    function renderNewItems(version) {
      let items = [];
      let currentYear = "";
      let currentMonth = "";

      let filteredData = activeCategory === "all" 
        ? data 
        : data.filter(item => item.category === activeCategory);

      filteredData.sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split("-").map(Number);
        const [dayB, monthB, yearB] = b.date.split("-").map(Number);
        return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
      });

      filteredData.forEach(item => {
        if (!item.date) return;
        const [day, month, year] = item.date.split("-");
        const postMonth = new Date(year, month - 1).toLocaleString("default", { month: "long" });

        if (year !== currentYear || postMonth !== currentMonth) {
          const separator = document.createElement("li");
          separator.classList.add("year-month-separator");
          separator.innerHTML = `<span class="year">${year}</span><span class="month">${postMonth}</span>`;
          items.push(separator);
          currentYear = year;
          currentMonth = postMonth;
        }

        let domain = "";
        try {
          const url = new URL(item.link);
          domain = url.hostname.replace("www.", "");
        } catch (e) {
          console.warn(`Invalid URL: ${item.link}`);
        }

        const listItem = document.createElement("li");
        listItem.classList.add("post-item");
        listItem.innerHTML = `
          <div class="post-details">
            <span class="post-title">
              <a href="${item.link}" target="_blank">${item.title}</a>
              ${domain ? `<span class="post-site">(${domain})</span>` : ""}
            </span>
            <span class="post-date">${day}</span>
          </div>
          ${item.subtitle ? `<p class="post-description">${item.subtitle}</p>` : ""}
        `;
        items.push(listItem);
      });

      function appendItemsSequentially(index) {
        if (version !== currentAnimationVersion) return;
        if (index < items.length) {
          repostList.appendChild(items[index]);
          items[index].classList.add("fade-in");
          setTimeout(() => {
            if (version !== currentAnimationVersion) return;
            appendItemsSequentially(index + 1);
          }, 50);
        }
      }
      appendItemsSequentially(0);
    }

    updatePosts();

  } catch (error) {
    console.error("Error fetching reposts:", error);
  }
});
</script>

<style>
/* Fade-in animation */
.fade-in {
  opacity: 0;
  animation: fadeInAnimation 0.5s forwards;
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

/* Fade-out animation */
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

/* Category Filter Buttons */
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

/* List Styling */
#repostList {
  list-style: none;
  padding: 0;
  min-height: 500px;
}
.year-month-separator {
  font-size: 1.2rem;
  font-weight: bold;
  padding: 10px 0;
}
.post-item {
  list-style: none;
  padding: 10px 0;
}
.post-title a {
  text-decoration: none;
  color: inherit;
}
.post-site {
  font-size: 0.9rem;
  color: gray;
  margin-left: 5px;
}
.post-date {
  font-size: 14px;
  color: #555;
}
.post-description {
  font-size: 0.9rem;
  color: #777;
  margin-top: 4px;
}
</style>

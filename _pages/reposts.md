---
layout: page
title: Reposts
permalink: /reposts.html
description: Curation of my consumed content
background: '/img/bg-repost.jpg'
---

<section id="reposts">
  <div class="container-lg">

    <ul class="list-unstyled" id="repostList"></ul>
  </div>
</section>

<script>
document.addEventListener("DOMContentLoaded", async function () {
    const SHEET_URL = "https://docs.google.com/spreadsheets/d/1DCteaZ34vFsgd1D7TgJEmxqnltTqZS3GoOr99Lxb3Po/gviz/tq?tqx=out:json&sheet=Sheet1";

    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text(); 

        // Google Sheets wraps JSON in additional text, so we need to parse it properly
        const json = JSON.parse(text.substring(47, text.length - 2));

        // Extract rows
        const rows = json.table.rows;

        // Process the data
        const data = rows.map(row => ({
            title: row.c[0]?.v || "", 
            link: row.c[1]?.v || "", 
            subtitle: row.c[2]?.v || "", 
            date: row.c[3]?.v || ""
        }));

        // Sort by date (most recent first)
        data.sort((a, b) => {
            const [dayA, monthA, yearA] = a.date.split("-").map(Number);
            const [dayB, monthB, yearB] = b.date.split("-").map(Number);
            return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
        });

        const repostList = document.getElementById("repostList");
        let currentYear = "";
        let currentMonth = "";

        data.forEach((item) => {
            if (!item.date) return; // Skip entries with no date
            
            // Correctly parse the date as day, month, year
            const [day, month, year] = item.date.split("-");
            const postMonth = new Date(year, month - 1).toLocaleString("default", { month: "long" });

            // Add year separator
            if (year !== currentYear) {
                const yearSeparator = document.createElement("div");
                yearSeparator.classList.add("year-separator");
                yearSeparator.innerHTML = `<span>${year}</span>`;
                repostList.appendChild(yearSeparator);
                currentYear = year;
            }

            // Add month separator
            if (postMonth !== currentMonth) {
                const monthSeparator = document.createElement("div");
                monthSeparator.classList.add("month-separator");
                monthSeparator.innerHTML = `<span>${postMonth}</span>`;
                repostList.appendChild(monthSeparator);
                currentMonth = postMonth;
            }

            // Extract domain from link
            let domain = "";
            try {
                const url = new URL(item.link);
                domain = url.hostname.replace("www.", "");
            } catch (e) {
                console.warn(`Invalid URL: ${item.link}`);
            }

            // Create post entry
            const listItem = document.createElement("li");
            listItem.classList.add("repost-item");
            listItem.innerHTML = `
                <div class="repost-entry d-flex justify-content-between">
                    <div class="repost-details">
                        <span class="repost-title">
                            <a href="${item.link}" target="_blank">${item.title}</a> 
                            <span class="repost-site">(${domain})</span>
                        </span>
                        <div class="repost-subtitle">${item.subtitle}</div>
                    </div>
                    <span class="repost-date">${day}</span>
                </div>
            `;
            repostList.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error fetching reposts:", error);
    }
});
</script>

<style>
/* General styles */
#reposts .container {
  padding: 20px;
}

#reposts .month-separator {
  text-align: right;
  font-size: 1.1rem;
  margin-top: 20px;
  margin-bottom: 10px;
  color: #333;
}

#reposts .year-separator {
  text-align: right;
  font-weight: bold;
  font-size: 1.2rem;
  margin-top: 20px;
  margin-bottom: 10px;
  color: #333;
}

#reposts .repost-entry {
  margin-bottom: 20px;
}

#reposts .repost-title {
  font-weight: bold;
}

#reposts .repost-site {
  font-size: 0.9rem;
  color: gray;
}

#reposts .repost-subtitle {
  font-size: 0.9rem;
  font-style: italic;
  margin-top: 5px;
}

#reposts .repost-date {
  font-weight: bold;
}
</style>

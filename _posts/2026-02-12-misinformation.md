---
layout: post
title: "Online Forum Bot Detection"
description: "Machine learning to detect misinformation campaings"
date: 2026-02-12 00:00:00
tags: ["Projects"]
---

## Online Forum Bot Detection
Concerned about misinformation on online forums, I'm wondering if I could use machine learning to detect bots and targeted misinformation campaings myself.

## Forum overview
On <code>$online_form</code> (name redacted), people can upload media, and after creating an account, users can comment on posts and leave a positive or negative "like" on both posts and comments. Users can also reply to comments, creating a tree structure of comments.
The form will not be disclosed for privacy reasons. If we can Identify any misinformation campaings, they will be reported to the form moderators and any relevant authorities. The aim is not to cause harm or negative PR to the forum or its users, but to promote a healthier online environment.

### Data collection
We collected 19M comments for ±300K posts, rangeing from 2006 to end 2025. There were ±34K unique authors. 
The data was collected using the forum's public API. 

<details>
<summary>Code for webscraper</summary>

{% highlight python %}
import requests
import time
import json
import os
import random
from datetime import date, timedelta

# =========================
# Configuration
# =========================
POSTS_BASE_URL = "https://post.XXXXX.nl/api/v1.0/latest/date/{date}/"
COMMENTS_BASE_URL = "https://comment.XXXXX.nl/api/v1.0/articles/{composite_id}/comments"
APP_PARAM = "www.XXXXX.nl"

START_DATE = date(2019, 10, 1)
END_DATE   = date(2019, 12, 31)

POSTS_DIR = "posts_by_date"
COMMENTS_DIR = "comments"

RANDOMIZE_DATES = False
REFETCH_POSTS_BY_DATE = True   # True = API, False = use stored JSON only

# =========================
# Headers
# =========================
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
    ),
    "Accept": "application/json",
    "Origin": "https://www.XXXXX.nl",
    "Referer": "https://www.XXXXX.nl/",
    "x-XXXXX-nsfw": "1",
}

# =========================
# Retry handling (429 only)
# =========================
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 15
BACKOFF_MAX_SECONDS = 300

# =========================
# Setup directories
# =========================
os.makedirs(POSTS_DIR, exist_ok=True)
os.makedirs(COMMENTS_DIR, exist_ok=True)

# =========================
# Helpers
# =========================
def get_with_429_handling(url, params, allow_5xx=False):
    """
    GET request with 429 retry handling.
    If allow_5xx=True, 5xx responses will return None instead of raising.
    """
    attempt = 0
    while attempt < MAX_RETRIES:
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=30)

            if r.status_code == 429:
                retry_after = r.headers.get("Retry-After")
                sleep_time = (
                    int(retry_after)
                    if retry_after and retry_after.isdigit()
                    else min(BACKOFF_BASE_SECONDS * (2 ** attempt), BACKOFF_MAX_SECONDS)
                )
                print(f"429 → sleeping {sleep_time}s")
                time.sleep(sleep_time)
                attempt += 1
                continue

            if r.status_code >= 500:
                if allow_5xx:
                    # return None so caller can skip
                    return None
                r.raise_for_status()

            r.raise_for_status()
            return r

        except requests.exceptions.RequestException as e:
            if allow_5xx and isinstance(e, requests.exceptions.HTTPError) and e.response and e.response.status_code >= 500:
                return None
            raise

    if allow_5xx:
        return None
    raise RuntimeError(f"Max retries exceeded: {url}")


def fetch_posts(api_date: str) -> dict:
    url = POSTS_BASE_URL.format(date=api_date)
    params = {"app": APP_PARAM}
    return get_with_429_handling(url, params).json()


def fetch_comments(composite_id_raw: str) -> dict | None:
    """
    Fetch comments for a post.
    Returns None if API returns 500/502/503 or network error.
    """
    composite_id_api = composite_id_raw.replace("_", "/")
    url = COMMENTS_BASE_URL.format(composite_id=composite_id_api)
    params = {"app": APP_PARAM}

    r = get_with_429_handling(url, params, allow_5xx=True)
    if r is None:
        print(f"      comment API returned 5xx or network error, skipping {composite_id_raw}")
        return None
    return r.json()


def generate_dates(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def comments_complete_for_date(date_str: str, items: list) -> bool:
    for post in items:
        cid = post.get("composite_id")
        if not cid:
            continue

        year = date_str[:4]
        path = os.path.join(
            COMMENTS_DIR,
            year,
            f"{date_str.replace('-', '_')}_{cid}.json"
        )
        if not os.path.exists(path):
            return False
    return True


# =========================
# Main workflow
# =========================
dates = list(generate_dates(START_DATE, END_DATE))
if RANDOMIZE_DATES:
    random.shuffle(dates)

for current_date in dates:
    date_str = current_date.isoformat()
    year = current_date.year
    posts_file = os.path.join(POSTS_DIR, f"api_date_{date_str}.json")

    print(f"\n[DATE] {date_str}")

    # ---- Load or fetch posts ----
    if REFETCH_POSTS_BY_DATE:
        print("  fetching posts from API")
        posts_json = fetch_posts(date_str)
        with open(posts_file, "w", encoding="utf-8") as f:
            json.dump(posts_json, f, ensure_ascii=False, indent=2)
    else:
        if not os.path.exists(posts_file):
            print("  posts file missing, skipping date")
            continue
        print("  loading posts from disk")
        with open(posts_file, "r", encoding="utf-8") as f:
            posts_json = json.load(f)

    items = posts_json.get("items")
    if not items:
        print("  no posts")
        continue

    # ---- Skip date if all comments already collected ----
    if comments_complete_for_date(date_str, items):
        print("  all comments already collected")
        continue

    year_dir = os.path.join(COMMENTS_DIR, str(year))
    os.makedirs(year_dir, exist_ok=True)

    new_comments = 0

    # ---- Fetch missing comments ----
    for post in items:
        cid = post.get("composite_id")
        if not cid:
            continue

        comments_file = os.path.join(
            year_dir,
            f"{date_str.replace('-', '_')}_{cid}.json"
        )

        if os.path.exists(comments_file):
            continue

        print(f"    fetching comments {cid}")

        comments_json = fetch_comments(cid)
        if comments_json is None:
            continue

        with open(comments_file, "w", encoding="utf-8") as f:
            json.dump(comments_json, f, ensure_ascii=False, indent=2)

        new_comments += 1

    print(f"  collected {new_comments} new comment files")

print("\nPosts + comments synchronization complete.")
{% endhighlight %}
</details>

All data was stored in a local duckdb database for efficient analysis.

## Feature engineering
Determining the features to discriminate bots from human traffic is hard. My assumptions are:
- Bots will post more repetitively (e.g. copy-pasting the same comment multiple times) and thus have less lexical diversity (use less different words) and repeat the same words more often
- Bots will post more links (e.g. to external misinformation sources) and thus have a higher link ratio.
- Bots will post more negative comments (e.g. to create conflict and engagement) and thus have a lower sentiment polarity.
- Bots will post more often and in bursts (e.g. posting 100 comments in 1 hour, then nothing for a week).
- Bots will post more often at specific hours (e.g. when the misinformation campaign is most effective) and thus have a lower hour entropy.

Those assumptions led to the following features being calculated for each user:

- Lexical Diversity
*Ratio of unique words to total words across all comments written by a user.*

- Repeated Comment Ratio
*Proportion of duplicated comment texts posted by a user, used as an indicator of repeated posting.*

- Link Ratio
*Fraction of comments containing URLs (identified via the substring "http").*

- Sentiment Polarity
*Average sentiment polarity across a user's comments, computed using the TextBlob library.*

- Comments per Day
*Average number of comments posted per day since the user's first recorded comment.*

- Burstiness (hours)
*Standard deviation of time intervals between consecutive comments (in hours), capturing burst-like posting behavior.*

- Hour Entropy
*Entropy of the distribution of posting times across 24 hourly bins, measuring how evenly a user spreads activity throughout the day.*

## Implementation details
All features are calculated per author_id.
computations including sentiment analysis, temporal statistics, and grouping operations are parallelized using <code>ProcessPoolExecutor</code> to improve processing speed. Data is processed in chunks to efficiently handle large volumes of comments.

## Preprocessing
Before modeling:
- Missing values are replaced with zeros.
- All features are standardized using StandardScaler to ensure comparable scales across variables.

## Clustering (User segmentation)
User segmentation is performed using KMeans clustering on the standardized feature set.

## Model Selection
To determine the optimal number of clusters, the Silhouette Score is computed for values of 𝑘 ranging from 2 to <code>MAX_CLUSTERS</code>.
The value of 𝑘 that maximizes the silhouette score is selected.

## Output
Each user receives a segment label (0..k-1).
Cluster-level statistics (mean feature values and user counts) are exported to:

<img 
  src="https://raw.githubusercontent.com/SJbrou/botdetection/refs/heads/main/segment_report.png"
  style="max-width:100%; height:auto;"
/>

### Results

Unfortunately, the current results are inconclusive. This might be caused by moderation efforts of the forum itself. One identified cluster contained only comments with *"redacted"* in the text, and where thus likely removed by the admins. We will need to apply some better feature engineering.....



Full script and project can be found at [github](https://github.com/SJbrou/botdetection/tree/main)
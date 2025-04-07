---
layout: post
title: "Personal site project"
description: "Technical details"
date: 2024-12-01 21:20:40
tags: ["Projects"]
---

<h2 class="section-heading">Personal site</h2>

I've always wanted to have a personal website for multiple reasons, and I finally found the time to build one. Over the years, I've created several simple websites deployed on GitHub Pages and even made an initial attempt at personal blogging using Jekyll. Now, I've taken the next step by registering my own domain. Luckily, stanbrouwer.com was still available!

<h3 class="section-heading">Technical details</h3>

The site is powered by <a href="https://jekyllrb.com/">Jekyll</a>, which converts simple word-like files into static HTML webpages. For the front-end design, I've relied heavily on the <a href="https://getbootstrap.com/">Bootstrap</a>. The original template was sourced from <a href="https://github.com/startbootstrap/startbootstrap-clean-blog">Start Bootstrap</a>, but like the ship of Theseus much has already been replaced.

For the <a href="https://stanbrouwer.com/reposts.html">Reposts</a> page, I wanted a way to easily update and add links on the go. To achieve this, I use JavaScript to fetch data from a Google Sheet via the <a href="https://developers.google.com/sheets/api/reference/rest">Google Sheets API</a>. This allows me to add new links by simply entering a title and URL into a spreadsheet, with the site dynamically displaying them.

Supporting syntax highlighting and copyable code blocks turned out to be a nuissance. Since I plan to share a lot of code examples, I really wanted to make this feature work. I ran into some issues setting it up with Jekyll and Rouge. However, a simple solution involved using Rouge’s generated GitHub themed CSS and adding custom JavaScript to place a “Copy” button at the top of each code block. Now it should look great

```python
# A quick example of a python code block
def hi():
    print("Hello, world!")
```

The site itself is hosted using <a href="https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/creating-a-github-pages-site-with-jekyll">GitHub Pages</a>, with my DNS settings configured to point to the GitHub page. 

While this works for now, there is more functionallity I'd like to implement. Comments, CRUD webapps, and security logins are on my to-do. When time permits, I may set up an AWS EC2 instance to play around with more dynamic geatures. I enjoy working with Node.js and Django, and I have some IoT projects in mind that could benifit from an always-online environment. We'll see where this project takes me!


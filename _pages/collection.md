---
layout: collection
title: Collection
permalink: /
---

<main class="collection-page">
  <article class="collection-poster" aria-labelledby="collection-page-title">
    <header class="collection-intro">
      <h1 id="collection-page-title" class="collection-visually-hidden">Stan Brouwer, volume 001: a carefully curated collection of experiences</h1>
      <img class="collection-intro__image" src="{{ '/assets/img/header-image.jpg' | relative_url }}" alt="Black-and-white perspective grid artwork">
      <div class="collection-captions collection-captions--intro">
        <p>a carefully curated<br>collection of experiences</p>
        <p>Stan Brouwer<br>vol. 001</p>
      </div>
    </header>

    <section class="collection-section" aria-labelledby="observations-title">
      <header class="collection-section__heading">
        <h2 id="observations-title">OBSERVATIONS</h2>
      </header>
      <div class="collection-section__body">
        <section class="collection-subsection collection-subsection--words" aria-labelledby="words-title">
          <div class="collection-subsection__rule"></div>
          <h3 id="words-title">WORDS</h3>
          <div id="collection-words" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
        </section>

        <section class="collection-subsection collection-subsection--sounds" aria-labelledby="sounds-title">
          <div class="collection-subsection__rule"></div>
          <h3 id="sounds-title">SOUNDS</h3>
          <div id="collection-sounds" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
          <div class="collection-sound-hover-preview" data-collection-sound-hover-preview hidden aria-hidden="true"></div>
        </section>

        <section class="collection-subsection collection-subsection--visuals" aria-labelledby="visuals-title">
          <div class="collection-subsection__rule"></div>
          <h3 id="visuals-title">VISUALS</h3>
          <div id="collection-visuals" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
        </section>

        <section class="collection-subsection collection-subsection--people" aria-labelledby="people-title">
          <div class="collection-subsection__rule"></div>
          <h3 id="people-title">PEOPLE</h3>
          <div id="collection-people" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
        </section>
      </div>
    </section>

    <section class="collection-section collection-section--activities" aria-labelledby="activities-title">
      <header class="collection-section__heading">
        <h2 id="activities-title">ACTIVITIES</h2>
      </header>
      <div class="collection-section__body">
        <section class="collection-subsection collection-subsection--places" aria-labelledby="places-title">
          <div class="collection-subsection__rule"></div>
          <h3 id="places-title">PLACES</h3>
          <div id="collection-places" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
        </section>

        <section class="collection-subsection collection-subsection--projects" aria-labelledby="projects-title">
          <div class="collection-subsection__rule"></div>
          <h3 id="projects-title">PROJECTS</h3>
          <div id="collection-projects" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
        </section>
      </div>
    </section>
  </article>

  <aside id="collection-mobile-media" class="collection-mobile-media" hidden aria-live="polite" aria-label="Active item preview">
    <div class="collection-mobile-media__content"></div>
    <div class="collection-mobile-media__drag-handle" aria-hidden="true">DRAG</div>
    <button class="collection-mobile-media__close" type="button" aria-label="Minimize media preview">×</button>
  </aside>
  <button id="collection-mobile-media-toggle" class="collection-mobile-media-toggle" type="button" hidden aria-expanded="false">MEDIA +</button>
  <button id="collection-mobile-sound-candidate" class="collection-mobile-sound-candidate" type="button" hidden></button>

  <footer class="collection-outro">
    <img class="collection-outro__image" src="{{ '/assets/img/black-white-perspective-grid-background-vector.jpg' | relative_url }}" alt="Black-and-white perspective grid artwork">
    <div class="collection-captions collection-captions--outro">
      <p>a carefully curated<br>collection of experiences</p>
      <p>Stan Brouwer<br>vol. 001</p>
    </div>
  </footer>
</main>

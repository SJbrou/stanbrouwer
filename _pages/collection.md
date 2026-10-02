---
layout: collection
title: Collection
permalink: /
welcome: true
---

<main class="collection-page" data-collection-welcome>
  <header class="collection-intro">
    <div class="collection-intro__artwork">
      <img class="collection-intro__image" src="{{ '/assets/img/header-image.jpg' | relative_url }}" alt="Black-and-white perspective grid artwork" width="954" height="953" decoding="async" fetchpriority="high">
      <div class="collection-perspective-copy">
        <h1 id="collection-page-title" class="collection-perspective-title">PERSPECTIVE</h1>
      </div>
    </div>
    <div class="collection-captions collection-captions--intro">
      <p>a carefully curated<br>collection</p>
      <p>Stan Brouwer<br>vol. 001</p>
    </div>
  </header>

  <article class="collection-poster" aria-labelledby="collection-page-title">
    <section class="collection-section collection-section--invites" aria-labelledby="invites-title">
      <h2 id="invites-title">INVITES</h2>
      <div class="collection-section__body">
        <div id="collection-invites" class="collection-invites" role="list" aria-live="polite" aria-busy="true">
          <p class="collection-load-error">LOADING</p>
        </div>
      </div>
    </section>

    <section class="collection-section" aria-label="Observations">
      <div class="collection-section__body">
        <section class="collection-subsection collection-subsection--words" aria-labelledby="words-title">
          <div class="collection-subsection__rule"></div>
          <h2 id="words-title">WORDS</h2>
          <div id="collection-words" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
        </section>

        <section class="collection-subsection collection-subsection--sounds" aria-labelledby="sounds-title">
          <div class="collection-subsection__rule"></div>
          <h2 id="sounds-title">SOUNDS</h2>
          <div id="collection-sounds" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
          <div class="collection-sound-hover-preview" data-collection-sound-hover-preview hidden aria-hidden="true"></div>
        </section>

      </div>
    </section>

    <section class="collection-section collection-section--activities" aria-label="Activities">
      <div class="collection-section__body">
        <section class="collection-subsection collection-subsection--places" aria-labelledby="places-title">
          <div class="collection-subsection__rule"></div>
          <h2 id="places-title">PLACES</h2>
          <div id="collection-places" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
          <div class="collection-media-slot" data-collection-media-slot hidden aria-live="polite"></div>
        </section>

        <section class="collection-subsection collection-subsection--projects" aria-labelledby="projects-title">
          <div class="collection-subsection__rule"></div>
          <h2 id="projects-title">PROJECTS</h2>
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
      <p>a carefully curated<br>collection</p>
      <p>Stan Brouwer<br>vol. 001</p>
    </div>
  </footer>
</main>

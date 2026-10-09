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
        </section>

        <section class="collection-subsection collection-subsection--sounds" aria-labelledby="sounds-title">
          <div class="collection-subsection__rule"></div>
          <h2 id="sounds-title">SOUNDS</h2>
          <div id="collection-sounds" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
        </section>

      </div>
    </section>

    <section class="collection-section collection-section--activities" aria-label="Activities">
      <div class="collection-section__body">
        <section class="collection-subsection collection-subsection--places" aria-labelledby="places-title">
          <div class="collection-subsection__rule"></div>
          <h2 id="places-title">PLACES</h2>
          <div id="collection-places" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
        </section>

        <section class="collection-subsection collection-subsection--projects" aria-labelledby="projects-title">
          <div class="collection-subsection__rule"></div>
          <h2 id="projects-title">PROJECTS</h2>
          <div id="collection-projects" class="collection-rows" role="list" aria-live="polite" aria-busy="true"></div>
        </section>
      </div>
    </section>
  </article>

  <aside id="collection-media-window" class="collection-media-window" hidden aria-live="polite" aria-label="Audio player and media preview">
    <div class="collection-media-window__chrome">
      <span class="collection-media-window__title" data-collection-media-title>MEDIA</span>
      <button class="collection-media-window__minimize" type="button" aria-label="Minimize audio player" hidden>−</button>
      <button class="collection-media-window__close" type="button" aria-label="Close media window">×</button>
    </div>
    <div class="collection-media-window__content"></div>
    <button class="collection-window__resize" type="button" aria-label="Resize media window" title="Resize window"></button>
  </aside>
  <aside id="collection-image-window" class="collection-image-window" hidden aria-live="polite" aria-label="Image preview">
    <div class="collection-image-window__chrome">
      <span class="collection-image-window__title" data-collection-image-title>PREVIEW</span>
      <button class="collection-image-window__close" type="button" aria-label="Close image preview">×</button>
    </div>
    <div class="collection-image-window__content"></div>
    <button class="collection-window__resize" type="button" aria-label="Resize image preview" title="Resize window"></button>
  </aside>
  <button id="collection-media-window-toggle" class="collection-media-window-toggle" type="button" hidden aria-expanded="false">MEDIA +</button>
  <button id="collection-mobile-sound-candidate" class="collection-mobile-sound-candidate" type="button" hidden></button>

  <footer class="collection-outro">
    <img class="collection-outro__image" src="{{ '/assets/img/black-white-perspective-grid-background-vector.jpg' | relative_url }}" width="1920" height="521" alt="Black-and-white perspective grid artwork">
  </footer>
</main>

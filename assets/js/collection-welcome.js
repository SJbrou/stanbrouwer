(() => {
  "use strict";

  const controllers = new WeakMap();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (from, to, progress) => from + (to - from) * progress;
  const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  // Ease only the joins: the middle 80% of each scroll stage stays linear.
  // These quadratic caps meet the linear section with the same velocity.
  const scrollPhase = value => {
    const p = clamp(value);
    if (p < .1) return p * p / .18;
    if (p > .9) return 1 - (1 - p) * (1 - p) / .18;
    return (p - .05) / .9;
  };
  const scrollStages = { gridEnd: .1, panelEnd: .5 };
  const handoverSizing = .8;
  // The initial handover and later scroll cycles share the same reading
  // boundary, so visible collection content always has a reversible entrance.
  const readingStart = scrollStages.panelEnd + (1 - scrollStages.panelEnd) * handoverSizing;
  // Border of the rear opening in the original 954 × 953 artwork. Every
  // animated edge follows these same corner rays, including the white panel.
  const aperture = { x: 98 / 954, y: 654 / 953, width: 188 / 954, height: 188 / 953 };
  const plane = progress => ({
    x: aperture.x * (1 - progress), y: aperture.y * (1 - progress),
    width: mix(aperture.width, 1, progress), height: mix(aperture.height, 1, progress)
  });
  const inset = rect => [rect.y, 1 - rect.x - rect.width, 1 - rect.y - rect.height, rect.x]
    .map(value => Math.max(0, value * 100) + "%").join(" ");
  const translateScroll = (scroll, previous, current) => {
    if (!previous || !Number.isFinite(scroll)) return Math.max(0, scroll || 0);
    const start = previous.handoverStart ?? previous.leadIn ?? 0;
    const end = previous.handoverEnd ?? start;
    // Version 1 used a full viewport of actual scroll for the automatic intro.
    if (scroll <= start) return start > 0 ? scroll / start * current.handoverStart : 0;
    if (end > start && scroll < end) {
      return mix(current.handoverStart, current.handoverEnd, (scroll - start) / (end - start));
    }
    return Math.max(0, current.handoverEnd + scroll - end);
  };

  function create(page, options) {
    const intro = page.querySelector(".collection-intro");
    const artwork = intro?.querySelector(".collection-intro__artwork");
    const image = artwork?.querySelector(".collection-intro__image");
    const copy = artwork?.querySelector(".collection-perspective-copy");
    const captions = intro?.querySelector(".collection-captions--intro");
    const poster = page.querySelector(".collection-poster");
    if (!intro || !artwork || !image || !copy || !poster) return null;

    const pin = document.createElement("div");
    pin.className = "collection-welcome-pin";
    artwork.before(pin);
    pin.appendChild(artwork);
    const range = document.createElement("div");
    range.className = "collection-welcome-range";
    range.setAttribute("aria-hidden", "true");
    pin.appendChild(range);
    if (captions) copy.appendChild(captions);
    page.classList.add("has-welcome-typography");

    const namespace = "http://www.w3.org/2000/svg";
    const frame = document.createElementNS(namespace, "svg");
    frame.classList.add("collection-welcome-frame");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("focusable", "false");
    frame.setAttribute("preserveAspectRatio", "none");
    const outline = document.createElementNS(namespace, "rect");
    frame.appendChild(outline);
    page.appendChild(frame);

    let geometry;
    let needsMeasure = true;
    let suspended = page.hidden;
    let failed = false;
    let enabled = false;
    let settled = false;
    let readyAt = 0;
    let opening = options.autoplay ? 0 : 1;
    let reveal = options.autoplay ? 0 : 1;
    let reversible = !!options.reversible;
    let autoplayAllowed = !!options.autoplay;
    let autoplayRequest;
    let renderRequest;
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });

    const setActive = active => {
      page.classList.toggle("is-welcome-active", active);
      window.Collection?.setWelcomeActive(active);
    };
    const measure = () => {
      const pageBox = page.getBoundingClientRect();
      const pinBox = pin.getBoundingClientRect();
      const imageBox = image.getBoundingClientRect();
      const posterBox = poster.getBoundingClientRect();
      const distance = enabled ? range.getBoundingClientRect().height : 0;
      const sourceY = pinBox.top - pageBox.top;
      // The target is one stable viewport, never the asynchronously loaded feed.
      const viewport = parseFloat(getComputedStyle(poster).minHeight) || innerHeight;
      geometry = {
        source: { x: imageBox.left - pageBox.left, y: sourceY,
          width: imageBox.width, height: imageBox.height },
        target: { x: posterBox.left - pageBox.left, y: posterBox.top - pageBox.top,
          width: posterBox.width, height: viewport },
        stroke: parseFloat(getComputedStyle(poster).borderLeftWidth) || 1,
        pageTop: pageBox.top + scrollY,
        handoverStart: enabled ? 0 : posterBox.top - pinBox.top,
        handoverEnd: enabled ? distance : posterBox.top - pinBox.top
      };
      const frameHeight = sourceY + distance + Math.max(imageBox.height, viewport);
      frame.setAttribute("viewBox", [0, 0, pageBox.width, frameHeight].join(" "));
      frame.style.width = pageBox.width + "px";
      frame.style.height = frameHeight + "px";
      needsMeasure = false;
    };
    const drawOutline = (x, y, width, height) => {
      const stroke = geometry.stroke;
      Object.entries({ x: x + stroke / 2, y: y + stroke / 2,
        width: Math.max(0, width - stroke), height: Math.max(0, height - stroke),
        "stroke-width": stroke
      }).forEach(([name, value]) => outline.setAttribute(name, value));
    };
    const render = () => {
      cancelAnimationFrame(renderRequest);
      renderRequest = undefined;
      if (suspended || page.hidden) return;
      if (needsMeasure) measure();
      if (!enabled) {
        intro.dataset.welcomeState = "static";
        return;
      }
      const { source, target, pageTop, handoverEnd } = geometry;
      const scroll = Math.max(0, scrollY - pageTop);
      const complete = scroll >= handoverEnd - .5;
      // Enable reversal at the first reveal, rather than requiring the reader
      // to scroll beyond the whole entrance. Both modes agree at this boundary.
      if (scroll >= handoverEnd * readingStart) reversible = true;
      const cycle = clamp(scroll / handoverEnd);
      const openingDistance = reversible ? handoverEnd * scrollStages.panelEnd : 0;
      const progress = complete ? 1 : clamp((scroll - openingDistance) / (handoverEnd - openingDistance));
      const playing = autoplayAllowed ? opening < 1 : reversible && scroll < openingDistance;
      const building = playing && (autoplayAllowed ? opening < .3 : cycle < scrollStages.gridEnd);
      page.classList.toggle("is-welcome-building", building);
      page.classList.toggle("is-welcome-clearing", playing && !building);
      page.classList.toggle("is-welcome-frame", !playing);
      page.classList.toggle("is-welcome-ready", !playing && progress === 0);
      page.classList.toggle("is-welcome-complete", complete);
      page.classList.toggle("has-welcome-frame", !complete);
      setActive(!complete);
      page.style.setProperty("--collection-welcome-intro-opacity", reveal);

      if (playing) {
        poster.style.pointerEvents = "none";
        // Give the large panel contraction 40% of the complete scroll range,
        // independent of the initial autoplay's shorter grid/panel timing.
        const panelProgress = autoplayAllowed ? ease((opening - .3) / .7)
          : scrollPhase((cycle - scrollStages.gridEnd) / (scrollStages.panelEnd - scrollStages.gridEnd));
        const gridProgress = autoplayAllowed ? ease(opening / .3) : scrollPhase(cycle / scrollStages.gridEnd);
        const rect = plane(panelProgress);
        const grid = building ? plane(gridProgress) : plane(1);
        page.style.setProperty("--collection-welcome-depth-clip", inset(grid));
        page.style.setProperty("--collection-welcome-panel-clip", inset(rect));
        page.style.setProperty("--collection-welcome-type-transform",
          "translate(" + rect.x * 100 + "%, " + rect.y * 100 + "%) scale(" + rect.width + ", " + rect.height + ")");
        drawOutline(source.x + source.width * rect.x,
          source.y + Math.min(scroll, handoverEnd) + source.height * rect.y,
          source.width * rect.width, source.height * rect.height);
        poster.style.setProperty("--collection-welcome-clip", "0 0 100% 0");
        poster.style.setProperty("--collection-welcome-content-opacity", "0");
        intro.dataset.welcomeState = building ? "building" : "clearing";
        return;
      }

      if (complete) {
        poster.style.removeProperty("pointer-events");
        poster.style.removeProperty("--collection-welcome-clip");
        poster.style.removeProperty("--collection-welcome-content-opacity");
        intro.dataset.welcomeState = "complete";
        return;
      }
      // Finish the frame before revealing the collection. On the way back,
      // conceal its content before contracting, using the same scroll positions.
      const sizing = reversible ? clamp(progress / handoverSizing) : clamp(cycle / readingStart);
      const handover = scrollPhase(sizing);
      const horizontal = handover;
      const x = mix(source.x, target.x, horizontal);
      const y = source.y + Math.min(scroll, handoverEnd);
      const width = mix(source.width, target.width, horizontal);
      const height = mix(source.height, target.height, handover);
      drawOutline(x, y, width, height);
      page.style.setProperty("--collection-welcome-surface-inset", [
        0, source.x + source.width - x - width, source.height - height, x - source.x
      ].map(value => value + "px").join(" "));
      // Translate the copy with the left edge, preserving its finished type size.
      page.style.setProperty("--collection-welcome-copy-transform", "translateX(" + (x - source.x) + "px)");
      const contentOpacity = scrollPhase((cycle - readingStart) / (1 - readingStart));
      page.style.setProperty("--collection-welcome-copy-opacity", 1 - contentOpacity);
      const visibleHeight = Math.max(0, y + height - target.y);
      poster.style.setProperty("--collection-welcome-clip", [
        "0px", Math.max(0, target.x + target.width - x - width) + "px",
        "max(0px, calc(100% - " + visibleHeight + "px))", Math.max(0, x - target.x) + "px"
      ].join(" "));
      poster.style.setProperty("--collection-welcome-content-opacity", contentOpacity);
      poster.style.pointerEvents = contentOpacity > 0 ? "" : "none";
      intro.dataset.welcomeState = progress > 0 ? "handover" : "ready";
    };
    const queueRender = () => {
      if (!renderRequest && !suspended && !page.hidden) renderRequest = requestAnimationFrame(render);
    };
    const invalidate = () => { needsMeasure = true; queueRender(); };
    const snapshot = () => ({ version: 2, leadIn: 0, openingComplete: opening === 1, reversible,
      handoverStart: geometry?.handoverStart ?? 0, handoverEnd: geometry?.handoverEnd ?? 0, handoverExtra: 0 });
    const scrollFor = (scroll, previous) => {
      if (typeof previous?.reversible === "boolean") reversible = previous.reversible;
      if (!suspended && !page.hidden && needsMeasure) measure();
      return translateScroll(scroll, previous, snapshot());
    };
    const finishOpening = () => {
      const changed = autoplayAllowed || opening < 1;
      autoplayAllowed = false;
      cancelAnimationFrame(autoplayRequest);
      autoplayRequest = undefined;
      opening = reveal = 1;
      render();
      if (changed) window.dispatchEvent(new Event("collection-welcome-settled"));
    };
    const resume = () => {
      if (page.hidden) return;
      suspended = false;
      invalidate();
      render();
    };
    const suspend = () => {
      finishOpening();
      suspended = true;
      cancelAnimationFrame(renderRequest);
      renderRequest = undefined;
    };
    const setMode = () => {
      const previous = geometry && snapshot();
      const before = scrollY;
      const wasEnabled = enabled;
      enabled = !failed && !motion.matches && !!window.CSS?.supports("clip-path", "inset(0)");
      page.classList.toggle("is-welcome-static", !enabled);
      page.classList.toggle("is-welcome-enhanced", enabled);
      needsMeasure = true;
      if (!enabled) {
        autoplayAllowed = false;
        cancelAnimationFrame(autoplayRequest);
        opening = reveal = 1;
        setActive(false);
        page.classList.remove("is-welcome-building", "is-welcome-clearing", "is-welcome-frame",
          "is-welcome-ready", "is-welcome-complete", "has-welcome-frame");
        poster.style.removeProperty("pointer-events");
        poster.style.removeProperty("--collection-welcome-clip");
        poster.style.removeProperty("--collection-welcome-content-opacity");
      }
      if (!suspended && !page.hidden) {
        measure();
        if (previous && wasEnabled !== enabled) {
          window.scrollTo({ top: translateScroll(before, previous, snapshot()), behavior: "instant" });
        }
        render();
      }
    };
    const startAutoplay = () => {
      if (!autoplayAllowed || !enabled || suspended || page.hidden || document.hidden || scrollY > 1) {
        finishOpening();
        return;
      }
      const started = performance.now();
      const tick = now => {
        if (!autoplayAllowed || suspended || page.hidden || document.hidden) { finishOpening(); return; }
        reveal = ease((now - started) / 200);
        // Fade immediately even on a cold image load. The grid opens once decoded.
        if (settled) opening = clamp((now - Math.max(started + 200, readyAt)) / 1000);
        render();
        if (opening < 1) autoplayRequest = requestAnimationFrame(tick);
        else finishOpening();
      };
      autoplayRequest = requestAnimationFrame(tick);
    };
    const finishLoading = success => {
      if (settled) return;
      settled = true;
      clearTimeout(resourceTimer);
      readyAt = performance.now();
      failed = !success;
      setMode();
      resolveReady();
    };
    const resourceTimer = setTimeout(() => finishLoading(false), 1200);
    const onImageLoad = () => {
      const decoded = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
      decoded.then(() => finishLoading(!!image.naturalWidth));
    };
    image.addEventListener("load", onImageLoad, { once: true });
    image.addEventListener("error", () => finishLoading(false), { once: true });

    page.addEventListener("focusin", event => {
      if (!enabled || !page.classList.contains("is-welcome-active") || !event.target.closest(".collection-poster")
          || document.body.classList.contains("is-collection-navigating")) return;
      finishOpening();
      window.scrollTo({ top: Math.max(scrollY, geometry.pageTop + geometry.handoverEnd), behavior: "instant" });
      render();
      event.target.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    window.addEventListener("scroll", () => {
      if (opening < 1 && scrollY > 1) finishOpening();
      queueRender();
    }, { passive: true });
    ["wheel", "touchstart", "pointerdown"].forEach(type =>
      window.addEventListener(type, () => { if (!suspended && !page.hidden) finishOpening(); }, { passive: true }));
    window.addEventListener("keydown", event => {
      if (!suspended && !page.hidden && ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Tab", "Escape"].includes(event.key)) finishOpening();
    });
    window.addEventListener("resize", () => {
      const previous = snapshot();
      const before = scrollY;
      invalidate();
      if (!suspended && !page.hidden) {
        measure();
        window.scrollTo({ top: translateScroll(before, previous, snapshot()), behavior: "instant" });
        render();
      }
    }, { passive: true });
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", event => { if (event.persisted) { finishOpening(); resume(); } });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) finishOpening();
      else if (!suspended) resume();
    });
    if (motion.addEventListener) motion.addEventListener("change", setMode);
    else motion.addListener(setMode);
    if ("ResizeObserver" in window) {
      const observed = new WeakMap();
      const sizes = new ResizeObserver(entries => {
        for (const entry of entries) {
          const size = entry.contentRect.width + ":" + (entry.target === range ? entry.contentRect.height : "");
          if (observed.get(entry.target) !== size) { observed.set(entry.target, size); invalidate(); }
        }
      });
      // Feed height changes deliberately do not invalidate animation geometry.
      [page, image, poster, range].forEach(element => sizes.observe(element));
    }
    document.fonts?.ready?.then(invalidate);
    setMode();
    if (image.complete) {
      if (image.naturalWidth) onImageLoad();
      else finishLoading(false);
    }
    startAutoplay();
    return { ready, resume, suspend, snapshot, scrollFor };
  }

  const initialise = (page, options = {}) => {
    if (!page) return null;
    if (!controllers.has(page)) controllers.set(page, create(page, options));
    return controllers.get(page);
  };
  const page = document.querySelector("[data-collection-welcome]");
  const visit = performance.getEntriesByType("navigation")[0]?.type;
  const saved = history.state?.collectionView;
  const autoplayOnLoad = !!page && visit !== "back_forward" && !location.hash
    && (saved?.scroll ?? 0) <= 1 && !saved?.homeWelcome?.openingComplete;
  window.CollectionWelcome = {
    autoplayOnLoad, initialise,
    suspend: page => controllers.get(page)?.suspend(),
    resume: page => initialise(page)?.resume(),
    snapshot: page => controllers.get(page)?.snapshot(),
    scrollFor: (page, scroll, previous) => controllers.get(page)?.scrollFor(scroll, previous) ?? scroll
  };
  initialise(page, { autoplay: autoplayOnLoad, reversible: saved?.homeWelcome?.reversible });
})();

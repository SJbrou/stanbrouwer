(() => {
  "use strict";

  const page = document.querySelector("[data-collection-welcome]");
  if (!page) return;

  const root = document.documentElement;
  const intro = page.querySelector(".collection-intro");
  const artwork = intro?.querySelector(".collection-intro__artwork");
  const image = intro?.querySelector(".collection-intro__image");
  const copy = intro?.querySelector(".collection-perspective-copy");
  const captions = intro?.querySelector(".collection-captions--intro");
  const poster = page.querySelector(".collection-poster");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pendingBlocks = new Set();
  let observer;
  let frameObserver;
  let frame;
  let outline;
  let geometry;
  let state = "loading";
  let phaseTimer;
  let renderRequest;
  let needsMeasure = true;

  const clamp = (value) => Math.max(0, Math.min(1, value));
  const mix = (from, to, progress) => from + (to - from) * progress;
  const ease = (progress) => progress * progress * (3 - 2 * progress);
  const setState = (next) => {
    state = next;
    if (intro) intro.dataset.welcomeState = next;
  };

  const reveal = (block) => {
    block.classList.remove("is-reveal-pending");
    pendingBlocks.delete(block);
    observer?.unobserve(block);
    if (pendingBlocks.size === 0) observer?.disconnect();
  };

  const detachImageEvents = () => {
    image?.removeEventListener("load", onImageLoad);
    image?.removeEventListener("error", restoreStatic);
  };

  const restoreStatic = () => {
    window.clearTimeout(window.collectionWelcomeFallback);
    window.clearTimeout(phaseTimer);
    window.cancelAnimationFrame(renderRequest);
    root.classList.remove("collection-welcome-pending");
    page.classList.remove("is-welcome-active", "is-welcome-building", "is-welcome-clearing", "is-welcome-frame", "has-welcome-frame");
    page.classList.remove("has-welcome-typography");
    page.style.removeProperty("--collection-welcome-copy-opacity");
    page.style.removeProperty("--collection-welcome-copy-clip");
    page.style.removeProperty("--collection-welcome-surface-inset");
    if (captions && artwork) artwork.after(captions);
    poster?.style.removeProperty("--collection-welcome-clip");
    detachImageEvents();
    intro?.removeEventListener("animationend", onAnimationEnd);
    window.removeEventListener("scroll", onWelcomeScroll);
    window.removeEventListener("resize", invalidateGeometry);
    frameObserver?.disconnect();
    frame?.remove();
    setState("static");
  };

  const measureFrame = () => {
    const pageBox = page.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    const posterBox = poster.getBoundingClientRect();
    geometry = {
      source: {
        x: imageBox.left - pageBox.left, y: imageBox.top - pageBox.top,
        width: imageBox.width, height: imageBox.height,
        stroke: 2.5 * imageBox.width / image.naturalWidth
      },
      target: {
        x: posterBox.left - pageBox.left, y: posterBox.top - pageBox.top,
        width: posterBox.width, height: posterBox.height,
        stroke: parseFloat(getComputedStyle(poster).borderLeftWidth) || 1
      },
      pageTop: pageBox.top + window.scrollY
    };
    frame.setAttribute("viewBox", [0, 0, pageBox.width, pageBox.height].join(" "));
    needsMeasure = false;
  };

  const renderFrame = () => {
    renderRequest = undefined;
    if (!frame || state === "static") return;
    if (needsMeasure) measureFrame();
    const { source, target, pageTop } = geometry;
    const progress = state === "clearing" ? 0
      : clamp((window.scrollY - pageTop - source.y) / Math.max(1, target.y - source.y));
    // Widen before the feed enters view; the lower edge then extends down the page.
    const widening = ease(clamp(progress / 0.32));
    const extending = ease(clamp((progress - 0.08) / 0.92));
    const stroke = mix(source.stroke, target.stroke, widening);
    const x = mix(source.x, target.x, widening);
    const y = mix(source.y, target.y, progress);
    const width = mix(source.width, target.width, widening);
    const height = mix(source.height, target.height, extending);
    Object.entries({
      x: x + stroke / 2, y: y + stroke / 2,
      width: Math.max(0, width - stroke), height: Math.max(0, height - stroke),
      "stroke-width": stroke
    }).forEach(([name, value]) => outline.setAttribute(name, value));
    // Keep white paper inside the moving border and the original surround outside.
    page.style.setProperty("--collection-welcome-surface-inset", [
      y - source.y,
      source.x + source.width - x - width,
      source.y + source.height - y - height,
      x - source.x
    ].map(value => value + "px").join(" "));
    // Let the cover text leave before the frame becomes the feed's border.
    page.style.setProperty("--collection-welcome-copy-opacity", 1 - ease(clamp(progress / 0.18)));
    const copyClip = [
      Math.min(source.height, Math.max(0, y - source.y)),
      Math.min(source.width, Math.max(0, source.x + source.width - x - width)),
      Math.min(source.height, Math.max(0, source.y + source.height - y - height)),
      Math.min(source.width, Math.max(0, x - source.x))
    ];
    page.style.setProperty("--collection-welcome-copy-clip", copyClip.map(value => value + "px").join(" "));
    // Reveal the feed within the opening frame, including on short mobile screens.
    const top = Math.min(target.height, Math.max(0, y - target.y));
    const right = Math.min(target.width, Math.max(0, target.x + target.width - x - width));
    const bottom = Math.min(target.height, Math.max(0, target.y + target.height - y - height));
    const left = Math.min(target.width, Math.max(0, x - target.x));
    poster.style.setProperty("--collection-welcome-clip", [top, right, bottom, left].map(value => value + "px").join(" "));
    page.classList.toggle("is-welcome-active", progress < 1);
    page.classList.toggle("has-welcome-frame", progress < 1);
    if (state !== "clearing") setState(progress >= 1 ? "complete" : progress > 0 ? "handover" : "ready");
  };

  const queueRender = () => {
    if (!renderRequest) renderRequest = window.requestAnimationFrame(renderFrame);
  };

  const invalidateGeometry = () => {
    needsMeasure = true;
    queueRender();
  };

  const createFrame = () => {
    if (frame) return;
    const namespace = "http://www.w3.org/2000/svg";
    frame = document.createElementNS(namespace, "svg");
    frame.classList.add("collection-welcome-frame");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("focusable", "false");
    outline = document.createElementNS(namespace, "rect");
    frame.appendChild(outline);
    page.appendChild(frame);
    if ("ResizeObserver" in window) {
      frameObserver = new ResizeObserver(invalidateGeometry);
      frameObserver.observe(artwork);
      frameObserver.observe(intro);
      frameObserver.observe(poster);
    }
    window.addEventListener("resize", invalidateGeometry, { passive: true });
    renderFrame();
  };

  const readyFrame = () => {
    if (state === "static") return;
    window.clearTimeout(phaseTimer);
    page.classList.remove("is-welcome-building", "is-welcome-clearing");
    page.classList.add("is-welcome-frame");
    setState("ready");
    createFrame();
    renderFrame();
  };

  const beginClear = () => {
    if (state !== "holding") return;
    setState("clearing");
    createFrame();
    page.classList.add("is-welcome-clearing");
    phaseTimer = window.setTimeout(readyFrame, 700);
  };

  const beginHold = () => {
    if (state !== "building") return;
    window.clearTimeout(phaseTimer);
    page.classList.remove("is-welcome-building");
    setState("holding");
    phaseTimer = window.setTimeout(beginClear, 233);
  };

  const onAnimationEnd = (event) => {
    if (event.animationName !== "collection-perspective-depth") return;
    if (event.target === image && state === "building") beginHold();
    else if (event.pseudoElement === "::after" && state === "clearing") readyFrame();
  };

  const onWelcomeScroll = () => {
    if (state === "loading" || state === "waiting") {
      if (window.scrollY > 24) restoreStatic();
      return;
    }
    if (["building", "holding", "clearing"].includes(state) && window.scrollY > 24) readyFrame();
    else queueRender();
  };

  const startWelcome = () => {
    if (state !== "waiting") return;
    if (motion.matches || window.scrollY > 24 || !image.naturalWidth
        || !root.classList.contains("collection-welcome-pending")) {
      restoreStatic();
      return;
    }
    window.clearTimeout(window.collectionWelcomeFallback);
    root.classList.remove("collection-welcome-pending");
    detachImageEvents();
    if (copy && captions) {
      copy.appendChild(captions);
      page.classList.add("has-welcome-typography");
    }
    setState("building");
    page.classList.add("is-welcome-active", "is-welcome-building");
    intro.addEventListener("animationend", onAnimationEnd);
    // A cancelled animation must still advance to the next phase.
    phaseTimer = window.setTimeout(beginHold, 700);
  };

  const onImageLoad = () => {
    const decoded = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
    decoded.then(() => {
      if (state !== "loading") return;
      setState("waiting");
      phaseTimer = window.setTimeout(() => window.requestAnimationFrame(startWelcome), 500);
    });
  };

  const setupScrollReveals = () => {
    if (motion.matches || !("IntersectionObserver" in window)) return;
    const blocks = page.querySelectorAll([
      ".collection-section--invites",
      ".collection-subsection"
    ].join(","));
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) reveal(entry.target); });
    }, { rootMargin: "0px 0px -4% 0px", threshold: 0 });
    blocks.forEach((block) => {
      if (block.getBoundingClientRect().top < window.innerHeight * 0.96) return;
      pendingBlocks.add(block);
      block.classList.add("collection-scroll-reveal", "is-reveal-pending");
      observer.observe(block);
    });
    page.addEventListener("focusin", (event) => {
      const block = event.target.closest(".is-reveal-pending");
      if (block) reveal(block);
      if (page.classList.contains("is-welcome-active") && event.target.closest(".collection-poster")) restoreStatic();
    });
  };

  const onMotionChange = () => {
    if (!motion.matches) return;
    restoreStatic();
    [...pendingBlocks].forEach(reveal);
  };
  if (motion.addEventListener) motion.addEventListener("change", onMotionChange);
  else motion.addListener(onMotionChange);
  setupScrollReveals();

  if (!intro || !artwork || !image || !poster || motion.matches || window.scrollY > 24
      || !root.classList.contains("collection-welcome-pending")) {
    restoreStatic();
    return;
  }
  intro.dataset.welcomeState = state;
  window.addEventListener("scroll", onWelcomeScroll, { passive: true });
  image.addEventListener("load", onImageLoad, { once: true });
  image.addEventListener("error", restoreStatic, { once: true });
  if (image.complete) {
    if (image.naturalWidth) onImageLoad();
    else restoreStatic();
  }
})();

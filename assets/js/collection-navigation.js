(() => {
  "use strict";
  const config = window.COLLECTION_PROJECTS_CONFIG;
  const projects = window.CollectionProjects;
  const detail = document.querySelector("[data-project-page]");
  const controls = document.querySelector("[data-project-design-controls]");
  if (!detail) return;
  const homePath = new URL(config.homeUrl, location.href).pathname;
  const detailPath = new URL(config.detailUrl, location.href).pathname;
  const previewPath = new URL(config.previewUrl, location.href).pathname;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canonical = document.querySelector('link[rel="canonical"]');
  const initialTitle = document.title;
  let home = document.querySelector("[data-collection-welcome]");
  let currentUrl = new URL(location.href);
  let variant = "modular";
  let example = "image";
  let transitionVariant = "fixed";
  let previewSide = "project";
  let liveProjects = [];
  let homeScroll = history.state?.collectionView?.homeScroll ?? null;
  let homeFocus = history.state?.collectionView?.homeFocus ?? null;
  let navigating = false;
  let pendingNavigation;
  let interrupted = false;
  let homeRequest;
  let renderVersion = 0;

  const isHome = url => url.pathname === homePath;
  const isPreview = url => url.pathname === previewPath && !!controls;
  const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const activePage = () => home && !home.hidden ? home : detail;
  const focusHeading = () => activePage().querySelector("h1")?.focus({ preventScroll: true });
  const metadata = url => {
    const heading = activePage().querySelector("h1")?.textContent;
    document.title = isHome(url) ? `Collection - ${config.siteTitle}`
      : isPreview(url) ? initialTitle : `${heading || "Projects"} - ${config.siteTitle}`;
    if (canonical) canonical.href = new URL(url.pathname + url.search, location.origin).href;
  };

  const showDetail = async url => {
    const version = ++renderVersion;
    const key = url.searchParams.get("project");
    projects.status(detail, "Loading project…", "Reading the collection.");
    try {
      const items = await projects.load();
      if (version !== renderVersion) return;
      if (!key) projects.renderIndex(detail, items);
      else {
        const item = items.find(project => project.slug === key);
        if (!item) projects.status(detail, "Project not found", "This project may have been renamed. Return to PROJECTS to find it.");
        else projects.render(detail, item);
      }
    } catch (_) {
      if (version !== renderVersion) return;
      projects.status(detail, "Project unavailable", "The collection could not be loaded. Please try again.", () => showDetail(url));
    }
    if (!detail.hidden) metadata(url);
  };

  const previewProject = () => liveProjects.find(project => project.slug === example) || projects.examples[example] || projects.examples.image;
  const updateTransitionControls = () => {
    if (!controls) return;
    const labels = {
      fixed: "The image sits at each page's end and stays pinned while the page folds through PERSPECTIVE.",
      lift: "A clean sheet moves up and down over the fixed floor; the image appears between pages.",
      footer: "A shared image footer carries navigation while the page above it crossfades."
    };
    controls.querySelectorAll("[data-project-transition]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.projectTransition === transitionVariant));
    });
    controls.querySelector("[data-project-transition-status]").textContent = labels[transitionVariant];
    controls.querySelector("[data-project-preview-switch]").textContent = previewSide === "project"
      ? "Switch to PROJECTS" : "Switch to project";
  };
  const renderPreview = () => {
    ++renderVersion;
    if (previewSide === "project") projects.render(detail, previewProject(), variant);
    else {
      projects.renderIndex(detail, [previewProject()]);
      detail.querySelectorAll("[data-collection-project]").forEach(link => { link.href = previewPath; });
    }
    controls.querySelectorAll("[data-project-design]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.projectDesign === variant));
    });
    controls.querySelector("[data-project-design-status]").textContent = {
      editorial: "Editorial sheet", split: "Split dossier", modular: "Modular plate"
    }[variant];
    updateTransitionControls();
  };
  if (controls) {
    controls.addEventListener("click", event => {
      const button = event.target.closest("[data-project-design]");
      if (button && !navigating) { variant = button.dataset.projectDesign; renderPreview(); }
      const transitionButton = event.target.closest("[data-project-transition]");
      if (transitionButton && !navigating) {
        transitionVariant = transitionButton.dataset.projectTransition;
        updateTransitionControls();
      }
      const switchButton = event.target.closest("[data-project-preview-switch]");
      if (switchButton && !navigating) {
        previewSide = previewSide === "project" ? "index" : "project";
        navigate(currentUrl, { replay: true });
      }
      if (event.target.closest("[data-project-replay]") && !navigating) {
        navigate(currentUrl, { replay: true, focal: event.target.closest("[data-project-replay]") });
      }
    });
    controls.querySelector("[data-project-example]").addEventListener("change", event => {
      example = event.target.value;
      renderPreview();
    });
    projects.load().then(items => {
      liveProjects = items.filter(project => project.description);
      const group = document.createElement("optgroup");
      group.label = "Live PROJECTS sheet";
      liveProjects.forEach(project => {
        const option = document.createElement("option");
        option.value = project.slug;
        option.textContent = project.title;
        group.append(option);
      });
      controls.querySelector("[data-project-example]").append(group);
    }).catch(() => { /* The local examples keep design review available offline. */ });
  }

  const ensureHome = () => {
    if (home) return Promise.resolve();
    if (homeRequest) return homeRequest;
    homeRequest = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(config.homeUrl, { signal: controller.signal });
        if (!response.ok) throw new Error("Collection unavailable.");
        const documentCopy = new DOMParser().parseFromString(await response.text(), "text/html");
        const source = documentCopy.querySelector("[data-collection-welcome]");
        if (!source) throw new Error("Collection unavailable.");
        home = document.importNode(source, true);
        home.hidden = true;
        detail.before(home);
        window.Collection.initialise();
      } finally { window.clearTimeout(timeout); }
    })().catch(error => { homeRequest = null; throw error; });
    return homeRequest;
  };

  const visibleFrame = page => {
    const rect = page.querySelector(".collection-poster").getBoundingClientRect();
    const x = Math.max(0, rect.left);
    const y = Math.max(0, rect.top);
    return {
      x, y,
      width: Math.max(1, Math.min(innerWidth, rect.right) - x),
      height: Math.max(1, Math.min(innerHeight, rect.bottom) - y)
    };
  };
  const focusedProjectLink = () => homeFocus && home
    ? Array.from(home.querySelectorAll("[data-collection-project]")).find(node => node.dataset.collectionProject === homeFocus)
    : null;
  const focalPoint = element => {
    const rect = element?.getBoundingClientRect();
    return rect && rect.width && rect.height
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: innerWidth / 2, y: innerHeight / 2 };
  };
  const squareFrame = point => {
    const side = Math.min(176, Math.max(112, innerWidth * 0.18));
    const reference = Math.min(innerWidth - 16, innerHeight - 32);
    const fallbackX = (innerWidth - reference) / 2 + reference * 0.2023;
    const fallbackY = (innerHeight - reference) / 2 + reference * 0.7826;
    const centerX = point ? point.x : fallbackX;
    const centerY = point ? point.y : fallbackY;
    const safeX = Math.max(side / 2 + 8, Math.min(innerWidth - side / 2 - 8, centerX));
    const safeY = Math.max(side / 2 + 8, Math.min(innerHeight - side / 2 - 8, centerY));
    return {
      x: safeX - side / 2,
      y: safeY - side / 2,
      width: side, height: side
    };
  };
  const mix = (from, to, progress) => Object.fromEntries(Object.keys(from).map(key => [key, from[key] + (to[key] - from[key]) * progress]));
  const ease = progress => progress * progress * (3 - 2 * progress);
  const clamp = progress => Math.max(0, Math.min(1, progress));
  const animation = (duration, draw) => new Promise(resolve => {
    if (interrupted || motion.matches) { draw(1); resolve(); return; }
    const start = performance.now();
    let frame;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
      draw(1);
      resolve();
    };
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      draw(progress);
      if (progress === 1 || interrupted || motion.matches) finish();
      else frame = requestAnimationFrame(tick);
    };
    const watchdog = setTimeout(finish, duration + 100);
    frame = requestAnimationFrame(tick);
  });

  const makeTransition = kind => {
    const overlay = document.createElement("div");
    overlay.className = `collection-route collection-route--${kind}`;
    overlay.setAttribute("aria-hidden", "true");
    const floor = document.createElement("div");
    floor.className = "collection-route__floor";
    const floorImage = document.createElement("img");
    floorImage.className = "collection-route__floor-image";
    floorImage.src = config.transitionGridImage;
    floorImage.alt = "";
    floorImage.draggable = false;
    floorImage.decoding = "async";
    floor.append(floorImage);
    const paper = document.createElement("div");
    paper.className = "collection-route__paper";
    const snapshot = document.createElement("div");
    snapshot.className = "collection-route__snapshot";
    paper.append(snapshot);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("collection-route__frame");
    svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    const rects = Array.from({ length: 5 }, () => {
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      svg.append(rect);
      return rect;
    });
    const type = document.createElement("p");
    type.className = "collection-route__type";
    type.textContent = "PERSPECTIVE";
    const dock = document.createElement("div");
    dock.className = "collection-route__dock";
    ["← PROJECTS", "PERSPECTIVE", "OPEN PROJECT ↗"].forEach(label => {
      const item = document.createElement("span");
      item.textContent = label;
      dock.append(item);
    });
    overlay.append(floor, paper, svg, type, dock);
    const positionFloor = () => {
      const ratio = floorImage.naturalWidth && floorImage.naturalHeight
        ? floorImage.naturalWidth / floorImage.naturalHeight : 1920 / 521;
      const width = innerWidth;
      const height = width / ratio;
      floorImage.style.width = `${width}px`;
      floorImage.style.height = `${height}px`;
      floorImage.style.left = "0px";
      floorImage.style.top = `${innerHeight - height}px`;
    };
    floorImage.addEventListener("load", positionFloor, { once: true });
    positionFloor();
    const capture = () => {
      const clone = activePage().cloneNode(true);
      clone.hidden = false;
      clone.inert = true;
      clone.style.top = `${activePage().getBoundingClientRect().top}px`;
      clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
      clone.querySelectorAll("iframe, script, .collection-welcome-frame, .collection-media-window, .collection-image-window, .collection-media-window-toggle, .collection-mobile-sound-candidate").forEach(node => node.remove());
      snapshot.replaceChildren(clone);
    };
    const drawFrames = (rect, square, echo) => rects.forEach((node, index) => {
      const box = index ? mix(rect, square, [0, 0.18, 0.42, 0.66, 0.84][index]) : rect;
      Object.entries({ x: box.x + 0.5, y: box.y + 0.5, width: Math.max(0, box.width - 1), height: Math.max(0, box.height - 1) }).forEach(([key, value]) => node.setAttribute(key, value));
      node.style.opacity = index ? echo : 1;
    });
    const draw = (rect, square, opacity, echo, typeOpacity, contraction = 1,
      focus = { x: innerWidth / 2, y: innerHeight / 2 }, floorOpacity = 0) => {
      floor.style.opacity = floorOpacity;
      paper.style.clipPath = `inset(${rect.y}px ${Math.max(0, innerWidth - rect.x - rect.width)}px ${Math.max(0, innerHeight - rect.y - rect.height)}px ${rect.x}px)`;
      const smallScale = Math.min(square.width / innerWidth, square.height / innerHeight);
      const scale = 1 + (smallScale - 1) * contraction;
      const x = (square.x + square.width / 2 - focus.x * smallScale) * contraction;
      const y = (square.y + square.height / 2 - focus.y * smallScale) * contraction;
      snapshot.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      snapshot.style.opacity = opacity;
      drawFrames(rect, square, echo);
      type.style.left = `${Math.max(0, Math.min(innerWidth - square.width, square.x))}px`;
      type.style.top = `${Math.max(0, Math.min(innerHeight - 40, square.y))}px`;
      type.style.width = `${square.width}px`;
      type.style.opacity = typeOpacity;
    };
    const lift = (offset, square, typeOpacity) => {
      floor.style.opacity = 1;
      paper.style.clipPath = "none";
      snapshot.style.transform = `translateY(${offset}px)`;
      snapshot.style.opacity = 1;
      drawFrames(square, square, 0);
      type.style.left = `${Math.max(0, Math.min(innerWidth - square.width, square.x))}px`;
      type.style.top = `${Math.max(0, Math.min(innerHeight - 40, square.y))}px`;
      type.style.width = `${square.width}px`;
      type.style.opacity = typeOpacity;
    };
    const footer = (opacity, square, markerOpacity) => {
      const height = Math.max(112, Math.min(210, innerHeight * 0.24));
      floor.style.opacity = 1;
      paper.style.clipPath = `inset(0 0 ${height}px 0)`;
      snapshot.style.transform = "none";
      snapshot.style.opacity = opacity;
      dock.style.opacity = 1;
      rects.forEach((node, index) => {
        const box = square;
        Object.entries({ x: box.x + 0.5, y: box.y + 0.5, width: Math.max(0, box.width - 1), height: Math.max(0, box.height - 1) }).forEach(([key, value]) => node.setAttribute(key, value));
        node.style.opacity = index === 0 ? markerOpacity : 0;
      });
      type.style.opacity = 0;
    };
    capture();
    document.body.append(overlay);
    return { overlay, capture, draw, lift, footer };
  };

  const scrollFor = (url, state) => {
    if (!isHome(url)) return state?.scroll ?? 0;
    const rememberedScroll = state?.scroll ?? homeScroll;
    const projectLink = focusedProjectLink();
    if (rememberedScroll != null && (rememberedScroll > 0 || !projectLink)) return rememberedScroll;
    if (projectLink) {
      const rect = projectLink.getBoundingClientRect();
      const centered = rect.top + scrollY + rect.height / 2 - innerHeight * 0.56;
      return Math.max(0, Math.min(centered, document.documentElement.scrollHeight - innerHeight));
    }
    if (rememberedScroll != null) return rememberedScroll;
    return document.getElementById("projects-title")?.getBoundingClientRect().top + scrollY || 0;
  };
  const swap = (url, state) => {
    if (isHome(url) && !home) {
      detail.hidden = false;
      projects.status(detail, "Loading collection…", "Returning to PROJECTS.");
      if (controls) controls.hidden = true;
      window.scrollTo(0, 0);
      metadata(url);
      return;
    }
    if (home) home.hidden = !isHome(url);
    detail.hidden = isHome(url);
    if (controls) controls.hidden = !isPreview(url);
    window.scrollTo(0, scrollFor(url, state));
    if (isHome(url)) window.Collection.resume();
    metadata(url);
  };

  async function navigate(input, options = {}) {
    const url = new URL(input, location.href);
    if (navigating) { pendingNavigation = { url, options }; return; }
    navigating = true;
    interrupted = false;
    const outgoing = activePage();
    const outgoingScroll = scrollY;
    if (isHome(currentUrl)) {
      if (!options.pop) homeScroll = outgoingScroll;
      homeFocus = options.focal?.dataset.collectionProject || document.activeElement?.dataset.collectionProject || homeFocus;
    }
    if (isHome(url) && !homeFocus) homeFocus = currentUrl.searchParams.get("project");
    if (!options.pop && !options.replay) {
      history.replaceState({ ...history.state, collectionView: { scroll: outgoingScroll, homeScroll, homeFocus } }, "", currentUrl.href);
      history.pushState({ collectionView: { homeScroll, homeFocus } }, "", url.href);
    }
    const state = options.state || (options.replay ? { scroll: outgoingScroll } : isHome(url) ? { scroll: homeScroll } : null);
    let transition;
    try {
      const canAnimate = !motion.matches && window.CSS?.supports("clip-path", "inset(0)") && !document.hidden;
      const start = canAnimate ? visibleFrame(outgoing) : null;
      const previewFocal = controls && isPreview(url)
        ? detail.querySelector(previewSide === "project" ? "[data-collection-project]" : "[data-collection-home]")
        : null;
      const focalElement = options.focal || previewFocal || (isHome(url)
        ? detail.querySelector("[data-collection-home]")
        : isHome(currentUrl) ? focusedProjectLink() : null);
      const linkFocus = canAnimate && focalElement ? focalPoint(focalElement) : null;
      const square = canAnimate ? squareFrame(linkFocus) : null;
      const focus = canAnimate ? linkFocus || {
        x: square.x + square.width / 2, y: square.y + square.height / 2
      } : null;
      if (canAnimate) transition = makeTransition(transitionVariant);
      const prepared = isHome(url) ? ensureHome()
        : isPreview(url) ? Promise.resolve(renderPreview()) : showDetail(url);
      if (isHome(currentUrl)) window.Collection.suspend();
      if (canAnimate) {
        outgoing.inert = true;
        if (controls) controls.inert = true;
        document.body.classList.add("is-collection-navigating");
        if (transitionVariant === "lift") {
          transition.overlay.dataset.transitionPhase = "lift-away";
          await animation(520, progress => transition.lift(-innerHeight * ease(progress), square, ease(progress)));
          transition.overlay.dataset.transitionPhase = "hold";
          transition.lift(-innerHeight, square, 1);
          const ready = prepared.then(() => true);
          await Promise.all([interrupted ? Promise.resolve() : delay(200), Promise.race([ready, delay(2200)])]);
          swap(url, state);
          transition.capture();
          transition.lift(innerHeight, square, 1);
          transition.overlay.dataset.transitionPhase = "rise-in";
          await animation(520, progress => transition.lift(innerHeight * (1 - ease(progress)), square, 1 - ease(progress)));
        } else if (transitionVariant === "footer") {
          transition.overlay.dataset.transitionPhase = "crossfade-out";
          await animation(320, progress => transition.footer(1 - ease(progress), square, ease(progress)));
          transition.overlay.dataset.transitionPhase = "hold";
          transition.footer(0, square, 1);
          const ready = prepared.then(() => true);
          await Promise.all([interrupted ? Promise.resolve() : delay(180), Promise.race([ready, delay(2200)])]);
          swap(url, state);
          transition.capture();
          transition.footer(0, square, 1);
          transition.overlay.dataset.transitionPhase = "crossfade-in";
          await animation(320, progress => transition.footer(ease(progress), square, 1 - ease(progress)));
        } else {
          transition.overlay.dataset.transitionPhase = "contract";
          await animation(420, progress => transition.draw(mix(start, square, ease(progress)), square,
            Math.max(0, 1 - progress / 0.7), Math.round(progress * 4) % 2 ? 0.7 : 0.35,
            Math.max(0, (progress - 0.65) / 0.35), ease(progress), focus,
            0.78 * ease(clamp((progress - 0.1) / 0.6))));
          transition.overlay.dataset.transitionPhase = "hold";
          transition.draw(square, square, 0, 0, 1, 1, focus, 0.78);
          const ready = prepared.then(() => true);
          await Promise.all([interrupted ? Promise.resolve() : delay(200), Promise.race([ready, delay(2200)])]);
          swap(url, state);
          transition.capture();
          transition.overlay.dataset.transitionPhase = "expand";
          const target = visibleFrame(activePage());
          await animation(460, progress => transition.draw(mix(square, target, ease(progress)), square,
            Math.max(0, (progress - 0.74) / 0.26), progress < 0.4 ? (Math.round(progress * 10) % 2 ? 0.7 : 0.35) : 0,
            Math.max(0, 1 - progress / 0.3), 1 - ease(progress), focus,
            0.78 * (1 - ease(clamp(progress / 0.82)))));
        }
      } else {
        // The loading surface can be shown immediately without waiting on the network.
        if (isHome(url)) await Promise.race([prepared, delay(2200)]);
        swap(url, state);
      }
      currentUrl = url;
      if (isHome(url) && home && homeFocus) {
        const link = Array.from(home.querySelectorAll("[data-collection-project]")).find(node => node.dataset.collectionProject === homeFocus);
        link?.focus({ preventScroll: true });
      } else focusHeading();
      prepared.then(() => {
        if (currentUrl.href !== url.href) return;
        if (isHome(url) && home?.hidden) {
          swap(url, state);
          const link = Array.from(home.querySelectorAll("[data-collection-project]")).find(node => node.dataset.collectionProject === homeFocus);
          link?.focus({ preventScroll: true });
        }
        metadata(url);
        if (isHome(url) && homeScroll == null && Math.abs(scrollY - scrollFor(url, state)) < 4) window.scrollTo(0, scrollFor(url, state));
      }).catch(() => { if (isHome(url) && currentUrl.href === url.href) location.assign(url.href); });
    } catch (error) {
      // A missing fetched shell falls back to the real, directly loadable URL.
      console.warn("Collection navigation fell back to a full page load:", error);
      location.assign(url.href);
    } finally {
      transition?.overlay.remove();
      document.body.classList.remove("is-collection-navigating");
      outgoing.inert = false;
      activePage().inert = false;
      if (controls) controls.inert = false;
      navigating = false;
      if (pendingNavigation) {
        const next = pendingNavigation;
        pendingNavigation = null;
        navigate(next.url, next.options);
      }
    }
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-collection-project], a[data-collection-home]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (controls && previewSide === "index" && url.pathname === previewPath && url.origin === location.origin) {
      event.preventDefault();
      previewSide = "project";
      navigate(currentUrl, { replay: true, focal: link });
      return;
    }
    if (url.origin !== location.origin || ![homePath, detailPath].includes(url.pathname)) return;
    event.preventDefault();
    navigate(url, { focal: link });
  });
  window.addEventListener("popstate", event => navigate(location.href, { pop: true, state: event.state?.collectionView }));
  window.addEventListener("resize", () => { if (navigating) interrupted = true; });
  document.addEventListener("visibilitychange", () => { if (navigating && document.hidden) interrupted = true; });
  motion.addEventListener("change", () => { if (navigating && motion.matches) interrupted = true; });
  history.scrollRestoration = "manual";
  let scrollRequest;
  const saveScroll = () => {
    scrollRequest = null;
    if (navigating || currentUrl.href !== location.href) return;
    if (isHome(currentUrl) && (!home || home.hidden)) return;
    if (isHome(currentUrl)) homeScroll = scrollY;
    history.replaceState({ ...history.state, collectionView: { scroll: scrollY, homeScroll, homeFocus } }, "", location.href);
  };
  window.addEventListener("scroll", () => {
    if (!scrollRequest && !navigating) scrollRequest = requestAnimationFrame(saveScroll);
  }, { passive: true });
  window.addEventListener("pagehide", () => {
    if (!navigating) history.replaceState({ ...history.state, collectionView: { scroll: scrollY, homeScroll, homeFocus } }, "", location.href);
  });
  if (isPreview(currentUrl)) renderPreview();
  else if (!isHome(currentUrl)) showDetail(currentUrl).then(() => window.scrollTo(0, history.state?.collectionView?.scroll || 0));
  else if (history.state?.collectionView?.scroll) {
    Promise.resolve(window.Collection.initialise()).then(() => window.scrollTo(0, history.state.collectionView.scroll));
  }
})();

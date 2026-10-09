(() => {
  "use strict";
  const config = window.COLLECTION_PROJECTS_CONFIG;
  const projects = window.CollectionProjects;
  const detail = document.querySelector("[data-project-page]");
  const invitePage = document.querySelector("[data-invite-page]");
  const controls = document.querySelector("[data-project-design-controls]");
  if (!detail) return;
  window.CollectionBookingNavigation = true;
  const homePath = new URL(config.homeUrl, location.href).pathname;
  const detailPath = new URL(config.detailUrl, location.href).pathname;
  const invitePath = new URL(config.inviteUrl, location.href).pathname;
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
  const initialView = history.state?.collectionView;
  let homeScroll = history.state?.collectionView?.homeScroll ?? null;
  let homeFocus = history.state?.collectionView?.homeFocus ?? null;
  let homeInviteFocus = history.state?.collectionView?.homeInviteFocus ?? null;
  let homeWelcome = initialView?.homeWelcome ?? null;
  let restoringHome = !!home && !window.CollectionWelcome?.autoplayOnLoad && (initialView?.scroll != null || !!location.hash
    || performance.getEntriesByType("navigation")[0]?.type !== "navigate");
  let restoreInterrupted = false;
  let navigating = false;
  let pendingNavigation;
  let interrupted = false;
  let homeRequest;
  let renderVersion = 0;

  const isHome = url => url.pathname === homePath;
  const isPreview = url => url.pathname === previewPath && !!controls;
  const isInvite = url => !!invitePage && (window.TZBooking?.isUrl(url)
    || url.pathname === invitePath && !!url.searchParams.get("event"));
  const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const viewState = scroll => ({ scroll, homeScroll, homeFocus, homeInviteFocus, homeWelcome });
  const rememberHome = () => {
    homeScroll = scrollY;
    homeWelcome = window.CollectionWelcome?.snapshot(home) ?? homeWelcome;
  };
  const activePage = () => home && !home.hidden ? home : invitePage && !invitePage.hidden ? invitePage : detail;
  const focusHeading = () => {
    const heading = activePage().querySelector(".ticket-flow-section h2, .ticket-confirmation h2") || activePage().querySelector("h1");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  };
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

  const showInvite = async url => {
    const version = ++renderVersion;
    if (window.TZBooking) {
      await window.TZBooking.showUrl(invitePage, url);
      if (version === renderVersion && !invitePage.hidden) metadata(url);
      return;
    }
    const target = invitePage?.querySelector("#invite-content");
    if (!target || !window.TZInvites || !window.TZInviteDetail) return;
    const homeHref = config.homeUrl + "#collection-invites";
    target.setAttribute("aria-busy", "true");
    window.TZInviteDetail.message(target, "Loading invite", "Reading the event details.", homeHref);
    target.setAttribute("aria-busy", "true");
    invitePage.setAttribute("aria-busy", "true");
    try {
      const events = await window.TZInvites.load();
      if (version !== renderVersion) return;
      const eventId = url.searchParams.get("event");
      const event = events.find(candidate => candidate.id === eventId && candidate.publish);
      if (!event) window.TZInviteDetail.message(target, "Invite not found", "This event may no longer be available.", homeHref);
      else window.TZInviteDetail.render(target, event);
    } catch (_) {
      if (version !== renderVersion) return;
      window.TZInviteDetail.message(target, "Invite unavailable", "The event details could not be loaded. Please try again.", homeHref, () => showInvite(url));
    }
    invitePage.setAttribute("aria-busy", "false");
    if (!invitePage.hidden) metadata(url);
  };

  const previewProject = () => liveProjects.find(project => project.slug === example) || projects.examples[example] || projects.examples.image;
  const updateTransitionControls = () => {
    if (!controls) return;
    const labels = {
      fixed: "One continuous grid stays behind the paper as it folds through PERSPECTIVE into the next page.",
      lift: "The sheet lifts over one continuous grid into the next page.",
      footer: "The page crossfades over one continuous grid."
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
        await window.CollectionWelcome?.initialise(home, { autoplay: false })?.ready;
      } finally { window.clearTimeout(timeout); }
    })().catch(error => { homeRequest = null; throw error; });
    return homeRequest;
  };

  const { visibleFrame, captureFloor, focalPoint, squareFrame, mix, ease } = window.CollectionPageTransition;
  const focusedProjectLink = () => homeFocus && home
    ? Array.from(home.querySelectorAll("[data-collection-project]")).find(node => node.dataset.collectionProject === homeFocus)
    : null;
  const focusedHomeLink = () => home && (homeInviteFocus
    ? Array.from(home.querySelectorAll("[data-collection-invite]")).find(node => node.dataset.collectionInvite === homeInviteFocus)
    : focusedProjectLink());
  const animation = (duration, draw) => new Promise(resolve => {
    if (interrupted || motion.matches) { draw(1); resolve(); return; }
    // Paint the outgoing geometry immediately, before the overlay's first RAF.
    draw(0);
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

  const scrollFor = (url, state) => {
    if (!isHome(url)) return state?.scroll ?? 0;
    const rememberedScroll = state?.scroll ?? homeScroll;
    const focusedLink = focusedHomeLink();
    const restoredScroll = () => window.CollectionWelcome?.scrollFor(home, rememberedScroll, state?.homeWelcome ?? homeWelcome) ?? rememberedScroll;
    // A reversed entrance at zero is an intentional saved position, even when
    // a previously opened project still supplies the remembered focus.
    if (rememberedScroll != null && (rememberedScroll > 0 || !focusedLink
      || (state?.homeWelcome ?? homeWelcome)?.reversible)) return restoredScroll();
    if (focusedLink) {
      const rect = focusedLink.getBoundingClientRect();
      const centered = rect.top + scrollY + rect.height / 2 - innerHeight * 0.56;
      const welcomeEnd = window.CollectionWelcome?.snapshot(home)?.handoverEnd || 0;
      return Math.max(0, Math.min(Math.max(centered, welcomeEnd), document.documentElement.scrollHeight - innerHeight));
    }
    if (rememberedScroll != null) return restoredScroll();
    return document.getElementById("projects-title")?.getBoundingClientRect().top + scrollY || 0;
  };
  const swap = (url, state) => {
    if (isHome(url) && !home) {
      detail.hidden = false;
      if (invitePage) invitePage.hidden = true;
      projects.status(detail, "Loading collection…", "Returning to PROJECTS.");
      if (controls) controls.hidden = true;
      window.scrollTo(0, 0);
      metadata(url);
      return;
    }
    if (home) home.hidden = !isHome(url);
    if (invitePage) invitePage.hidden = !isInvite(url);
    detail.hidden = isHome(url) || isInvite(url);
    if (controls) controls.hidden = !isPreview(url);
    if (isHome(url)) window.CollectionWelcome?.resume(home);
    window.scrollTo({ top: scrollFor(url, state), behavior: "instant" });
    if (isHome(url)) {
      window.CollectionWelcome?.resume(home);
      window.Collection.resume();
      rememberHome();
    }
    metadata(url);
  };

  async function navigate(input, options = {}) {
    const url = new URL(input, location.href);
    if (navigating) { pendingNavigation = { url, options }; return; }
    navigating = true;
    interrupted = false;
    const outgoing = activePage();
    const canAnimate = !motion.matches && window.CSS?.supports("clip-path", "inset(0)") && !document.hidden;
    // Read the outgoing layout before booking cancellation, rendering or scroll
    // changes can alter which part of its footer is actually on screen.
    const start = canAnimate ? visibleFrame(outgoing) : null;
    const floorCapture = canAnimate ? captureFloor(outgoing) : null;
    if (outgoing === invitePage) window.TZBooking?.cancel(invitePage);
    const outgoingScroll = scrollY;
    if (isHome(currentUrl)) {
      if (!options.pop) rememberHome();
      const projectFocus = options.focal?.dataset.collectionProject || document.activeElement?.dataset.collectionProject;
      const inviteFocus = options.focal?.dataset.collectionInvite || document.activeElement?.dataset.collectionInvite;
      if (projectFocus) { homeFocus = projectFocus; homeInviteFocus = null; }
      if (inviteFocus) { homeInviteFocus = inviteFocus; homeFocus = null; }
    }
    if (isHome(url) && !homeFocus && !homeInviteFocus) {
      homeFocus = currentUrl.searchParams.get("project");
      homeInviteFocus = isInvite(currentUrl) ? currentUrl.searchParams.get("event") : null;
    }
    if (options.state) {
      homeScroll = options.state.homeScroll ?? homeScroll;
      homeWelcome = options.state.homeWelcome ?? homeWelcome;
      if (Object.prototype.hasOwnProperty.call(options.state, "homeFocus")) homeFocus = options.state.homeFocus;
      if (Object.prototype.hasOwnProperty.call(options.state, "homeInviteFocus")) homeInviteFocus = options.state.homeInviteFocus;
    }
    if (!options.pop && !options.replay) {
      history.replaceState({ ...history.state, collectionView: viewState(outgoingScroll) }, "", currentUrl.href);
      history.pushState({ ...history.state, collectionView: { scroll: 0, homeScroll, homeFocus, homeInviteFocus, homeWelcome } }, "", url.href);
    }
    const state = options.state || (options.replay ? { scroll: outgoingScroll, homeWelcome } : isHome(url) ? { scroll: homeScroll, homeWelcome } : null);
    let transition;
    let prepared;
    let unlock;
    let restoration;
    let targetReady = false;
    const transitionKind = isInvite(url) || isInvite(currentUrl) ? "fixed" : transitionVariant;
    try {
      const previewFocal = controls && isPreview(url)
        ? detail.querySelector(previewSide === "project" ? "[data-collection-project]" : "[data-collection-home]")
        : null;
      const focalElement = options.focal || previewFocal || (isHome(url)
        ? outgoing.querySelector("[data-collection-home]")
        : isHome(currentUrl) ? focusedHomeLink() : null);
      const linkFocus = canAnimate && (options.point || focalElement)
        ? options.point || focalPoint(focalElement) : null;
      const square = canAnimate ? squareFrame(linkFocus) : null;
      const focus = canAnimate ? linkFocus || {
        x: square.x + square.width / 2, y: square.y + square.height / 2
      } : null;
      if (canAnimate) transition = window.CollectionPageTransition.create(outgoing, transitionKind, floorCapture);
      const switchToTarget = () => {
        swap(url, state);
        if (!isHome(url)) {
          restoration = window.CollectionPageTransition.restoreScroll(activePage(), state?.scroll ?? 0);
          if (targetReady) restoration.finish();
        }
      };
      prepared = isHome(url) ? ensureHome()
        : isPreview(url) ? Promise.resolve(renderPreview()) : isInvite(url) ? showInvite(url) : showDetail(url);
      prepared.then(() => { targetReady = true; }, () => {});
      if (isHome(currentUrl)) {
        window.CollectionWelcome?.suspend(home);
        window.Collection.suspend();
      }
      if (canAnimate) {
        outgoing.inert = true;
        if (controls) controls.inert = true;
        unlock = window.CollectionPageTransition.lockScroll();
        if (transitionKind === "lift") {
          transition.overlay.dataset.transitionPhase = "lift-away";
          await animation(520, progress => transition.lift(-innerHeight * ease(progress), square, ease(progress)));
          transition.overlay.dataset.transitionPhase = "hold";
          transition.lift(-innerHeight, square, 1);
          const ready = prepared.then(() => true);
          await Promise.all([interrupted ? Promise.resolve() : delay(200), Promise.race([ready, delay(2200)])]);
          switchToTarget();
          if (targetReady) await restoration?.finish();
          transition.capture(activePage());
          transition.arrive(activePage());
          transition.lift(innerHeight, square, 1);
          transition.overlay.dataset.transitionPhase = "rise-in";
          await animation(520, progress => transition.lift(innerHeight * (1 - ease(progress)), square,
            1 - ease(progress), progress));
        } else if (transitionKind === "footer") {
          transition.overlay.dataset.transitionPhase = "crossfade-out";
          await animation(320, progress => transition.footer(1 - ease(progress), square, ease(progress)));
          transition.overlay.dataset.transitionPhase = "hold";
          transition.footer(0, square, 1);
          const ready = prepared.then(() => true);
          await Promise.all([interrupted ? Promise.resolve() : delay(180), Promise.race([ready, delay(2200)])]);
          switchToTarget();
          if (targetReady) await restoration?.finish();
          transition.capture(activePage());
          transition.arrive(activePage());
          transition.footer(0, square, 1);
          transition.overlay.dataset.transitionPhase = "crossfade-in";
          await animation(320, progress => transition.footer(ease(progress), square,
            1 - ease(progress), progress));
        } else {
          transition.overlay.dataset.transitionPhase = "contract";
          await animation(420, progress => transition.draw(mix(start, square, ease(progress)), square,
            Math.max(0, 1 - progress / 0.7), Math.round(progress * 4) % 2 ? 0.7 : 0.35,
            Math.max(0, (progress - 0.65) / 0.35), ease(progress), focus));
          transition.overlay.dataset.transitionPhase = "hold";
          transition.draw(square, square, 0, 0, 1, 1, focus);
          const ready = prepared.then(() => true);
          await Promise.all([interrupted ? Promise.resolve() : delay(200), Promise.race([ready, delay(2200)])]);
          switchToTarget();
          if (targetReady) await restoration?.finish();
          transition.capture(activePage());
          transition.arrive(activePage());
          transition.overlay.dataset.transitionPhase = "expand";
          const target = visibleFrame(activePage());
          await animation(460, progress => transition.draw(mix(square, target, ease(progress)), square,
            Math.max(0, (progress - 0.74) / 0.26), progress < 0.4 ? (Math.round(progress * 10) % 2 ? 0.7 : 0.35) : 0,
            Math.max(0, 1 - progress / 0.3), 1 - ease(progress), focus,
            progress));
        }
      } else {
        // The loading surface can be shown immediately without waiting on the network.
        if (isHome(url)) await Promise.race([prepared, delay(2200)]);
        switchToTarget();
      }
      currentUrl = url;
      if (isHome(url) && home) focusedHomeLink()?.focus({ preventScroll: true });
      else focusHeading();
      prepared.then(async () => {
        if (currentUrl.href !== url.href) return;
        const restored = await restoration?.finish();
        if (currentUrl.href !== url.href) return;
        if (isHome(url) && home?.hidden) {
          switchToTarget();
          focusedHomeLink()?.focus({ preventScroll: true });
        }
        if (isInvite(url) && restored) focusHeading();
        metadata(url);
        if (isHome(url) && homeScroll == null && Math.abs(scrollY - scrollFor(url, state)) < 4) window.scrollTo(0, scrollFor(url, state));
      }).catch(() => { if (isHome(url) && currentUrl.href === url.href) location.assign(url.href); });
    } catch (error) {
      // A missing fetched shell falls back to the real, directly loadable URL.
      console.warn("Collection navigation fell back to a full page load:", error);
      location.assign(url.href);
    } finally {
      transition?.overlay.remove();
      unlock?.();
      outgoing.inert = false;
      activePage().inert = false;
      if (controls) controls.inert = false;
      navigating = false;
      if (isHome(currentUrl) && home && !home.hidden) saveScroll();
      if (pendingNavigation) {
        const next = pendingNavigation;
        pendingNavigation = null;
        navigate(next.url, next.options);
      }
    }
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-collection-project], a[data-collection-invite], a[data-collection-home]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (controls && previewSide === "index" && url.pathname === previewPath && url.origin === location.origin) {
      event.preventDefault();
      previewSide = "project";
      navigate(currentUrl, { replay: true, focal: link,
        point: event.detail > 0 ? { x: event.clientX, y: event.clientY } : null });
      return;
    }
    if (url.origin !== location.origin || ![homePath, detailPath, invitePath].includes(url.pathname)
      || (url.pathname === invitePath && !url.searchParams.get("event"))) return;
    event.preventDefault();
    navigate(url, { focal: link,
      point: event.detail > 0 ? { x: event.clientX, y: event.clientY } : null });
  });
  window.addEventListener("tz-booking-route", event => {
    currentUrl = new URL(event.detail.url);
  });
  window.addEventListener("popstate", event => {
    const url = new URL(location.href);
    if (!navigating && invitePage && !invitePage.hidden && isInvite(currentUrl) && isInvite(url) && window.TZBooking) {
      window.TZBooking.navigate(invitePage, url, { pop: true, state: event.state?.collectionView });
    } else navigate(url, { pop: true, state: event.state?.collectionView });
  });
  window.addEventListener("resize", () => { if (navigating) interrupted = true; });
  document.addEventListener("visibilitychange", () => { if (navigating && document.hidden) interrupted = true; });
  motion.addEventListener("change", () => { if (navigating && motion.matches) interrupted = true; });
  history.scrollRestoration = "manual";
  let scrollRequest;
  const saveScroll = () => {
    scrollRequest = null;
    if (navigating || restoringHome || currentUrl.href !== location.href
      || document.body.classList.contains("is-collection-navigating")
      || window.CollectionPageTransition.isRestoring(activePage())) return;
    if (isHome(currentUrl) && (!home || home.hidden)) return;
    if (isHome(currentUrl)) rememberHome();
    history.replaceState({ ...history.state, collectionView: viewState(scrollY) }, "", location.href);
  };
  // Autoplay no longer scrolls the document, so save its completion explicitly.
  window.addEventListener("collection-welcome-settled", saveScroll);
  window.addEventListener("scroll", () => {
    if (!scrollRequest && !navigating) scrollRequest = requestAnimationFrame(saveScroll);
  }, { passive: true });
  window.addEventListener("pagehide", () => {
    if (!navigating && !restoringHome && !document.body.classList.contains("is-collection-navigating")
      && !window.CollectionPageTransition.isRestoring(activePage())) {
      if (isHome(currentUrl)) rememberHome();
      history.replaceState({ ...history.state, collectionView: viewState(scrollY) }, "", location.href);
    }
  });
  window.addEventListener("pageshow", event => {
    if (!event.persisted || !isHome(currentUrl) || !home || home.hidden) return;
    window.CollectionWelcome?.resume(home);
    const saved = history.state?.collectionView;
    if (saved?.scroll != null) window.scrollTo({ top: scrollFor(currentUrl, saved), behavior: "instant" });
    window.CollectionWelcome?.resume(home);
    window.Collection.resume();
    saveScroll();
  });
  const interruptRestoration = () => {
    if (!restoringHome) return;
    restoreInterrupted = true;
    restoringHome = false;
  };
  ["wheel", "touchstart", "pointerdown"].forEach(type => window.addEventListener(type, interruptRestoration, { passive: true }));
  window.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Tab"].includes(event.key)) interruptRestoration();
  });
  if (isPreview(currentUrl)) renderPreview();
  else if (!isHome(currentUrl)) {
    const loaded = isInvite(currentUrl) ? showInvite(currentUrl) : showDetail(currentUrl);
    const restoration = window.CollectionPageTransition.restoreScroll(activePage(), initialView?.scroll ?? 0);
    loaded.then(async () => { await restoration.finish(); saveScroll(); });
  }
  else if (restoringHome) {
    const welcome = window.CollectionWelcome?.initialise(home);
    const previousMinHeight = home.style.minHeight;
    const restoredPosition = () => {
      window.CollectionWelcome?.resume(home);
      const section = location.hash && document.getElementById(location.hash.slice(1));
      return initialView?.scroll != null
        ? scrollFor(currentUrl, initialView)
        : section ? section.getBoundingClientRect().top + scrollY : welcome?.snapshot().leadIn || 0;
    };
    const initialScroll = restoredPosition();
    // Keep a saved position reachable while the sheet data is still loading.
    // Otherwise the browser clamps it and briefly exposes the opening again.
    if (initialScroll + innerHeight > home.offsetHeight) home.style.minHeight = `${initialScroll + innerHeight}px`;
    window.scrollTo({ top: initialScroll, behavior: "instant" });
    window.CollectionWelcome?.resume(home);
    Promise.all([window.Collection.initialise(), welcome?.ready]).finally(() => {
      home.style.minHeight = previousMinHeight;
      if (!restoreInterrupted && isHome(currentUrl) && !home.hidden) {
        window.scrollTo({ top: restoredPosition(), behavior: "instant" });
      }
      window.CollectionWelcome?.resume(home);
      restoringHome = false;
      saveScroll();
    });
  }
})();

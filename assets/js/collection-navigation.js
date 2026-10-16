(() => {
  "use strict";

  // The window layer stays connected while only the page content changes.
  const documents = new Map();
  const entries = new Map();
  const memory = new Map();
  let collection;
  let outlet;
  let status;
  let current = location.pathname + location.search + location.hash;
  let currentEntry;
  let collectionPosition = { y: 0, focus: null };
  let dispose;
  let request;
  let version = 0;
  let pdfPromise;

  const storage = {
    getItem(key) {
      try { return sessionStorage.getItem(key); } catch (_) { return memory.get(key) ?? null; }
    },
    setItem(key, value) {
      try { sessionStorage.setItem(key, value); } catch (_) { memory.set(key, String(value)); }
    },
    removeItem(key) {
      memory.delete(key);
      try { sessionStorage.removeItem(key); } catch (_) { /* No persisted draft. */ }
    }
  };
  const isHome = path => new URL(path, location.origin).pathname === "/";
  const documentPath = path => { const url = new URL(path, location.origin); return url.pathname + url.search; };

  function routeFor(value) {
    const url = new URL(value, location.href);
    if (!/^https?:$/.test(url.protocol)) return null;
    const site = new URL(window.COLLECTION_CONFIG.siteUrl);
    if (url.origin !== location.origin && url.hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "")) return null;
    if (!url.pathname.endsWith("/") && /^\/(?:projects\/[^.?#]+|invites|tickets(?:\/(?:details|overview|confirmation))?)$/.test(url.pathname)) url.pathname += "/";
    if (url.pathname !== "/" && !/^\/projects\/[^?#]+\/$/.test(url.pathname)
      && url.pathname !== "/invites/" && !/^\/tickets\/(?:details\/|overview\/|confirmation\/)?$/.test(url.pathname)) return null;
    if (url.pathname === "/tickets/") return "/invites/" + url.search + url.hash;
    return url.pathname + url.search + url.hash;
  }

  function showStatus(message, retry) {
    status.replaceChildren(document.createTextNode(message));
    status.hidden = !message;
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Try again";
      button.addEventListener("click", retry, { once: true });
      status.append(button);
    }
  }

  function savePosition(updateHistory = true) {
    const position = { y: scrollY, focus: document.activeElement };
    entries.set(currentEntry, position);
    if (isHome(current)) collectionPosition = position;
    if (updateHistory) history.replaceState({
      ...history.state,
      collectionRoute: { entry: currentEntry, path: current, y: position.y },
      ...(isHome(current) ? { collectionView: { scroll: position.y, homeWelcome: window.CollectionWelcome.snapshot(collection) } } : {})
    }, "");
  }

  async function loadPage(path, signal) {
    const url = new URL(path, location.origin);
    const key = url.pathname + url.search;
    if (!documents.has(key)) {
      const response = await fetch(key, { signal });
      if (!response.ok) throw new Error("Page unavailable");
      const source = await response.text();
      if (signal.aborted) throw new DOMException("Navigation interrupted", "AbortError");
      documents.set(key, source);
    }
    const doc = new DOMParser().parseFromString(documents.get(key), "text/html");
    const main = doc.querySelector("main.project-page, main.invite-page, main.ticket-page");
    if (!main) throw new Error("Page unavailable");
    main.querySelectorAll("script").forEach(script => script.remove());
    for (const node of main.querySelectorAll("[src], [href]")) {
      for (const attr of ["src", "href"]) {
        const value = node.getAttribute(attr);
        if (value) node.setAttribute(attr, new URL(value, url).href);
      }
    }
    return {
      main,
      title: doc.title,
      description: doc.querySelector('meta[name="description"]')?.content || "",
      canonical: doc.querySelector('link[rel="canonical"]')?.href || new URL(path, window.COLLECTION_CONFIG.siteUrl).href
    };
  }

  function loadPdf() {
    if (window.jspdf) return Promise.resolve();
    if (!pdfPromise) pdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = resolve;
      script.onerror = () => { pdfPromise = null; script.remove(); reject(new Error("The ticket download could not load.")); };
      document.head.append(script);
    });
    return pdfPromise;
  }

  function mountPage(path) {
    const context = { navigate, storage, loadPdf, isActive: () => documentPath(path) === documentPath(current) };
    if (path.startsWith("/invites/")) return window.InviteDetail.mount(outlet, { ...context, eventId: new URL(path, location.origin).searchParams.get("event") });
    if (path.startsWith("/tickets/")) return window.InviteTicketing.mount(outlet, context);
  }

  function updateMetadata(page, path) {
    document.title = page?.title || window.COLLECTION_CONFIG.homeTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = page ? page.description : "A carefully curated collection of experiences by Stan Brouwer.";
    document.querySelector('link[rel="canonical"]').href = page?.canonical || new URL("/", window.COLLECTION_CONFIG.siteUrl).href;
    document.body.classList.toggle("project-body", path.startsWith("/projects/"));
    document.body.classList.toggle("invite-body", path.startsWith("/invites/"));
    document.body.classList.toggle("tz-page", path.startsWith("/tickets/"));
  }

  async function navigate(value, options = {}) {
    const path = routeFor(value);
    if (!path) { location.assign(value); return; }
    savePosition(!options.pop);
    request?.abort();
    request = new AbortController();
    const token = ++version;
    const oldPath = current;
    const changed = documentPath(path) !== documentPath(current);
    if (changed) {
      window.Collection.setPageActive(false);
      showStatus("Loading page\u2026");
    }
    try {
      const [page] = await Promise.all([
        changed && !isHome(path) ? loadPage(path, request.signal) : Promise.resolve(null),
        changed ? window.CollectionWindowMotion.leavePage() : Promise.resolve()
      ]);
      if (token !== version) return;
      current = path;
      if (changed) {
        dispose?.();
        dispose = null;
        window.CollectionWelcome.suspend(collection);
        collection.hidden = !isHome(path);
        outlet.hidden = isHome(path);
        outlet.replaceChildren(...(page ? [page.main] : []));
        updateMetadata(page, path);
        if (page) dispose = mountPage(path);
      }
      currentEntry = options.pop ? options.entry || crypto.randomUUID() : crypto.randomUUID();
      const state = { ...history.state, collectionRoute: { entry: currentEntry, path, y: options.y || 0 } };
      history[options.pop || options.replace ? "replaceState" : "pushState"](state, "", path);
      // Invite content arrives asynchronously; resolve its anchors and focus
      // only once the reservation form has been mounted.
      await dispose?.ready;
      if (token !== version) return;
      const saved = options.pop ? entries.get(currentEntry) || { y: options.y || 0 } : isHome(path) ? collectionPosition : null;
      const hash = new URL(path, location.origin).hash;
      let anchor;
      try { anchor = hash && document.getElementById(decodeURIComponent(hash.slice(1))); } catch (_) { /* Ignore invalid fragments. */ }
      scrollTo({ top: saved?.y || 0, behavior: "instant" });
      if (anchor && anchor.getClientRects().length) anchor.scrollIntoView({ block: "start", behavior: "instant" });
      if (isHome(path)) {
        window.CollectionWelcome.resume(collection);
        window.Collection.setPageActive(true);
        if (changed) window.CollectionWindowMotion.enterPage();
      }
      const playerFocused = document.activeElement?.closest(".collection-window-layer");
      if (!playerFocused) {
        const root = isHome(path) ? collection : outlet;
        const focus = saved?.focus?.isConnected && saved.focus.getClientRects().length ? saved.focus : anchor || root.querySelector("h1") || root.querySelector("main");
        if (focus) { if (!focus.matches("a, button, input, [tabindex]")) focus.tabIndex = -1; focus.focus({ preventScroll: true }); }
      }
      showStatus("");
      document.body.dataset.collectionPage = path;
      dispatchEvent(new CustomEvent("collection-navigated", { detail: { path } }));
    } catch (error) {
      if (token !== version || error.name === "AbortError") return;
      current = oldPath;
      if (isHome(oldPath)) {
        collection.hidden = false;
        window.Collection.setPageActive(true);
        window.CollectionWindowMotion.enterPage();
      }
      if (options.pop) history.replaceState({ ...history.state, collectionRoute: { entry: currentEntry, path: oldPath, y: scrollY } }, "", oldPath);
      showStatus("This page couldn\u2019t load. Please try again.", () => navigate(path, { ...options, pop: false }));
    }
  }

  window.CollectionNavigation = { navigate, isCollection: () => isHome(current) };
  document.addEventListener("DOMContentLoaded", () => {
    collection = document.querySelector("[data-collection-welcome]");
    outlet = document.querySelector(".collection-route-outlet");
    status = document.querySelector(".collection-navigation-status");
    history.scrollRestoration = "manual";
    current = routeFor(location.href) || current;
    currentEntry = history.state?.collectionRoute?.entry || crypto.randomUUID();
    history.replaceState({ ...history.state, collectionRoute: { entry: currentEntry, path: current, y: history.state?.collectionRoute?.y || 0 } }, "");
    document.body.dataset.collectionPage = current;
    window.Collection.setPageActive(isHome(current));
    dispose = mountPage(current);
    const initial = current;
    dispose?.ready?.then(() => {
      if (current !== initial || !location.hash) return;
      try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start", behavior: "instant" }); } catch (_) { /* Ignore invalid fragments. */ }
    });
    document.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const path = routeFor(link.href);
      if (!path) return;
      event.preventDefault();
      navigate(path);
    });
    addEventListener("popstate", event => navigate(location.href, { pop: true, entry: event.state?.collectionRoute?.entry, y: event.state?.collectionRoute?.y }));
    addEventListener("pagehide", () => savePosition());
  });
})();

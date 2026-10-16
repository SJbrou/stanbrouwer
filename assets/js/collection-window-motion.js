(() => {
  "use strict";

  // Media changes in place. Motion belongs to the complete window frame.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const records = new Map();
  const updating = new Set();
  const easing = "cubic-bezier(.4,0,.2,1)";
  let visibility = 1;

  const contentFor = panel => panel.querySelector(".collection-media-window__content, .collection-image-window__content");
  const recordFor = panel => {
    if (!records.has(panel)) records.set(panel, { epoch: 0, animations: new Set(), effects: new Set(), source: null, suspended: null });
    return records.get(panel);
  };
  const bounds = node => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  const pixels = rect => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, value + "px"]).concat([["right", "auto"], ["bottom", "auto"]]));
  const topInset = () => 8;
  const persistent = panel => panel.dataset.persistentAudio === "true";
  const visible = panel => !panel.hidden && panel.style.visibility !== "hidden";
  const children = panel => [...panel.children];
  const eligible = source => {
    if (!source?.isConnected || !source.getClientRects().length) return false;
    const r = source.getBoundingClientRect();
    return r.bottom > topInset() && r.top < innerHeight && r.height > 0;
  };
  function cancel(panel) {
    const record = recordFor(panel);
    record.epoch++;
    for (const animation of record.animations) animation.cancel();
    for (const effect of record.effects) effect.remove();
    record.animations.clear();
    record.effects.clear();
    record.proxy = record.scrub = record.kind = null;
  }

  function animate(panel, node, frames, duration, finished, options = {}) {
    const record = recordFor(panel);
    const epoch = record.epoch;
    const animation = node.animate(frames, { duration, easing, fill: "both", ...options });
    record.animations.add(animation);
    animation.finished.then(() => {
      record.animations.delete(animation);
      if (record.epoch === epoch) finished?.();
      animation.cancel();
    }).catch(() => {});
    return animation;
  }

  function clampWindow(panel) {
    if (panel.hidden) return;
    const r = bounds(panel);
    const width = Math.min(r.width, innerWidth - 16);
    const height = Math.min(r.height, Math.max(35, innerHeight - topInset() - 8));
    const left = Math.max(8, Math.min(r.left, innerWidth - width - 8));
    const top = Math.max(topInset(), Math.min(r.top, innerHeight - height - 8));
    if (Math.abs(width - r.width) > .5 || Math.abs(height - r.height) > .5) {
      Object.assign(panel.style, { width: width + "px", height: height + "px", aspectRatio: "auto" });
    }
    if (Math.abs(left - r.left) > .5 || Math.abs(top - r.top) > .5) {
      Object.assign(panel.style, { left: left + "px", top: top + "px", right: "auto", bottom: "auto" });
    }
  }

  function aperture(rect, progress = 0) {
    if (window.CollectionWelcome?.rectangleAt) return window.CollectionWelcome.rectangleAt(rect, progress);
    return { left: rect.left + rect.width * 98 / 954, top: rect.top + rect.height * 654 / 953, width: rect.width * 188 / 954, height: rect.height * 188 / 953 };
  }

  function originFor(panel, rect) {
    return aperture(rect);
  }

  function reveal(panel, from) {
    const record = recordFor(panel);
    clampWindow(panel);
    const to = bounds(panel);
    from ||= originFor(panel, to);
    const duration = 360;
    panel.style.visibility = "";
    panel.inert = false;
    record.suspended = null;
    record.kind = "opening";
    for (const child of children(panel)) animate(panel, child, [{ opacity: 0 }, { opacity: 0, offset: .8 }, { opacity: 1 }], duration);
    animate(panel, panel, [pixels(from), pixels(to)], duration, () => { record.kind = null; });
  }

  function closeVisual(panel, from, hideLive = false) {
    const record = recordFor(panel);
    const to = originFor(panel, from);
    const duration = 280;
    // A plain white frame carries the exit. It contains no media, duplicate
    // controls, or iframe, and cannot accidentally restart playback.
    const proxy = document.createElement("div");
    proxy.className = "collection-window-proxy";
    proxy.setAttribute("aria-hidden", "true");
    proxy.inert = true;
    Object.assign(proxy.style, pixels(from));
    panel.parentElement.append(proxy);
    record.proxy = proxy;
    record.effects.add(proxy);
    record.kind = "closing";
    if (hideLive) { panel.style.visibility = "hidden"; panel.inert = true; }
    const animation = animate(panel, proxy, [pixels(from), { ...pixels(to), opacity: 1, offset: .92 }, { ...pixels(to), opacity: 0 }], duration, () => {
      proxy.remove(); record.effects.delete(proxy); record.proxy = record.kind = null;
    });
    return animation.finished.catch(() => {});
  }

  function pauseClosedAudio(panel) {
    const content = contentFor(panel);
    if (!content?.dataset.mediaKey?.startsWith("soundcloud:")) return;
    content.dataset.soundcloudAutoplay = content.dataset.soundcloudPlaying = "false";
    content.querySelectorAll("iframe").forEach(frame => frame.contentWindow?.postMessage(JSON.stringify({ method: "pause" }), "https://w.soundcloud.com"));
    const control = content.querySelector(".collection-soundcloud-control");
    if (control) { control.textContent = "PLAY"; control.setAttribute("aria-label", "Play track"); }
  }

  function change(panel, update, source) {
    if (!panel || updating.has(panel)) return update();
    const record = recordFor(panel);
    const continuing = Boolean(record.proxy);
    const focused = panel.contains(document.activeElement);
    const before = { visible: visible(panel), hidden: panel.hidden, minimized: panel.classList.contains("is-minimized"), rect: record.proxy ? bounds(record.proxy) : bounds(panel) };
    if (record.kind === "geometry") cancel(panel);
    updating.add(panel);
    let result;
    try { result = update(); } finally { updating.delete(panel); }
    if (source) record.source = source;
    // A row request can reactivate a suspended transient window. Other updates
    // must not turn an old preview back on during navigation or the welcome.
    const requested = source && !panel.hidden && window.Collection?.isPageActive() !== false && visibility >= 1;
    if (requested) { record.suspended = null; panel.style.visibility = ""; panel.inert = false; }
    const after = { visible: visible(panel), hidden: panel.hidden, minimized: panel.classList.contains("is-minimized"), rect: bounds(panel) };
    const moved = Object.keys(after.rect).some(key => Math.abs(after.rect[key] - before.rect[key]) > .5);
    if (before.visible === after.visible && before.hidden === after.hidden && before.minimized === after.minimized && !moved) return result;
    cancel(panel);
    if (before.visible && after.hidden) {
      pauseClosedAudio(panel);
      if (!reduced.matches) closeVisual(panel, before.rect);
      if (focused) queueMicrotask(() => {
        if (!panel.hidden) return;
        const toggle = document.getElementById("collection-media-window-toggle");
        const fallback = document.querySelector(".collection-route-outlet:not([hidden]) h1") || document.querySelector("[data-collection-welcome]:not([hidden]) h1");
        const target = toggle && !toggle.hidden ? toggle : eligible(record.source) ? record.source : fallback;
        if (target) {
          if (!target.matches("a, button, input, [tabindex]")) target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      });
    } else if (after.visible) {
      clampWindow(panel);
      if (!reduced.matches && !before.visible) reveal(panel, continuing ? before.rect : undefined);
      else if (!reduced.matches && (moved || before.minimized !== after.minimized)) {
        record.kind = "geometry";
        animate(panel, panel, [pixels(before.rect), pixels(bounds(panel))], 280, () => { record.kind = null; });
      }
    }
    return result;
  }

  function scrub(panel, amount) {
    const record = recordFor(panel);
    if (!record.scrub) {
      cancel(panel);
      const to = bounds(panel);
      const from = originFor(panel, to);
      const animation = panel.animate([pixels(from), pixels(to)], { duration: 1000, fill: "both", easing: "linear" });
      animation.pause(); record.animations.add(animation);
      const opacity = children(panel).map(child => {
        const track = child.animate([{ opacity: 0 }, { opacity: 0, offset: .8 }, { opacity: 1 }], { duration: 1000, fill: "both", easing: "linear" });
        track.pause(); record.animations.add(track); return track;
      });
      record.scrub = [animation, ...opacity];
      record.suspended = "welcome";
    }
    for (const animation of record.scrub) animation.currentTime = amount * 1000;
    panel.style.visibility = amount <= 0 ? "hidden" : "";
    panel.inert = amount < .99;
  }

  function welcome(amount) {
    if (window.CollectionNavigation && !window.CollectionNavigation.isCollection()) return;
    const previous = visibility;
    visibility = Math.max(0, Math.min(1, amount));
    if (previous === visibility) return;
    for (const panel of records.keys()) {
      const record = recordFor(panel);
      if (panel.hidden || persistent(panel) || record.suspended === "route" || record.suspended === "source") continue;
      if (visibility < 1) {
        if (reduced.matches) { panel.style.visibility = "hidden"; panel.inert = true; record.suspended = "welcome"; }
        else scrub(panel, visibility);
      } else {
        cancel(panel);
        const restore = Boolean(record.source?.isConnected);
        record.suspended = restore ? null : "source";
        panel.style.visibility = restore ? "" : "hidden";
        panel.inert = !restore;
      }
    }
  }

  async function leavePage() {
    const tasks = [];
    for (const panel of records.keys()) {
      if (persistent(panel)) continue;
      const record = recordFor(panel);
      const from = bounds(panel);
      const wasVisible = visible(panel);
      cancel(panel); record.suspended = "route";
      if (wasVisible && !reduced.matches) tasks.push(closeVisual(panel, from, true));
      else { panel.style.visibility = "hidden"; panel.inert = true; }
    }
    const candidate = document.getElementById("collection-mobile-sound-candidate");
    if (candidate) candidate.hidden = true;
    await Promise.all(tasks);
  }

  function enterPage() {
    for (const panel of records.keys()) {
      const record = recordFor(panel);
      if (persistent(panel)) continue;
      cancel(panel);
      const restore = !panel.hidden && visibility >= 1 && Boolean(record.source?.isConnected);
      record.suspended = restore ? null : "source";
      panel.style.visibility = restore ? "" : "hidden";
      panel.inert = !restore;
      if (restore && !reduced.matches) reveal(panel);
    }
  }

  function loading(target) {
    target.dataset.mediaState = "loading";
    if (target.querySelector(".collection-media__status")) return;
    const status = document.createElement("p");
    status.className = "collection-media__status collection-window-loading";
    status.textContent = "LOADING…";
    target.append(status);
  }
  function ready(target, key) {
    if (target.dataset.mediaKey !== key) return;
    target.querySelectorAll(".collection-window-loading").forEach(node => node.remove());
    if (target.dataset.mediaState !== "unavailable") target.dataset.mediaState = "loaded";
  }
  window.CollectionWindowMotion = {
    change, loading, ready, topInset, welcome, leavePage, enterPage,
    takeControl: panel => { cancel(panel); clampWindow(panel); },
    startAudio: () => {
      const panel = document.getElementById("collection-media-window");
      panel.dataset.persistentAudio = "true";
      if (recordFor(panel).scrub) cancel(panel);
      recordFor(panel).suspended = null; panel.style.visibility = ""; panel.inert = false;
    },
    stopAudio: () => { document.getElementById("collection-media-window").dataset.persistentAudio = "false"; }
  };

  addEventListener("resize", () => {
    for (const panel of records.keys()) { cancel(panel); clampWindow(panel); }
  });
  addEventListener("pagehide", () => { for (const panel of records.keys()) cancel(panel); });
  reduced.addEventListener("change", () => {
    for (const panel of records.keys()) {
      cancel(panel);
      if (!persistent(panel) && visibility < 1) {
        recordFor(panel).suspended = "welcome";
        panel.style.visibility = "hidden";
        panel.inert = true;
      }
    }
  });
})();

(() => {
  "use strict";

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
  const floorSelector = "img.project-detail__ground-image, img.collection-outro__image";
  const boxOf = node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const intersection = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const width = Math.min(a.x + a.width, b.x + b.width) - x;
    const height = Math.min(a.y + a.height, b.y + b.height) - y;
    return width > 0 && height > 0 ? { x, y, width, height } : null;
  };
  const captureFloor = (page, visibleOnly = true) => {
    const image = page?.querySelector(floorSelector);
    // An unavailable grid never delays or disables the paper transition.
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return null;
    const rect = boxOf(image);
    let crop = intersection(rect, { x: 0, y: 0, width: innerWidth, height: innerHeight });
    if (visibleOnly && !crop) return null;
    let opacity = 1;
    for (let node = image; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility !== "visible" || style.display === "none") return null;
      opacity *= Number(style.opacity);
      if (crop && node !== image && /hidden|clip|scroll|auto/.test(style.overflowX + style.overflowY)) {
        const bounds = boxOf(node);
        const clipX = /hidden|clip|scroll|auto/.test(style.overflowX);
        const clipY = /hidden|clip|scroll|auto/.test(style.overflowY);
        crop = intersection(crop, {
          x: clipX ? bounds.x : crop.x, y: clipY ? bounds.y : crop.y,
          width: clipX ? bounds.width : crop.width, height: clipY ? bounds.height : crop.height
        });
        if (visibleOnly && !crop) return null;
      }
    }
    if (!opacity) return null;
    // Require genuinely visible pixels on departure. Once mounted, the moving
    // paper itself covers the grid rather than leaving a frozen cutout in it.
    const paper = page.querySelector(".collection-poster");
    const paperStyle = paper && getComputedStyle(paper);
    const covered = paperStyle?.opacity === "1" && paperStyle.backgroundColor === "rgb(255, 255, 255)"
      && crop ? intersection(crop, boxOf(paper)) : null;
    if (visibleOnly && covered && covered.width >= crop.width && covered.height >= crop.height) return null;
    const style = getComputedStyle(image);
    return { image, rect, opacity,
      blend: style.mixBlendMode, filter: style.filter, objectFit: style.objectFit };
  };
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
  const footerReveal = (progress, duration) => ease(clamp((progress * duration - (duration - 180)) / 180));
  const create = (page, kind, floorCapture = captureFloor(page)) => {
    const overlay = document.createElement("div");
    overlay.className = `collection-route collection-route--${kind}`;
    overlay.setAttribute("aria-hidden", "true");
    const sourceFrame = visibleFrame(page);
    let targetFrame = sourceFrame;
    let floor;
    let floorImage;
    let floorTarget;
    let arriving = false;
    const positionFloor = rect => Object.assign(floorImage.style, {
      left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`
    });
    const mountFloor = capture => {
      floor = document.createElement("div");
      floor.className = "collection-route__floor";
      const { image, rect, opacity, blend, filter, objectFit } = capture;
      const copy = image.cloneNode(false);
      copy.removeAttribute("id");
      copy.removeAttribute("srcset");
      copy.removeAttribute("sizes");
      copy.src = image.currentSrc || image.src;
      copy.className = "collection-route__floor-image";
      copy.alt = "";
      copy.loading = "eager";
      Object.assign(copy.style, { mixBlendMode: blend, filter, objectFit });
      floorImage = copy;
      positionFloor(rect);
      floor.style.opacity = opacity;
      floor.append(copy);
      overlay.prepend(floor);
    };
    if (floorCapture) mountFloor(floorCapture);
    const arrive = destination => {
      page = destination;
      arriving = true;
      targetFrame = visibleFrame(page);
      // Also measure offscreen destinations: the grid can move naturally below
      // a long page instead of remaining pinned to the viewport.
      floorTarget = captureFloor(page, false);
      if (!floor && floorTarget && captureFloor(page)) {
        mountFloor(floorTarget);
        floor.style.opacity = "0";
      }
    };
    const drawFloor = (progress, duration) => {
      if (!arriving || !floor || progress == null) return;
      const p = ease(clamp(progress));
      if (floorCapture && floorTarget) {
        positionFloor(mix(floorCapture.rect, floorTarget.rect, p));
        floor.style.opacity = floorCapture.opacity + (floorTarget.opacity - floorCapture.opacity) * p;
      } else {
        // Fade only when there is no counterpart, never between aligned grids.
        floor.style.opacity = floorCapture
          ? floorCapture.opacity * (1 - footerReveal(progress, duration))
          : floorTarget.opacity * footerReveal(progress, duration);
      }
    };
    const clipPaper = rect => {
      paper.style.clipPath = `inset(${rect.y}px ${Math.max(0, innerWidth - rect.x - rect.width)}px ${Math.max(0, innerHeight - rect.y - rect.height)}px ${rect.x}px)`;
    };
    const paper = document.createElement("div");
    paper.className = "collection-route__paper";
    const snapshot = document.createElement("div");
    snapshot.className = "collection-route__snapshot";
    paper.append(snapshot);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("collection-route__frame");
    svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("width", innerWidth);
    svg.setAttribute("height", innerHeight);
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
    overlay.append(paper, svg, type, dock);
    const capture = (sourcePage = page) => {
      const clone = sourcePage.cloneNode(true);
      clone.hidden = false;
      clone.inert = true;
      const pageBox = sourcePage.getBoundingClientRect();
      clone.style.top = `${pageBox.top}px`;
      clone.style.width = `${pageBox.width}px`;
      clone.style.minHeight = `${pageBox.height}px`;
      const sourceFrame = sourcePage.querySelector(".collection-welcome-frame");
      const sourceArtwork = sourcePage.querySelector(".collection-welcome-pin > .collection-intro__artwork");
      if (sourceArtwork) {
        // Freeze the native sticky position in the outgoing page snapshot.
        const pinnedOffset = sourceArtwork.getBoundingClientRect().top
          - sourceArtwork.parentElement.getBoundingClientRect().top;
        const clonedArtwork = clone.querySelector(".collection-intro__artwork");
        clonedArtwork.style.position = "relative";
        clonedArtwork.style.top = "0";
        clonedArtwork.style.transform = `translateY(${pinnedOffset}px)`;
      }
      if (sourceFrame) {
        // Freeze the welcome's continuous border at its source geometry.
        const frameBox = sourceFrame.getBoundingClientRect();
        const clonedFrame = clone.querySelector(".collection-welcome-frame");
        clonedFrame.style.width = `${frameBox.width}px`;
        clonedFrame.style.height = `${frameBox.height}px`;
      }
      clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
      clone.querySelectorAll("iframe, script, .collection-media-window, .collection-image-window, .collection-media-window-toggle, .collection-mobile-sound-candidate").forEach(node => node.remove());
      // Reserve the footer's normal layout without scaling a second grid with
      // the paper. One independent grid remains behind the moving sheet.
      clone.querySelectorAll(floorSelector).forEach(node => { node.style.visibility = "hidden"; });
      snapshot.replaceChildren(clone);
      const bookingPane = sourcePage.querySelector(".booking-content");
      if (bookingPane) clone.querySelector(".booking-content").scrollTop = bookingPane.scrollTop;
    };
    const drawFrames = (rect, square, echo) => rects.forEach((node, index) => {
      const box = index ? mix(rect, square, [0, 0.18, 0.42, 0.66, 0.84][index]) : rect;
      Object.entries({ x: box.x + 0.5, y: box.y + 0.5, width: Math.max(0, box.width - 1), height: Math.max(0, box.height - 1) }).forEach(([key, value]) => node.setAttribute(key, value));
      node.style.opacity = index ? echo : 1;
    });
    const draw = (rect, square, opacity, echo, typeOpacity, contraction = 1,
      focus = { x: innerWidth / 2, y: innerHeight / 2 }, arrivalProgress = null, duration = 460) => {
      drawFloor(arrivalProgress, duration);
      clipPaper(rect);
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
    const lift = (offset, square, typeOpacity, arrivalProgress = null) => {
      drawFloor(arrivalProgress, 520);
      const rect = arriving ? targetFrame : sourceFrame;
      clipPaper({ ...rect, y: rect.y + offset });
      snapshot.style.transform = `translateY(${offset}px)`;
      snapshot.style.opacity = 1;
      drawFrames(square, square, 0);
      type.style.left = `${Math.max(0, Math.min(innerWidth - square.width, square.x))}px`;
      type.style.top = `${Math.max(0, Math.min(innerHeight - 40, square.y))}px`;
      type.style.width = `${square.width}px`;
      type.style.opacity = typeOpacity;
    };
    const footer = (opacity, square, markerOpacity, arrivalProgress = null) => {
      drawFloor(arrivalProgress, 320);
      clipPaper(arriving ? targetFrame : sourceFrame);
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
    document.body.append(overlay);
    // Attach before restoring inner scroll: detached panes cannot scroll.
    try { capture(); }
    catch (error) { overlay.remove(); throw error; }
    const point = (rect, origin, contraction, opacity, labelOpacity, arrivalProgress = null) => {
      const dot = { x: origin.x - 3, y: origin.y - 3, width: 6, height: 6 };
      draw(rect, dot, opacity, 0, labelOpacity, contraction, origin, arrivalProgress, 600);
      type.style.left = `${Math.max(0, Math.min(innerWidth - 130, origin.x + 8))}px`;
      type.style.top = `${Math.max(0, Math.min(innerHeight - 40, origin.y + 8))}px`;
      type.style.width = "auto";
    };
    return { overlay, capture, arrive, draw, lift, footer, point };
  };

  const restorations = new WeakMap();
  // Reserve a saved document position while asynchronous content is loading.
  // User input takes ownership immediately, so late data cannot pull them back.
  const restoreScroll = (page, top) => {
    restorations.get(page)?.cancel();
    const previousMinHeight = page.style.minHeight;
    const url = location.href;
    let active = true;
    let finishing;
    const imageWaiters = new Set();
    const inputTypes = ["wheel", "touchstart", "pointerdown", "keydown"];
    const release = () => {
      if (!active) return;
      active = false;
      page.style.minHeight = previousMinHeight;
      imageWaiters.forEach(finish => finish());
      inputTypes.forEach(type => window.removeEventListener(type, onInput, true));
      if (restorations.get(page) === restoration) restorations.delete(page);
    };
    const onInput = event => {
      if (event.type !== "keydown" || ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Tab"].includes(event.key)) release();
    };
    const restoration = {
      cancel: release,
      finish: () => finishing ||= (async () => {
        // A font swap or event image can briefly shorten a fresh form. Reserve
        // the saved position until both have their final layout dimensions.
        const images = top > 0 ? [...page.querySelectorAll("img")].map(image => image.complete
          ? Promise.resolve() : new Promise(resolve => {
            const finish = () => {
              image.removeEventListener("load", finish);
              image.removeEventListener("error", finish);
              imageWaiters.delete(finish);
              resolve();
            };
            imageWaiters.add(finish);
            image.addEventListener("load", finish, { once: true });
            image.addEventListener("error", finish, { once: true });
          })) : [];
        const settled = (async () => {
          await Promise.all([document.fonts?.ready, ...images]);
          await new Promise(resolve => {
            const timeout = setTimeout(resolve, 100);
            requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timeout); resolve(); }));
          });
          if (!active) return false;
          const current = !page.hidden && location.href === url;
          release();
          if (current) window.scrollTo({ top, behavior: "instant" });
          return current;
        })();
        // A slow image keeps the reservation and reconciles later, but cannot
        // hold the paper transition indefinitely. Input still cancels the job.
        let timeout;
        const result = await Promise.race([settled, new Promise(resolve => { timeout = setTimeout(() => resolve(false), 1000); })]);
        clearTimeout(timeout);
        return result;
      })()
    };
    restorations.set(page, restoration);
    const pageTop = page.getBoundingClientRect().top + scrollY;
    if (top + innerHeight > pageTop + page.offsetHeight) page.style.minHeight = `${top + innerHeight - pageTop}px`;
    window.scrollTo({ top, behavior: "instant" });
    inputTypes.forEach(type => window.addEventListener(type, onInput, { capture: true, passive: true }));
    return restoration;
  };

  let scrollLocks = 0;
  const lockScroll = () => {
    scrollLocks++;
    document.body.classList.add("is-collection-navigating");
    let locked = true;
    return () => {
      if (!locked) return;
      locked = false;
      if (--scrollLocks === 0) document.body.classList.remove("is-collection-navigating");
    };
  };
  window.CollectionPageTransition = { create, visibleFrame, captureFloor, focalPoint, squareFrame, mix, ease, lockScroll,
    restoreScroll, isRestoring: page => restorations.has(page), cancelRestore: page => restorations.get(page)?.cancel() };
})();

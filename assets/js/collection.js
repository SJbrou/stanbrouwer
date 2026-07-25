(() => {
  "use strict";

  const sheetId = "1h6TLiP4S4xh8pAxipY2XtoyiWkhVxKHL5mQoL-S_HMc";
  const sheetEndpoint = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const soundcloudOembedEndpoint = "https://soundcloud.com/oembed?format=json&url=";
  const soundcloudWidgetApiUrl = "https://w.soundcloud.com/player/api.js";
  const truncationMark = String.fromCharCode(0x2026);
  const loadTimeoutMs = 10000;
  const desktopMediaQuery = window.matchMedia("(min-width: 48rem) and (hover: hover) and (pointer: fine)");
  const soundcloudEmbeds = new Map();
  let soundcloudWidgetApi;
  const rowMetadata = new WeakMap();
  const desktopSelectedRows = new Map();
  const desktopSoundHoverRows = new Map();
  let callbackCount = 0;
  let mobilePanel;
  let mobileContent;
  let mobileToggle;
  let mobileCandidate;
  let mobileCurrentRow = null;
  let mobileNowPlayingRow = null;
  let mobileCandidateRow = null;
  let mobileMinimised = false;
  let mobilePositionInitialised = false;
  let mobileSelectionPending = false;
  let collectionTruncationPending = false;
  let mobileDrag = null;

  const subsections = [
    { tab: "WORDS", targetId: "collection-words", mediaKind: "website" },
    { tab: "SOUNDS", targetId: "collection-sounds", mediaKind: "soundcloud" },
    { tab: "VISUALS", targetId: "collection-visuals", mediaKind: "image" },
    { tab: "PEOPLE", targetId: "collection-people", mediaKind: "image" },
    { tab: "PLACES", targetId: "collection-places", mediaKind: "image" },
    { tab: "PROJECTS", targetId: "collection-projects", mediaKind: "image" }
  ];

  const isDesktopMedia = () => desktopMediaQuery.matches;

  const visibleValue = (cell) => {
    if (!cell) {
      return "";
    }

    if (typeof cell.f === "string") {
      return cell.f;
    }

    return cell.v == null ? "" : String(cell.v);
  };

  const toHttpUrl = (value) => {
    if (typeof value !== "string") {
      return null;
    }

    try {
      const url = new URL(value.trim());
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch (error) {
      return null;
    }
  };

  const linkValue = (cell) => {
    if (!cell) {
      return null;
    }

    return toHttpUrl(typeof cell.v === "string" ? cell.v : visibleValue(cell));
  };

  const itemLabel = (values, fallback) => values.find((value, index) => index > 0 && value.trim() !== "")
    || values.find((value) => value.trim() !== "")
    || fallback;

  const mediaForRow = (subsection, links) => {
    const source = links[0];
    if (!source) {
      return { media: null, destination: null };
    }

    if (subsection.mediaKind === "website") {
      return {
        media: { kind: subsection.mediaKind, source },
        destination: source
      };
    }

    if (subsection.mediaKind === "soundcloud") {
      return {
        media: { kind: subsection.mediaKind, source },
        destination: null
      };
    }

    return {
      media: { kind: "image", source },
      destination: links[1] || null
    };
  };

  const normaliseRows = (response, subsection) => {
    if (!response || response.status !== "ok" || !response.table) {
      throw new Error("The sheet did not return a valid response.");
    }

    const rawRows = response.table.rows || [];
    const activeColumnIndexes = new Set();
    const urlColumnIndexes = new Set();

    rawRows.forEach((row) => {
      (row.c || []).forEach((cell, index) => {
        if (visibleValue(cell).trim() !== "") {
          activeColumnIndexes.add(index);
        }
        if (linkValue(cell)) {
          urlColumnIndexes.add(index);
        }
      });
    });

    const visibleColumnIndexes = Array.from(activeColumnIndexes)
      .filter((index) => !urlColumnIndexes.has(index))
      .sort((first, second) => first - second);
    const orderedUrlColumnIndexes = Array.from(urlColumnIndexes)
      .sort((first, second) => first - second);
    const gridWeights = visibleColumnIndexes.map((index) => rawRows.reduce((longest, row) => (
      Math.max(longest, visibleValue((row.c || [])[index]).trim().length)
    ), 0));
    const numericColumnMinimums = visibleColumnIndexes.map((index) => rawRows.reduce((longest, row) => {
      const value = visibleValue((row.c || [])[index]).trim();
      return /^\d/.test(value) ? Math.max(longest, value.length + 1) : longest;
    }, 0));
    const gridTemplate = gridWeights.length > 0
      ? gridWeights.map((weight, index) => (
        `minmax(${numericColumnMinimums[index] || 0}ch, ${Math.max(6, Math.min(weight, 32))}fr)`
      )).join(" ")
      : "minmax(0, 1fr)";
    const rows = rawRows
      .map((row) => {
        const cells = row.c || [];
        const values = visibleColumnIndexes.map((index) => visibleValue(cells[index]));
        const links = orderedUrlColumnIndexes.map((index) => linkValue(cells[index])).filter(Boolean);
        const routing = mediaForRow(subsection, links);

        return {
          values,
          ...routing,
          label: itemLabel(values, subsection.tab)
        };
      })
      .filter((row) => row.values.some((value) => value.trim() !== "") || row.media);

    return {
      rows,
      gridTemplate,
      nonTruncatableColumns: numericColumnMinimums.map((width) => width > 0)
    };
  };

  const clearMedia = (target) => {
    if (!target) {
      return;
    }

    target.replaceChildren();
    delete target.dataset.mediaKey;
    delete target.dataset.soundcloudAutoplay;
    delete target.dataset.soundcloudPlaying;
  };

  const renderUnavailableMedia = (target, key) => {
    if (!target || target.dataset.mediaKey !== key) {
      return;
    }

    target.replaceChildren();
    const message = document.createElement("p");
    message.className = "collection-media__status";
    message.textContent = "PREVIEW UNAVAILABLE";
    target.append(message);
  };

  const renderImageMedia = (target, source, label, key) => {
    const image = document.createElement("img");
    image.className = "collection-media__image";
    image.src = source;
    image.alt = `Preview for ${label}`;
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => renderUnavailableMedia(target, key), { once: true });
    target.replaceChildren(image);
  };

  const fallbackSoundcloudPlayerUrl = (source) => {
    const playerUrl = new URL("https://w.soundcloud.com/player/");
    playerUrl.searchParams.set("url", source);
    playerUrl.searchParams.set("auto_play", "false");
    playerUrl.searchParams.set("visual", "false");
    playerUrl.searchParams.set("show_user", "false");
    playerUrl.searchParams.set("show_reposts", "false");
    playerUrl.searchParams.set("show_comments", "false");
    playerUrl.searchParams.set("show_teaser", "false");
    playerUrl.searchParams.set("show_playcount", "false");
    playerUrl.searchParams.set("buying", "false");
    playerUrl.searchParams.set("sharing", "false");
    playerUrl.searchParams.set("download", "false");
    playerUrl.searchParams.set("hide_related", "true");
    playerUrl.searchParams.set("color", "#000000");
    return playerUrl.href;
  };

  const soundcloudEmbed = (source) => {
    if (!soundcloudEmbeds.has(source)) {
      const request = fetch(`${soundcloudOembedEndpoint}${encodeURIComponent(source)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("SoundCloud player request failed.");
          }

          return response.json();
        })
        .then((response) => {
          const embeddedSource = typeof response.html === "string"
            ? response.html.match(/\bsrc=(?:"|')([^"']+)(?:"|')/i)?.[1].replace(/&amp;/g, "&")
            : null;
          const playerUrl = toHttpUrl(embeddedSource);
          if (!playerUrl) {
            return {
              playerUrl: fallbackSoundcloudPlayerUrl(source),
              artworkUrl: toHttpUrl(response.thumbnail_url),
              trackName: typeof response.title === "string" ? response.title : "",
              artist: typeof response.author_name === "string" ? response.author_name : ""
            };
          }

          const url = new URL(playerUrl);
          url.searchParams.set("auto_play", "false");
          url.searchParams.set("visual", "false");
          url.searchParams.set("show_user", "false");
          url.searchParams.set("show_reposts", "false");
          url.searchParams.set("show_comments", "false");
          url.searchParams.set("show_teaser", "false");
          url.searchParams.set("show_playcount", "false");
          url.searchParams.set("buying", "false");
          url.searchParams.set("sharing", "false");
          url.searchParams.set("download", "false");
          url.searchParams.set("hide_related", "true");
          url.searchParams.set("color", "#000000");
          return {
            playerUrl: url.href,
            artworkUrl: toHttpUrl(response.thumbnail_url),
            trackName: typeof response.title === "string" ? response.title : "",
            artist: typeof response.author_name === "string" ? response.author_name : ""
          };
        })
        .catch(() => ({
          playerUrl: fallbackSoundcloudPlayerUrl(source),
          artworkUrl: null,
          trackName: "",
          artist: ""
        }));

      soundcloudEmbeds.set(source, request);
    }

    return soundcloudEmbeds.get(source);
  };

  const loadSoundcloudWidgetApi = () => {
    if (window.SC?.Widget) {
      return Promise.resolve(window.SC);
    }

    if (!soundcloudWidgetApi) {
      soundcloudWidgetApi = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.async = true;
        script.src = soundcloudWidgetApiUrl;
        script.addEventListener("load", () => {
          if (window.SC?.Widget) {
            resolve(window.SC);
          } else {
            reject(new Error("SoundCloud Widget API did not initialise."));
          }
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("Unable to load the SoundCloud Widget API.")), { once: true });
        document.head.append(script);
      });
    }

    return soundcloudWidgetApi;
  };

  const playSoundcloudFrame = (frame) => {
    frame.contentWindow?.postMessage(JSON.stringify({ method: "play" }), "https://w.soundcloud.com");
  };

  const pauseSoundcloudFrame = (frame) => {
    frame.contentWindow?.postMessage(JSON.stringify({ method: "pause" }), "https://w.soundcloud.com");
  };

  const setSoundcloudControlState = (target, isPlaying) => {
    target.dataset.soundcloudPlaying = isPlaying ? "true" : "false";
    const control = target.querySelector(".collection-soundcloud-control");
    if (!control) {
      return;
    }

    control.textContent = isPlaying ? "PAUSE" : "PLAY";
    control.setAttribute("aria-label", isPlaying ? "Pause track" : "Play track");
  };

  const renderSoundcloudPlayer = (
    target,
    source,
    row,
    key,
    autoPlay,
    trackName = "",
    artist = "",
    artworkUrl = null
  ) => {
    const frame = document.createElement("iframe");
    const waveform = document.createElement("div");
    const control = document.createElement("button");
    const metadata = document.createElement("div");
    const ticker = document.createElement("div");
    frame.className = "collection-media__frame collection-media__frame--soundcloud";
    waveform.className = "collection-soundcloud-waveform";
    const playerUrl = new URL(source);
    playerUrl.searchParams.set("auto_play", autoPlay ? "true" : "false");
    frame.src = playerUrl.href;
    frame.title = `SoundCloud player for ${row.label}`;
    frame.loading = "lazy";
    frame.setAttribute("allow", "autoplay; encrypted-media");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("frameborder", "no");
    frame.addEventListener("load", () => {
      const shouldPlay = target.dataset.soundcloudAutoplay === "true"
        || target.dataset.soundcloudPlaying === "true";
      setSoundcloudControlState(target, shouldPlay);
      if (shouldPlay) {
        playSoundcloudFrame(frame);
      }
    }, { once: true });
    frame.addEventListener("error", () => renderUnavailableMedia(target, key), { once: true });
    control.className = "collection-soundcloud-control";
    control.type = "button";
    control.textContent = "PLAY";
    control.setAttribute("aria-label", "Play track");
    control.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isPlaying = target.dataset.soundcloudPlaying === "true";
      if (isPlaying) {
        pauseSoundcloudFrame(frame);
      } else {
        playSoundcloudFrame(frame);
      }

      setSoundcloudControlState(target, !isPlaying);
    });
    metadata.className = "collection-soundcloud-meta";
    const songLabel = [trackName || row.label, artist].filter(Boolean).join(" - ") || row.label;
    metadata.setAttribute("aria-label", songLabel);
    ticker.className = "collection-soundcloud-meta__ticker";
    [songLabel, songLabel].forEach((text, index) => {
      const copy = document.createElement("span");
      copy.textContent = text;
      if (index > 0) {
        copy.setAttribute("aria-hidden", "true");
      }
      ticker.append(copy);
    });
    metadata.append(ticker);
    waveform.append(frame);
    if (artworkUrl) {
      const artwork = document.createElement("img");
      artwork.className = "collection-soundcloud-artwork";
      artwork.src = artworkUrl;
      artwork.alt = `Artwork for ${songLabel}`;
      artwork.loading = "lazy";
      artwork.decoding = "async";
      artwork.referrerPolicy = "no-referrer";
      artwork.addEventListener("error", () => artwork.remove(), { once: true });
      target.replaceChildren(artwork, waveform, metadata, control);
    } else {
      target.replaceChildren(waveform, metadata, control);
    }

    loadSoundcloudWidgetApi()
      .then((soundcloud) => {
        if (!frame.isConnected || target.dataset.mediaKey !== key) {
          return;
        }

        const widget = soundcloud.Widget(frame);
        widget.bind(soundcloud.Widget.Events.PLAY, () => setSoundcloudControlState(target, true));
        widget.bind(soundcloud.Widget.Events.PAUSE, () => setSoundcloudControlState(target, false));
        widget.bind(soundcloud.Widget.Events.FINISH, () => {
          if (target.dataset.mediaKey === key) {
            advanceSoundcloudRow(row);
          }
        });
      })
      .catch(() => {});
  };

  const renderSoundcloudArtwork = (target, row) => {
    if (!target || row.media?.kind !== "soundcloud") {
      clearMedia(target);
      return;
    }

    const key = `soundcloud-artwork:${row.media.source}`;
    target.dataset.mediaKey = key;
    const message = document.createElement("p");
    message.className = "collection-media__status";
    message.textContent = "LOADING…";
    target.replaceChildren(message);

    soundcloudEmbed(row.media.source)
      .then(({ artworkUrl }) => {
        if (target.dataset.mediaKey !== key) {
          return;
        }

        if (artworkUrl) {
          renderImageMedia(target, artworkUrl, row.label, key);
        } else {
          renderUnavailableMedia(target, key);
        }
      })
      .catch(() => renderUnavailableMedia(target, key));
  };

  const renderMedia = (target, row, options = {}) => {
    if (!target || !row.media) {
      clearMedia(target);
      return;
    }

    const { kind, source } = row.media;
    const key = `${kind}:${source}`;
    target.dataset.mediaKey = key;
    if (kind === "soundcloud") {
      target.dataset.soundcloudAutoplay = options.autoPlay ? "true" : "false";
      target.dataset.soundcloudPlaying = "false";
    } else {
      delete target.dataset.soundcloudAutoplay;
    }

    if (kind === "image") {
      renderImageMedia(target, source, row.label, key);
      return;
    }

    if (kind === "website") {
      const frame = document.createElement("iframe");
      frame.className = "collection-media__frame";
      frame.src = source;
      frame.title = `Website preview for ${row.label}`;
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer";
      frame.tabIndex = -1;
      frame.setAttribute("sandbox", "allow-scripts allow-forms allow-popups");
      frame.addEventListener("error", () => renderUnavailableMedia(target, key), { once: true });
      target.replaceChildren(frame);
      return;
    }

    const message = document.createElement("p");
    message.className = "collection-media__status";
    message.textContent = "LOADING…";
    target.replaceChildren(message);
    soundcloudEmbed(source)
      .then(({ playerUrl, trackName, artist, artworkUrl }) => {
        if (target.dataset.mediaKey === key) {
          renderSoundcloudPlayer(
            target,
            playerUrl,
            row,
            key,
            target.dataset.soundcloudAutoplay === "true",
            trackName,
            artist,
            artworkUrl
          );
        }
      })
      .catch(() => renderUnavailableMedia(target, key));
  };

  const requestSoundcloudPlayback = (target, row) => {
    if (!target || !row.media || row.media.kind !== "soundcloud") {
      return;
    }

    const key = `${row.media.kind}:${row.media.source}`;
    if (target.dataset.mediaKey !== key) {
      renderMedia(target, row, { autoPlay: true });
      return;
    }

    target.dataset.soundcloudAutoplay = "true";
    const frame = target.querySelector(".collection-media__frame--soundcloud");
    if (frame) {
      playSoundcloudFrame(frame);
      setSoundcloudControlState(target, true);
    }
  };

  const clearDesktopPreview = (subsectionElement) => {
    const selectedRow = desktopSelectedRows.get(subsectionElement);
    if (selectedRow) {
      selectedRow.classList.remove("is-active");
      desktopSelectedRows.delete(subsectionElement);
    }

    const slot = subsectionElement.querySelector("[data-collection-media-slot]");
    if (slot) {
      clearMedia(slot);
      slot.hidden = true;
    }

    const hoverPreview = subsectionElement.querySelector("[data-collection-sound-hover-preview]");
    if (hoverPreview) {
      hoverPreview.classList.remove("is-visible", "is-bottom-anchored");
      clearMedia(hoverPreview);
      hoverPreview.hidden = true;
      hoverPreview.style.removeProperty("top");
    }
    desktopSoundHoverRows.delete(subsectionElement);
  };

  const showDesktopPreview = (entry, subsectionElement, row, isActive = false) => {
    if (!row.media) {
      return;
    }

    const selectedRow = desktopSelectedRows.get(subsectionElement);
    if (selectedRow && selectedRow !== entry) {
      selectedRow.classList.remove("is-active");
    }

    desktopSelectedRows.set(subsectionElement, entry);
    entry.classList.toggle("is-active", isActive);

    const slot = subsectionElement.querySelector("[data-collection-media-slot]");
    if (!slot) {
      return;
    }

    slot.hidden = false;
    renderMedia(slot, row);
  };

  const initialiseDesktopPreview = (subsectionElement) => {
    if (!isDesktopMedia()) {
      return;
    }

    const selectedRow = desktopSelectedRows.get(subsectionElement);
    const selectedMetadata = selectedRow && selectedRow.isConnected ? rowMetadata.get(selectedRow) : null;
    if (selectedMetadata?.media) {
      showDesktopPreview(selectedRow, subsectionElement, selectedMetadata, selectedRow.classList.contains("is-active"));
      return;
    }

    const firstMediaRow = Array.from(subsectionElement.querySelectorAll(".collection-row"))
      .find((entry) => rowMetadata.get(entry)?.media);
    if (firstMediaRow) {
      showDesktopPreview(firstMediaRow, subsectionElement, rowMetadata.get(firstMediaRow));
      return;
    }

    clearDesktopPreview(subsectionElement);
  };

  const positionSoundHoverPreview = (entry, subsectionElement) => {
    const preview = subsectionElement.querySelector("[data-collection-sound-hover-preview]");
    if (!preview) {
      return;
    }

    const subsectionRect = subsectionElement.getBoundingClientRect();
    const entryRect = entry.getBoundingClientRect();
    const rows = Array.from(subsectionElement.querySelectorAll(".collection-row"));
    const lastRow = rows[rows.length - 1];
    const lastRowRect = lastRow?.getBoundingClientRect();
    const previewHeight = preview.getBoundingClientRect().height;
    const rowAlignedTop = Math.max(0, entryRect.top - subsectionRect.top);
    const lastRowBottom = lastRowRect ? lastRowRect.bottom - subsectionRect.top : null;
    const bottomAnchoredTop = lastRowBottom == null || previewHeight === 0
      ? rowAlignedTop
      : Math.max(0, lastRowBottom - previewHeight);
    const isBottomAnchored = lastRowBottom != null
      && previewHeight > 0
      && rowAlignedTop + previewHeight > lastRowBottom;

    preview.classList.toggle("is-bottom-anchored", isBottomAnchored);
    preview.style.top = `${isBottomAnchored ? bottomAnchoredTop : rowAlignedTop}px`;
  };

  const showSoundHoverPreview = (entry, subsectionElement, row) => {
    const preview = subsectionElement.querySelector("[data-collection-sound-hover-preview]");
    if (!preview || !row.media) {
      return;
    }

    if (desktopSoundHoverRows.get(subsectionElement) !== entry) {
      preview.classList.remove("is-visible");
    }
    desktopSoundHoverRows.set(subsectionElement, entry);
    preview.hidden = false;
    positionSoundHoverPreview(entry, subsectionElement);
    window.requestAnimationFrame(() => {
      if (desktopSoundHoverRows.get(subsectionElement) === entry) {
        preview.classList.add("is-visible");
      }
    });
    renderSoundcloudArtwork(preview, row);
  };

  const clearSoundHoverPreview = (entry, subsectionElement) => {
    const currentEntry = desktopSoundHoverRows.get(subsectionElement);
    if (currentEntry && currentEntry !== entry) {
      return;
    }

    desktopSoundHoverRows.delete(subsectionElement);
    const preview = subsectionElement.querySelector("[data-collection-sound-hover-preview]");
    if (preview) {
      preview.classList.remove("is-visible", "is-bottom-anchored");
      clearMedia(preview);
      preview.hidden = true;
      preview.style.removeProperty("top");
    }
  };

  const updateSoundHoverPreviewPositions = () => {
    if (!isDesktopMedia()) {
      return;
    }

    desktopSoundHoverRows.forEach((entry, subsectionElement) => {
      if (entry.isConnected && subsectionElement.isConnected) {
        positionSoundHoverPreview(entry, subsectionElement);
      }
    });
  };

  const activateDesktopPreview = (entry, subsectionElement, row) => {
    if (!isDesktopMedia()) {
      return;
    }

    if (!row.media) {
      entry.classList.add("is-active");
      return;
    }

    if (row.media.kind === "soundcloud") {
      entry.classList.add("is-active");
      showSoundHoverPreview(entry, subsectionElement, row);
      return;
    }

    showDesktopPreview(entry, subsectionElement, row, true);
  };

  const resetMobilePosition = () => {
    if (!mobilePanel) {
      return;
    }

    mobilePanel.style.left = "auto";
    mobilePanel.style.right = "0.75rem";
    mobilePanel.style.bottom = "0.75rem";
    mobilePanel.style.top = "auto";
    mobilePositionInitialised = true;
  };

  const hideMobilePreview = () => {
    if (mobilePanel) {
      mobilePanel.hidden = true;
    }

    if (mobileToggle) {
      mobileToggle.hidden = true;
      mobileToggle.setAttribute("aria-expanded", "false");
    }

    if (mobileCandidate) {
      mobileCandidate.hidden = true;
      mobileCandidateRow = null;
      clearMedia(mobileCandidate);
    }
  };

  const mobilePreviewRow = () => {
    const nowPlaying = mobileNowPlayingRow && rowMetadata.get(mobileNowPlayingRow);
    return nowPlaying?.media?.kind === "soundcloud" ? mobileNowPlayingRow : mobileCurrentRow;
  };

  const updateMobileSoundCandidate = () => {
    if (!mobileCandidate) {
      return;
    }

    const currentRow = mobileCurrentRow && rowMetadata.get(mobileCurrentRow);
    const nowPlaying = mobileNowPlayingRow && rowMetadata.get(mobileNowPlayingRow);
    const shouldShow = currentRow?.media?.kind === "soundcloud"
      && nowPlaying?.media?.kind === "soundcloud"
      && mobileCurrentRow !== mobileNowPlayingRow;

    if (!shouldShow) {
      mobileCandidate.hidden = true;
      mobileCandidateRow = null;
      clearMedia(mobileCandidate);
      return;
    }

    mobileCandidateRow = mobileCurrentRow;
    mobileCandidate.hidden = false;
    mobileCandidate.setAttribute("aria-label", `Play ${currentRow.label}`);
    renderSoundcloudArtwork(mobileCandidate, currentRow);
  };

  const presentMobilePreview = () => {
    const previewRow = mobilePreviewRow();
    const preview = previewRow && rowMetadata.get(previewRow);
    if (!previewRow || !mobileContent || !mobilePanel || !mobileToggle || !preview?.media) {
      hideMobilePreview();
      return;
    }

    if (mobileMinimised) {
      mobilePanel.hidden = true;
      mobileToggle.hidden = false;
      mobileToggle.setAttribute("aria-expanded", "false");
      return;
    }

    if (!mobilePositionInitialised) {
      resetMobilePosition();
    }

    mobilePanel.hidden = false;
    mobileToggle.hidden = true;
    mobileToggle.setAttribute("aria-expanded", "true");
    const key = `${preview.media.kind}:${preview.media.source}`;
    if (mobileContent.dataset.mediaKey !== key || !mobileContent.firstElementChild) {
      renderMedia(mobileContent, preview);
    }
  };

  const setMobileActiveRow = (entry) => {
    if (mobileCurrentRow === entry) {
      return;
    }

    if (mobileCurrentRow) {
      mobileCurrentRow.classList.remove("is-active");
    }

    mobileCurrentRow = entry;
    if (mobileCurrentRow) {
      mobileCurrentRow.classList.add("is-active");
    }

    updateMobileSoundCandidate();
    presentMobilePreview();
  };

  const selectMobileMiddleRow = () => {
    if (isDesktopMedia()) {
      return;
    }

    const viewportMiddle = window.innerHeight / 2;
    let closestRow = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    document.querySelectorAll(".collection-row").forEach((entry) => {
      const rect = entry.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        return;
      }

      const distance = Math.abs(((rect.top + rect.bottom) / 2) - viewportMiddle);
      if (distance < closestDistance) {
        closestRow = entry;
        closestDistance = distance;
      }
    });

    setMobileActiveRow(closestRow);
  };

  const scheduleMobileSelection = () => {
    if (isDesktopMedia() || mobileSelectionPending) {
      return;
    }

    mobileSelectionPending = true;
    window.requestAnimationFrame(() => {
      mobileSelectionPending = false;
      selectMobileMiddleRow();
    });
  };

  const setMediaMode = () => {
    document.querySelectorAll(".collection-row.is-active").forEach((entry) => entry.classList.remove("is-active"));

    if (isDesktopMedia()) {
      if (mobileCurrentRow) {
        mobileCurrentRow.classList.remove("is-active");
      }

      mobileCurrentRow = null;
      hideMobilePreview();
      document.querySelectorAll(".collection-subsection").forEach(initialiseDesktopPreview);
      return;
    }

    document.querySelectorAll("[data-collection-sound-hover-preview]").forEach((preview) => {
      preview.classList.remove("is-visible", "is-bottom-anchored");
      clearMedia(preview);
      preview.hidden = true;
      preview.style.removeProperty("top");
    });
    desktopSoundHoverRows.clear();

    scheduleMobileSelection();
  };

  const playSoundcloudRow = (entry, subsectionElement, row) => {
    if (row.media?.kind !== "soundcloud") {
      return;
    }

    if (isDesktopMedia()) {
      showDesktopPreview(entry, subsectionElement, row, true);
      requestSoundcloudPlayback(subsectionElement.querySelector("[data-collection-media-slot]"), row);
      return;
    }

    mobileNowPlayingRow = entry;
    mobileMinimised = false;
    setMobileActiveRow(entry);
    updateMobileSoundCandidate();
    presentMobilePreview();
    requestSoundcloudPlayback(mobileContent, row);
  };

  const advanceSoundcloudRow = (finishedRow) => {
    const subsectionElement = document.querySelector(".collection-subsection--sounds");
    if (!subsectionElement) {
      return;
    }

    const entries = Array.from(subsectionElement.querySelectorAll(".collection-row"))
      .filter((entry) => rowMetadata.get(entry)?.media?.kind === "soundcloud");
    if (entries.length === 0) {
      return;
    }

    const currentIndex = entries.findIndex((entry) => rowMetadata.get(entry) === finishedRow);
    const nextEntry = entries[(currentIndex + 1 + entries.length) % entries.length];
    const nextRow = rowMetadata.get(nextEntry);
    if (nextRow) {
      playSoundcloudRow(nextEntry, subsectionElement, nextRow);
    }
  };

  const bindRowInteractions = (entry, subsectionElement, row) => {
    const isPersistedSoundSelection = () => row.media?.kind === "soundcloud"
      && desktopSelectedRows.get(subsectionElement) === entry;

    entry.addEventListener("mouseenter", () => activateDesktopPreview(entry, subsectionElement, row));
    entry.addEventListener("focus", () => activateDesktopPreview(entry, subsectionElement, row));
    entry.addEventListener("mouseleave", () => {
      if (isDesktopMedia() && document.activeElement !== entry) {
        if (!isPersistedSoundSelection()) {
          entry.classList.remove("is-active");
        }
        if (row.media?.kind === "soundcloud") {
          clearSoundHoverPreview(entry, subsectionElement);
        }
      }
    });
    entry.addEventListener("blur", () => {
      if (isDesktopMedia() && !entry.matches(":hover")) {
        if (!isPersistedSoundSelection()) {
          entry.classList.remove("is-active");
        }
        if (row.media?.kind === "soundcloud") {
          clearSoundHoverPreview(entry, subsectionElement);
        }
      }
    });
    if (row.media?.kind === "soundcloud") {
      entry.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        playSoundcloudRow(entry, subsectionElement, row);
      });
      entry.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          playSoundcloudRow(entry, subsectionElement, row);
        }
      });
    }
  };

  const truncateCell = (cell) => {
    const fullValue = cell.dataset.fullValue || "";
    cell.textContent = fullValue;
    cell.removeAttribute("title");
    cell.classList.remove("is-truncated");

    if (cell.dataset.noTruncate === "true" || fullValue.trim() === "" || cell.scrollWidth <= cell.clientWidth + 1) {
      return;
    }

    const words = fullValue.trim().split(/\s+/).filter(Boolean);
    let visibleText = "";
    for (const word of words) {
      const candidate = visibleText ? `${visibleText} ${word}` : word;
      cell.textContent = `${candidate}${truncationMark}`;
      if (cell.scrollWidth > cell.clientWidth + 1) {
        break;
      }
      visibleText = candidate;
    }

    if (!visibleText) {
      let lower = 0;
      let upper = fullValue.length;
      while (lower < upper) {
        const middle = Math.ceil((lower + upper) / 2);
        const candidate = `${fullValue.slice(0, middle).trimEnd()}${truncationMark}`;
        cell.textContent = candidate;
        if (cell.scrollWidth <= cell.clientWidth + 1) {
          lower = middle;
        } else {
          upper = middle - 1;
        }
      }
      visibleText = fullValue.slice(0, lower).trimEnd();
    }

    cell.textContent = visibleText ? `${visibleText}${truncationMark}` : truncationMark;
    cell.title = fullValue;
    cell.classList.add("is-truncated");
  };

  const truncateCollectionCells = (scope = document) => {
    scope.querySelectorAll?.(".collection-cell").forEach(truncateCell);
  };

  const scheduleCollectionTruncation = () => {
    if (collectionTruncationPending) {
      return;
    }

    collectionTruncationPending = true;
    window.requestAnimationFrame(() => {
      collectionTruncationPending = false;
      truncateCollectionCells();
    });
  };

  const renderRows = (target, collection, subsection) => {
    target.replaceChildren();
    const subsectionElement = target.closest(".collection-subsection");
    const fragment = document.createDocumentFragment();
    const { rows, gridTemplate, nonTruncatableColumns } = collection;

    rows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "collection-row-item";
      item.setAttribute("role", "listitem");

      const entry = document.createElement(row.destination ? "a" : "div");
      entry.className = "collection-row";
      if (row.destination) {
        entry.href = row.destination;
      } else {
        entry.tabIndex = 0;
        if (row.media?.kind === "soundcloud") {
          entry.setAttribute("role", "button");
          entry.setAttribute("aria-label", `Play ${row.label} on SoundCloud`);
        } else {
          entry.setAttribute("aria-label", `Preview: ${row.label}`);
        }
      }

      const columns = document.createElement("div");
      columns.className = "collection-row__columns";
      columns.style.setProperty("--collection-grid-template", gridTemplate);
      row.values.forEach((value, index) => {
        const cell = document.createElement("span");
        cell.className = "collection-cell";
        cell.textContent = value;
        cell.dataset.fullValue = value;
        if (nonTruncatableColumns[index]) {
          cell.dataset.noTruncate = "true";
          cell.classList.add("collection-cell--numeric");
        }
        columns.append(cell);
      });

      entry.append(columns);
      rowMetadata.set(entry, row);
      bindRowInteractions(entry, subsectionElement, row);
      item.append(entry);
      fragment.append(item);
    });

    target.append(fragment);
    target.setAttribute("aria-busy", "false");
    scheduleCollectionTruncation();
    initialiseDesktopPreview(subsectionElement);
    scheduleMobileSelection();
  };

  const renderError = (target) => {
    target.replaceChildren();
    const message = document.createElement("p");
    message.className = "collection-load-error";
    message.textContent = "CONTENT UNAVAILABLE";
    target.append(message);
    target.setAttribute("aria-busy", "false");
    const subsectionElement = target.closest(".collection-subsection");
    if (subsectionElement) {
      clearDesktopPreview(subsectionElement);
    }
    scheduleMobileSelection();
  };

  const loadTab = (subsection) => new Promise((resolve, reject) => {
    callbackCount += 1;
    const callbackName = `collectionSheetCallback${callbackCount}`;
    const script = document.createElement("script");
    let settled = false;

    const finish = (handler, value) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      handler(value);
    };

    const timeout = window.setTimeout(() => {
      finish(reject, new Error(`Timed out while loading ${subsection.tab}.`));
    }, loadTimeoutMs);

    window[callbackName] = (response) => {
      try {
        finish(resolve, normaliseRows(response, subsection));
      } catch (error) {
        finish(reject, error);
      }
    };

    script.async = true;
    script.src = `${sheetEndpoint}?sheet=${encodeURIComponent(subsection.tab)}&tqx=${encodeURIComponent(`out:json;responseHandler:${callbackName}`)}`;
    script.onerror = () => finish(reject, new Error(`Unable to load ${subsection.tab}.`));
    document.head.append(script);
  });

  const hydrateSubsection = async (subsection) => {
    const target = document.getElementById(subsection.targetId);
    if (!target) {
      return;
    }

    try {
      renderRows(target, await loadTab(subsection), subsection);
    } catch (error) {
      console.warn("Collection sheet load failed:", subsection.tab, error);
      renderError(target);
    }
  };

  const setMobileDragPosition = (event) => {
    if (!mobileDrag || event.pointerId !== mobileDrag.pointerId || !mobilePanel) {
      return;
    }

    const rect = mobilePanel.getBoundingClientRect();
    const padding = 8;
    const maxLeft = Math.max(padding, window.innerWidth - rect.width - padding);
    const maxTop = Math.max(padding, window.innerHeight - rect.height - padding);
    const left = Math.min(Math.max(padding, event.clientX - mobileDrag.offsetX), maxLeft);
    const top = Math.min(Math.max(padding, event.clientY - mobileDrag.offsetY), maxTop);

    mobilePanel.style.left = `${left}px`;
    mobilePanel.style.right = "auto";
    mobilePanel.style.top = `${top}px`;
    mobilePanel.style.bottom = "auto";
    mobilePositionInitialised = true;
  };

  const stopMobileDrag = (event) => {
    if (!mobileDrag || event.pointerId !== mobileDrag.pointerId || !mobilePanel) {
      return;
    }

    if (mobilePanel.hasPointerCapture?.(event.pointerId)) {
      mobilePanel.releasePointerCapture(event.pointerId);
    }

    mobileDrag = null;
    mobilePanel.classList.remove("is-dragging");
  };

  const setupMobileControls = () => {
    mobilePanel = document.getElementById("collection-mobile-media");
    mobileContent = mobilePanel?.querySelector(".collection-mobile-media__content");
    mobileToggle = document.getElementById("collection-mobile-media-toggle");
    mobileCandidate = document.getElementById("collection-mobile-sound-candidate");
    const closeButton = mobilePanel?.querySelector(".collection-mobile-media__close");

    closeButton?.addEventListener("click", () => {
      mobileMinimised = true;
      presentMobilePreview();
    });

    mobileToggle?.addEventListener("click", () => {
      mobileMinimised = false;
      presentMobilePreview();
    });

    mobileCandidate?.addEventListener("click", () => {
      if (!mobileCandidateRow) {
        return;
      }

      const row = rowMetadata.get(mobileCandidateRow);
      const subsectionElement = mobileCandidateRow.closest(".collection-subsection");
      if (row && subsectionElement) {
        playSoundcloudRow(mobileCandidateRow, subsectionElement, row);
      }
    });

    mobilePanel?.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) {
        return;
      }

      const rect = mobilePanel.getBoundingClientRect();
      mobileDrag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      mobilePanel.setPointerCapture?.(event.pointerId);
      mobilePanel.classList.add("is-dragging");
      event.preventDefault();
    });

    mobilePanel?.addEventListener("pointermove", setMobileDragPosition);
    mobilePanel?.addEventListener("pointerup", stopMobileDrag);
    mobilePanel?.addEventListener("pointercancel", stopMobileDrag);
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupMobileControls();
    subsections.forEach(hydrateSubsection);
    window.addEventListener("scroll", scheduleMobileSelection, { passive: true });
    window.addEventListener("resize", () => {
      scheduleMobileSelection();
      updateSoundHoverPreviewPositions();
      scheduleCollectionTruncation();
    });

    document.fonts?.ready?.then(scheduleCollectionTruncation);

    if (desktopMediaQuery.addEventListener) {
      desktopMediaQuery.addEventListener("change", setMediaMode);
    } else {
      desktopMediaQuery.addListener(setMediaMode);
    }

    setMediaMode();
  });
})();

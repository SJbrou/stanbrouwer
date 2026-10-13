(() => {
  'use strict';
  // Reuse the public collection's window chrome with bounds suited to a phone.
  window.MobilePreviewWindow = {
    create(panel) {
      panel.classList.add('mobile-preview-window', 'is-pinned');
      panel.removeAttribute('aria-live');
      document.body.append(panel);
      const chrome = panel.querySelector('.collection-image-window__chrome');
      const title = panel.querySelector('.collection-image-window__title');
      const close = panel.querySelector('.collection-image-window__close');
      const resize = panel.querySelector('.collection-window__resize');
      const content = panel.querySelector('.collection-image-window__content');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'mobile-preview-window__image';
      const image = document.createElement('img'); image.decoding = 'async';
      const message = document.createElement('span'); message.textContent = 'Image unavailable'; message.hidden = true;
      button.append(image, message); content.replaceChildren(button);
      chrome.tabIndex = 0; chrome.setAttribute('aria-label', 'Move preview window with arrow keys');
      close.setAttribute('aria-label', 'Hide preview window');
      resize.setAttribute('aria-label', 'Resize preview window with arrow keys');
      let active, source, position, gesture, imageFailed = false;
      const limits = () => {
        const dock = document.querySelector('.mobile-bottom-dock');
        const dockHeight = dock?.querySelector(':scope > :not([hidden])') ? dock.getBoundingClientRect().height : 0;
        const top = document.querySelector('.mobile-chapter-nav:not([hidden])')?.getBoundingClientRect().bottom || 12;
        return { top: top + 12, bottom: Math.max(top + 100, innerHeight - dockHeight - 12), width: innerWidth - 24 };
      };
      function constrain() {
        if (panel.hidden) return;
        const bounds = limits();
        const size = Math.min(position?.size || Math.round(Math.min(208, innerWidth * .48)), bounds.width, bounds.bottom - bounds.top);
        const x = Math.max(12, Math.min(position?.x ?? 12, innerWidth - size - 12));
        const y = Math.max(bounds.top, Math.min(position?.y ?? bounds.bottom - size, bounds.bottom - size));
        if (position) position = { x, y, size };
        Object.assign(panel.style, { width: size + 'px', height: size + 'px', left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
      }
      function endGesture(event) {
        if (!gesture || (event && event.pointerId !== gesture.id)) return;
        const previous = gesture; gesture = null;
        if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
        panel.classList.remove('is-dragging', 'is-resizing');
      }
      for (const [handle, mode] of [[chrome, 'drag'], [resize, 'resize']]) {
        handle.addEventListener('pointerdown', event => {
          if (event.button !== 0 || (mode === 'drag' && event.target.closest('button'))) return;
          event.preventDefault();
          const rect = panel.getBoundingClientRect();
          gesture = { id: event.pointerId, handle, mode, startX: event.clientX, startY: event.clientY, x: rect.x, y: rect.y, size: rect.width };
          handle.setPointerCapture(event.pointerId); panel.classList.add(mode === 'drag' ? 'is-dragging' : 'is-resizing');
        });
        handle.addEventListener('pointermove', event => {
          if (!gesture || event.pointerId !== gesture.id) return;
          const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
          position = { x: gesture.x, y: gesture.y, size: gesture.size };
          if (mode === 'drag') { position.x += dx; position.y += dy; }
          else position.size = Math.max(144, gesture.size + (Math.abs(dx) > Math.abs(dy) ? dx : dy));
          constrain();
        });
        handle.addEventListener('pointerup', endGesture);
        handle.addEventListener('pointercancel', endGesture);
        handle.addEventListener('lostpointercapture', () => endGesture());
        handle.addEventListener('keydown', event => {
          if (event.target !== handle || !event.key.startsWith('Arrow')) return;
          event.preventDefault();
          const rect = panel.getBoundingClientRect();
          position = { x: rect.x, y: rect.y, size: rect.width };
          const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -12 : 12;
          if (mode === 'resize') position.size = Math.max(144, position.size + delta);
          else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) position.x += delta;
          else position.y += delta;
          constrain();
        });
      }
      image.addEventListener('error', () => { imageFailed = true; image.hidden = true; message.textContent = 'Image unavailable'; message.hidden = false; button.disabled = true; });
      button.addEventListener('click', () => active?.expand());
      close.addEventListener('click', () => {
        const previous = active; panel.hidden = true; previous?.dismiss(); previous?.trigger.focus({ preventScroll: true });
      });
      panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close.click(); } });
      window.addEventListener('resize', constrain);
      new ResizeObserver(constrain).observe(document.querySelector('.mobile-bottom-dock'));
      return {
        show(next) {
          active = next;
          title.textContent = next.title; title.title = next.title;
          panel.setAttribute('aria-label', `${next.section} preview: ${next.title}`);
          button.setAttribute('aria-label', next.source ? `Expand image: ${next.title}` : `No image available for ${next.title}`);
          if (!next.source) {
            source = null; imageFailed = false; image.hidden = true; image.removeAttribute('src'); message.textContent = 'No image available'; message.hidden = false;
          } else if (source !== next.source) {
            source = next.source; imageFailed = false; image.hidden = false; message.hidden = true; image.src = source;
          }
          button.disabled = !next.source || imageFailed;
          image.alt = next.title;
          panel.hidden = false; constrain();
        },
        hide() { endGesture(); panel.hidden = true; },
        reset() { endGesture(); active = null; source = null; position = null; imageFailed = false; panel.hidden = true; },
        constrain
      };
    }
  };
})();

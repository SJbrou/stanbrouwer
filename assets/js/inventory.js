(function () {
  'use strict';

  var CONFIG = window.STAN_INVENTORY_CONFIG || {};
  var CALLBACK_COUNTER = 0;
  var RUNNER_SUCCESS_DELAY_MS = 500;
  var RUNNER_STORAGE_KEY = 'stan-inventory-runner-name';
  var INVENTORY_NAME_STORAGE_KEY = 'stan-inventory-name';
  var LOCAL_STATE_KEY = 'stan-inventory-local-state-v1';
  var FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e9ebe3"/%3E%3Cpath d="M25 70 43 50l12 12 8-9 12 17H25Z" fill="%236c6c68"/%3E%3Ccircle cx="64" cy="34" r="8" fill="%236c6c68"/%3E%3C/svg%3E';
  var DEFAULT_LOCAL_DATA = {
    containers: ['KC1', 'KC2'],
    items: [
      { articleNumber: 'INV-001', name: 'Flesjes water', description: '24 x 0,33 l', image: '' },
      { articleNumber: 'INV-002', name: 'Frisdrank', description: '24 x 0,33 l', image: '' },
      { articleNumber: 'INV-003', name: 'Bier', description: '24 x 0,33 l', image: '' }
    ]
  };

  function asString(value) {
    return value == null ? '' : String(value).trim();
  }

  function escapeHtml(value) {
    return asString(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function isInteger(value, minimum) {
    var text = asString(value);
    return /^\d+$/.test(text) && parseInt(text, 10) >= minimum;
  }

  function wait(milliseconds) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, milliseconds);
    });
  }

  function makeRequestId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefix + '-' + window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  }

  function writeStorage(key, value) {
    try {
      if (value) {
        window.localStorage.setItem(key, value);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      // Storage is a convenience only; the form remains usable without it.
    }
  }

  function savedInventoryName() {
    return readStorage(INVENTORY_NAME_STORAGE_KEY) || readStorage(RUNNER_STORAGE_KEY);
  }

  function saveInventoryName(value) {
    writeStorage(INVENTORY_NAME_STORAGE_KEY, value);
    writeStorage(RUNNER_STORAGE_KEY, value);
  }

  function updateInventoryName(root, name) {
    var label = root.querySelector('[data-inventory-name]');
    if (label) label.textContent = name || 'Naam invullen';
  }

  function setupInventoryName(root, state) {
    var dialog = root.querySelector('[data-inventory-name-dialog]');
    var form = dialog && dialog.querySelector('form');
    var input = dialog && dialog.querySelector('[data-inventory-name-input]');
    var edit = root.querySelector('[data-inventory-name-edit]');

    function open() {
      if (!dialog || !input) return;
      input.value = state.name || '';
      dialog.hidden = false;
      window.setTimeout(function () { input.focus(); }, 0);
    }

    if (!dialog || !form || !input) return open;
    form.addEventListener('submit', function (event) {
      var name;
      event.preventDefault();
      name = asString(input.value);
      if (!name) {
        input.focus();
        return;
      }
      state.name = name;
      state.runner = name;
      state.teller = name;
      saveInventoryName(name);
      updateInventoryName(root, name);
      dialog.hidden = true;
      if (state.pendingSubmit && typeof state.submit === 'function') {
        state.pendingSubmit = false;
        state.submit();
      }
    });
    if (edit) edit.addEventListener('click', open);
    if (!state.name) open();
    updateInventoryName(root, state.name);
    return open;
  }

  function findAncestor(target, selector, boundary) {
    var current = target;
    while (current && current !== boundary) {
      if (current.matches && current.matches(selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  function attachImageFallbacks(root) {
    var images = root.querySelectorAll('img[data-inventory-image]');
    Array.prototype.forEach.call(images, function (image) {
      image.addEventListener('error', function () {
        image.src = FALLBACK_IMAGE;
      });
    });
  }

  function apiError(message, code) {
    var error = new Error(message);
    error.inventoryCode = code || 'inventory_error';
    return error;
  }

  function apiUrl(parameters) {
    if (!CONFIG.apiUrl) {
      throw apiError('De inventorykoppeling is nog niet ingesteld.', 'not_configured');
    }
    var query = Object.keys(parameters || {}).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key] == null ? '' : parameters[key]);
    }).join('&');
    return CONFIG.apiUrl + (CONFIG.apiUrl.indexOf('?') >= 0 ? '&' : '?') + query;
  }

  function isLocalMode() {
    // Localhost is used to test the real event workflow too. Only opt into
    // browser-local sample data when the configuration explicitly requests it.
    return CONFIG.localMode === true;
  }

  function localData() {
    var source = CONFIG.localData && typeof CONFIG.localData === 'object' ? CONFIG.localData :
      (CONFIG.bootstrap && typeof CONFIG.bootstrap === 'object' ? CONFIG.bootstrap : DEFAULT_LOCAL_DATA);
    var containers = Array.isArray(source.containers) && source.containers.length ? source.containers : DEFAULT_LOCAL_DATA.containers;
    var items = Array.isArray(source.items) && source.items.length ? source.items : DEFAULT_LOCAL_DATA.items;
    return {
      containers: containers.map(function (container) { return asString(container).toUpperCase(); }),
      items: items.map(function (item) {
        return {
          articleNumber: asString(item.articleNumber),
          name: asString(item.name),
          description: asString(item.description),
          image: asString(item.image)
        };
      }).filter(function (item) { return item.articleNumber && item.name; })
    };
  }

  function readLocalState() {
    var state;
    try {
      state = JSON.parse(window.localStorage.getItem(LOCAL_STATE_KEY) || '{}');
    } catch (error) {
      state = {};
    }
    return {
      mutations: Array.isArray(state.mutations) ? state.mutations : [],
      counts: Array.isArray(state.counts) ? state.counts : []
    };
  }

  function writeLocalState(state) {
    try {
      window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      throw apiError('De lokale testopslag is niet beschikbaar.', 'local_storage');
    }
  }

  function localContainer(data, requested) {
    var name = asString(requested).toUpperCase();
    return data.containers.filter(function (container) { return container === name; })[0] || '';
  }

  function localApiGet(action, parameters) {
    var data = localData();
    var state = readLocalState();
    var container;
    var mutation;
    var count;

    if (action === 'bootstrap') {
      container = localContainer(data, parameters && parameters.container);
      if (!container) return Promise.reject(apiError('Deze koelcontainer bestaat niet in de lokale testgegevens.', 'container_not_found'));
      return Promise.resolve({ ok: true, container: container, containers: data.containers, items: data.items });
    }
    if (action === 'lastMutation') {
      mutation = state.mutations[state.mutations.length - 1];
      return Promise.resolve({
        ok: true,
        rowNumber: state.mutations.length + 1,
        lastRow: mutation || null
      });
    }
    if (action === 'mutationStatus') {
      mutation = state.mutations.filter(function (entry) {
        return entry.requestId === (parameters && parameters.requestId);
      })[0];
      if (mutation) return Promise.resolve({ ok: true, found: true, rowNumber: mutation.rowNumber, matches: true });
      return Promise.resolve({ ok: true, found: false, rowNumber: state.mutations.length + 1, matches: false });
    }
    if (action === 'countStatus') {
      count = state.counts.filter(function (entry) {
        return entry.requestId === (parameters && parameters.requestId);
      })[0];
      return Promise.resolve({ ok: true, found: Boolean(count), writtenCount: count ? count.writtenCount : 0 });
    }
    return Promise.reject(apiError('Deze lokale inventoryactie bestaat niet.', 'invalid_action'));
  }

  function localApiPost(payload) {
    var data = localData();
    var state = readLocalState();
    var container = localContainer(data, payload && payload.container);
    var item;
    var mutation;
    var count;

    if (!container) return Promise.reject(apiError('Deze koelcontainer bestaat niet in de lokale testgegevens.', 'container_not_found'));
    if (payload.type === 'runner') {
      item = data.items.filter(function (entry) { return entry.articleNumber === payload.articleNumber; })[0];
      if (!item) return Promise.reject(apiError('Dit artikelnummer bestaat niet in de lokale testgegevens.', 'article_not_found'));
      mutation = state.mutations.filter(function (entry) { return entry.requestId === payload.requestId; })[0];
      if (!mutation) {
        mutation = Object.assign({}, payload, { rowNumber: state.mutations.length + 2 });
        state.mutations.push(mutation);
        writeLocalState(state);
      }
      return Promise.resolve({ ok: true, duplicate: Boolean(mutation.duplicate), rowNumber: mutation.rowNumber });
    }
    if (payload.type === 'endCount') {
      count = state.counts.filter(function (entry) { return entry.requestId === payload.requestId; })[0];
      if (!count) {
        count = Object.assign({}, payload, {
          writtenCount: (payload.counts || []).filter(function (entry) { return entry.amount !== null && entry.amount !== ''; }).length
        });
        state.counts.push(count);
        writeLocalState(state);
      }
      return Promise.resolve({ ok: true, found: true, writtenCount: count.writtenCount });
    }
    return Promise.reject(apiError('Onbekend lokaal registratietype.', 'invalid_payload'));
  }

  function apiGet(action, parameters) {
    if (isLocalMode()) return localApiGet(action, parameters);
    return new Promise(function (resolve, reject) {
      var callbackName = 'inventoryCallback' + (++CALLBACK_COUNTER) + Date.now();
      var script = document.createElement('script');
      var timeout = window.setTimeout(function () {
        cleanup();
        reject(apiError('De Sheets-server reageert niet op tijd.', 'timeout'));
      }, 12000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function (response) {
        cleanup();
        if (!response || response.ok === false) {
          reject(apiError(response && response.message ? response.message : 'De inventorygegevens konden niet worden geladen.', response && response.code));
          return;
        }
        resolve(response);
      };

      try {
        script.onerror = function () {
          cleanup();
          reject(apiError('De Sheets-server kon niet worden bereikt.', 'network'));
        };
        script.src = apiUrl(Object.assign({}, parameters || {}, { action: action, callback: callbackName }));
        document.head.appendChild(script);
      } catch (error) {
        cleanup();
        reject(error.inventoryCode ? error : apiError('De inventorykoppeling kon niet worden gestart.', 'network'));
      }
    });
  }

  function apiPost(payload) {
    if (isLocalMode()) return localApiPost(payload);
    if (!CONFIG.apiUrl) {
      return Promise.reject(apiError('De inventorykoppeling is nog niet ingesteld.', 'not_configured'));
    }
    return fetch(CONFIG.apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(function () {
      throw apiError('De registratie kon niet naar de Sheets-server worden gestuurd.', 'network');
    });
  }

  function keepSendingInBackground(request) {
    Promise.resolve(request).catch(function (error) {
      // The runner can continue immediately for the demo. Keep delivery errors
      // available for troubleshooting without replacing the success screen.
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn('Inventory runner-registratie kon niet worden afgeleverd.', error);
      }
    });
  }

  function resolveRoute() {
    var path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    var segments = path ? path.split('/') : [];
    var inventoryIndex = segments.indexOf('inventory');
    var kind;
    var container;

    if (inventoryIndex < 0) return { kind: 'not-inventory' };
    if (segments.length === inventoryIndex + 1) return { kind: 'landing' };
    kind = segments[inventoryIndex + 1];
    if (kind !== 'runner' && kind !== 'eindtelling') return { kind: 'invalid' };
    if (segments.length === inventoryIndex + 2) return { kind: kind, container: '' };
    if (segments.length !== inventoryIndex + 3) return { kind: 'invalid' };
    try {
      container = decodeURIComponent(segments[inventoryIndex + 2]);
    } catch (error) {
      return { kind: 'invalid' };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(container)) return { kind: 'invalid' };
    return { kind: kind, container: container.toUpperCase() };
  }

  function baseLink(path) {
    var base = (CONFIG.baseUrl || '');
    return base + path;
  }

  function scannedInventoryPath(value) {
    var text = asString(value);
    var url;
    var match;
    if (!text) return '';
    try {
      url = new URL(text, window.location.href);
    } catch (error) {
      return '';
    }
    match = url.pathname.match(/\/inventory\/(runner|eindtelling)\/([A-Za-z0-9_-]+)\/?$/i);
    if (!match) return '';
    return url.pathname + url.search + url.hash;
  }

  function initQrScanner(root) {
    var openButton = root.querySelector('[data-inventory-scan-open]');
    var scanner = root.querySelector('[data-inventory-scanner]');
    var closeButton;
    var video;
    var status;
    var manualInput;
    var manualButton;
    var stream = null;
    var detector = null;
    var animationFrame = 0;
    var active = false;

    if (!openButton || !scanner) return;
    closeButton = scanner.querySelector('[data-inventory-scan-close]');
    video = scanner.querySelector('[data-inventory-scan-video]');
    status = scanner.querySelector('[data-inventory-scan-status]');
    manualInput = scanner.querySelector('[data-inventory-scan-manual]');
    manualButton = scanner.querySelector('[data-inventory-scan-open-manual]');

    function setScannerStatus(message, type) {
      status.textContent = message;
      status.className = 'inventory-scanner__status' + (type ? ' inventory-scanner__status--' + type : '');
    }

    function stopScanner() {
      active = false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (stream) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        stream = null;
      }
      video.pause();
      video.srcObject = null;
      scanner.hidden = true;
    }

    function navigateToScannedPath(value) {
      var path = scannedInventoryPath(value);
      if (!path) {
        setScannerStatus('Deze QR-code bevat geen geldige inventory-URL.', 'error');
        return false;
      }
      stopScanner();
      window.location.assign(path);
      return true;
    }

    function scanFrame() {
      if (!active) return;
      detector.detect(video).then(function (codes) {
        var rawValue = codes && codes[0] && codes[0].rawValue;
        if (rawValue && navigateToScannedPath(rawValue)) return;
        animationFrame = window.requestAnimationFrame(scanFrame);
      }).catch(function () {
        animationFrame = window.requestAnimationFrame(scanFrame);
      });
    }

    function startScanner() {
      if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setScannerStatus('QR-scannen werkt alleen via HTTPS of localhost.', 'error');
        return;
      }
      if (!window.BarcodeDetector) {
        setScannerStatus('Deze browser ondersteunt geen ingebouwde QR-scanner. Gebruik de camera-app of plak hieronder de QR-link.', 'error');
        return;
      }
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (error) {
        setScannerStatus('De QR-scanner kan niet worden gestart. Plak hieronder de QR-link.', 'error');
        return;
      }
      scanner.hidden = false;
      setScannerStatus('Camera starten…');
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (cameraStream) {
        stream = cameraStream;
        video.srcObject = stream;
        active = true;
        return video.play();
      }).then(function () {
        if (!active) return;
        setScannerStatus('Richt de camera op de QR-code.');
        scanFrame();
      }).catch(function () {
        setScannerStatus('Geen toegang tot de camera. Controleer de browsertoestemming of plak hieronder de QR-link.', 'error');
      });
    }

    openButton.addEventListener('click', startScanner);
    closeButton.addEventListener('click', stopScanner);
    manualButton.addEventListener('click', function () {
      if (!navigateToScannedPath(manualInput.value)) manualInput.focus();
    });
    manualInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        manualButton.click();
      }
    });
    scanner.addEventListener('click', function (event) {
      if (event.target === scanner) stopScanner();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !scanner.hidden) stopScanner();
    });
  }

  function runnerShell() {
    return '' +
      '<a class="inventory-back-link" href="' + baseLink('/inventory/') + '">← Inventory</a>' +
      '<header class="inventory-page-header">' +
        '<p class="inventory-kicker">RUNNERREGISTRATIE</p>' +
        '<h1 data-container-title>Koelcontainer</h1>' +
        '<p class="inventory-page-header__lead">Registreer wat je uit deze koelcontainer haalt.</p>' +
      '</header>' +
      '<div class="inventory-status" id="inventory-status" role="status" aria-live="polite"></div>' +
      '<section class="inventory-toolbar" aria-label="Artikel zoeken">' +
        '<label class="inventory-field" for="runner-search">' +
          '<span>Zoek artikel</span>' +
          '<input class="inventory-search" id="runner-search" type="search" autocomplete="off" placeholder="Typ een naam of verpakking">' +
        '</label>' +
      '</section>' +
      '<section aria-labelledby="runner-items-title">' +
        '<div class="inventory-section-heading"><h2 id="runner-items-title">Artikelen</h2><p data-item-count></p></div>' +
        '<div class="inventory-items" id="runner-items" role="list"></div>' +
      '</section>' +
      '<section class="inventory-selection" id="runner-selection" hidden aria-labelledby="runner-selection-title">' +
        '<h2 class="inventory-section-heading" id="runner-selection-title">Uitgifte</h2>' +
        '<div class="inventory-product" data-selected-product></div>' +
        '<form id="runner-form" novalidate>' +
          '<div class="inventory-field">' +
            '<label for="runner-amount">Aantal volledige verpakkingen</label>' +
            '<div class="inventory-quantity">' +
              '<button class="inventory-quantity__button" type="button" data-quantity-step="-1" aria-label="Aantal met één verlagen">−</button>' +
              '<input class="inventory-number-input" id="runner-amount" type="number" min="1" step="1" inputmode="numeric" value="1" required aria-label="Aantal volledige verpakkingen">' +
              '<button class="inventory-quantity__button" type="button" data-quantity-step="1" aria-label="Aantal met één verhogen">+</button>' +
            '</div>' +
            '<div class="inventory-selection__quick-actions">' +
              '<button class="inventory-secondary-button" type="button" data-quantity-step="5">+5</button>' +
              '<button class="inventory-secondary-button" type="button" data-quantity-step="10">+10</button>' +
            '</div>' +
          '</div>' +
          '<div class="inventory-fields">' +
            '<div class="inventory-field"><label for="runner-name">Naam runner <span>(optioneel)</span></label><input id="runner-name" type="text" autocomplete="name" placeholder="Bijvoorbeeld Stan"></div>' +
          '</div>' +
          '<button class="inventory-primary-button" type="submit">Registratie controleren</button>' +
          '<label class="inventory-field inventory-destination" for="runner-destination"><span>Bestemming <span>(optioneel; ook voor notities)</span></span><input id="runner-destination" type="text" autocomplete="off" placeholder="Bijvoorbeeld Bar 1 of een korte notitie"></label>' +
        '</form>' +
      '</section>' +
      '<section class="inventory-review" id="runner-review" hidden aria-labelledby="runner-review-title"></section>' +
      '<section class="inventory-success" id="runner-success" hidden aria-live="polite"></section>';
  }

  function endShell() {
    return '' +
      '<a class="inventory-back-link" href="' + baseLink('/inventory/') + '">← Inventory</a>' +
      '<header class="inventory-page-header">' +
        '<p class="inventory-kicker">EINDTELLING</p>' +
        '<h1 data-container-title>Koelcontainer</h1>' +
        '<p class="inventory-page-header__lead">Eindtelling van deze koelcontainer.</p>' +
      '</header>' +
      '<div class="inventory-status" id="inventory-status" role="status" aria-live="polite"></div>' +
      '<form class="inventory-end-form" id="end-form" novalidate>' +
        '<div class="inventory-field"><label for="counter-name">Naam teller</label><input id="counter-name" type="text" autocomplete="name" placeholder="Wie voert de telling uit?" required></div>' +
        '<p class="inventory-footnote">Laat een veld leeg als het artikel nog niet is geteld. Vul <strong>0</strong> in als er niets meer aanwezig is.</p>' +
        '<button class="inventory-primary-button" type="submit">Volledige telling controleren</button>' +
      '</form>' +
      '<section aria-labelledby="end-items-title">' +
        '<div class="inventory-section-heading"><h2 id="end-items-title">Artikelen</h2><p data-item-count></p></div>' +
        '<div class="inventory-end-items" id="end-items"></div>' +
      '</section>' +
      '<section class="inventory-review" id="end-review" hidden aria-labelledby="end-review-title"></section>' +
      '<section class="inventory-success" id="end-success" hidden aria-live="polite"></section>';
  }

  function routeError(root, title, message) {
    root.innerHTML = '<section class="inventory-route-error" role="alert"><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(message) + '</p><a class="inventory-link-button" href="' + baseLink('/inventory/') + '">Terug naar inventory</a></section>';
  }

  function setStatus(root, message, type) {
    var status = root.querySelector('#inventory-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'inventory-status' + (type ? ' inventory-status--' + type : '');
  }

  function itemImage(item, className) {
    var source = asString(item.image) || FALLBACK_IMAGE;
    // Every card owns its own low-priority image request. Image downloads do
    // not block the rendered form or the inventory interaction.
    return '<img class="' + className + '" src="' + escapeAttribute(source) + '" alt="" fetchpriority="low" decoding="async" data-inventory-image>';
  }

  function itemSearchText(item) {
    return [item.articleNumber, item.name, item.description].join(' ').toLowerCase();
  }

  function displayContainer(root, container) {
    var title = root.querySelector('[data-container-title]');
    if (title) title.textContent = container || 'Koelcontainer';
  }

  function loadBootstrap(root, route, callback) {
    var bootstrap = CONFIG.bootstrap;
    var container = localContainer(bootstrap || {}, route.container);
    var items = bootstrap && Array.isArray(bootstrap.items) ? bootstrap.items : [];
    if (!container || !items.length) {
      routeError(root, 'Inventory niet beschikbaar', 'De vaste artikelcatalogus ontbreekt of deze koelcontainer bestaat niet.');
      return;
    }
    displayContainer(root, container);
    callback(items);
  }

  function renderItemCard(item, selected) {
    return '<button class="inventory-item-card" type="button" role="listitem" data-article="' + escapeAttribute(item.articleNumber) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
      itemImage(item, 'inventory-item-card__image') +
      '<span class="inventory-item-card__copy"><span class="inventory-item-card__name">' + escapeHtml(item.name) + '</span>' +
      '<span class="inventory-item-card__description">' + escapeHtml(item.description || 'Geen omschrijving') + '</span>' +
      '<span class="inventory-item-card__number">' + escapeHtml(item.articleNumber) + '</span></span></button>';
  }

  function renderRunnerItems(state) {
    var target = state.root.querySelector('#runner-items');
    var count = state.root.querySelector('[data-item-count]');
    var query = asString(state.root.querySelector('#runner-search').value).toLowerCase();
    var visible = state.items.filter(function (item) {
      return !query || itemSearchText(item).indexOf(query) >= 0;
    });
    if (count) count.textContent = visible.length + ' van ' + state.items.length;
    target.innerHTML = visible.length ? visible.map(function (item) {
      return renderItemCard(item, state.selected && state.selected.articleNumber === item.articleNumber);
    }).join('') : '<p class="inventory-loading">Geen artikelen gevonden.</p>';
    attachImageFallbacks(target);
  }

  function renderSelectedProduct(state) {
    var target = state.root.querySelector('[data-selected-product]');
    var selection = state.root.querySelector('#runner-selection');
    if (!state.selected) {
      selection.hidden = true;
      return;
    }
    selection.hidden = false;
    target.innerHTML = itemImage(state.selected, 'inventory-product__image') +
      '<div class="inventory-product__copy"><span class="inventory-product__name">' + escapeHtml(state.selected.name) + '</span>' +
      '<span class="inventory-product__description">' + escapeHtml(state.selected.description || 'Geen omschrijving') + '</span>' +
      '<span class="inventory-product__number">' + escapeHtml(state.selected.articleNumber) + '</span></div>';
    state.root.querySelector('#runner-amount').value = String(state.amount);
    attachImageFallbacks(target);
  }

  function showRunnerReview(state) {
    var amount = state.root.querySelector('#runner-amount').value;
    var destination = state.root.querySelector('#runner-destination').value;
    var runner = state.root.querySelector('#runner-name').value;
    var review = state.root.querySelector('#runner-review');
    if (!state.selected) {
      setStatus(state.root, 'Kies eerst een artikel.', 'error');
      return;
    }
    if (!isInteger(amount, 1)) {
      setStatus(state.root, 'Vul een geheel aantal van minimaal 1 in.', 'error');
      return;
    }
    state.amount = parseInt(amount, 10);
    state.destination = asString(destination);
    state.runner = asString(runner);
    writeStorage(RUNNER_STORAGE_KEY, state.runner);
    review.innerHTML = '<h2 id="runner-review-title">Controleer de registratie</h2>' +
      '<p>Controleer deze uitgifte voordat je verzendt.</p>' +
      '<ul class="inventory-review-list">' +
        '<li><span>Artikel</span><span>' + escapeHtml(state.selected.name) + '</span></li>' +
        '<li><span>Aantal</span><span>' + state.amount + '</span></li>' +
        '<li><span>Bestemming / notitie</span><span>' + escapeHtml(state.destination || 'Niet ingevuld') + '</span></li>' +
        '<li><span>Runner</span><span>' + escapeHtml(state.runner || 'Niet ingevuld') + '</span></li>' +
      '</ul>' +
      '<div class="inventory-review__actions"><button class="inventory-secondary-button" type="button" data-action="runner-edit">Wijzigen</button><button class="inventory-primary-button" type="button" data-action="runner-confirm">Definitief verzenden</button></div>';
    review.hidden = false;
    setStatus(state.root, '');
    review.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function sendRunner(state) {
    var payload = state.pendingPayload || {
      type: 'runner',
      requestId: makeRequestId('runner'),
      container: state.container,
      articleNumber: state.selected.articleNumber,
      amount: state.amount,
      destination: state.destination,
      // Older deployed Apps Script versions still require destinationBar.
      // A dash keeps an intentionally empty bestemming valid there; the new
      // backend uses destination and therefore continues to store it blank.
      destinationBar: state.destination || '-',
      runner: state.runner
    };
    state.pendingPayload = payload;
    state.sending = true;
    setStatus(state.root, 'Registratie verzenden…');
    return apiPost(payload);
  }

  function runnerSuccess(state) {
    var success = state.root.querySelector('#runner-success');
    success.innerHTML = '<h2>Registratie verzonden</h2><p>' + escapeHtml(String(state.amount) + ' x ' + state.selected.name) + ' is verzonden voor ' + escapeHtml(state.container) + '.</p><div class="inventory-success__actions"><button class="inventory-primary-button" type="button" data-action="runner-next">Volgende uitgifte registreren</button></div>';
    success.hidden = false;
    state.root.querySelector('#runner-review').hidden = true;
    state.root.querySelector('#runner-selection').hidden = true;
    state.root.querySelector('#runner-items').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStatus(state.root, '');
  }

  function initRunner(root, route, items) {
    var state = {
      root: root,
      container: route.container,
      items: items,
      selected: null,
      amount: 1,
      destination: '',
      runner: readStorage(RUNNER_STORAGE_KEY),
      pendingPayload: null,
      sending: false
    };
    root.innerHTML = runnerShell();
    displayContainer(root, route.container);
    root.querySelector('#runner-name').value = state.runner;
    renderRunnerItems(state);
    setStatus(root, '');

    root.querySelector('#runner-search').addEventListener('input', function () {
      renderRunnerItems(state);
    });

    root.querySelector('#runner-items').addEventListener('click', function (event) {
      var card = findAncestor(event.target, '[data-article]', this);
      var articleNumber;
      if (!card) return;
      articleNumber = card.getAttribute('data-article');
      state.selected = state.items.filter(function (item) { return item.articleNumber === articleNumber; })[0] || null;
      state.amount = 1;
      state.pendingPayload = null;
      renderRunnerItems(state);
      renderSelectedProduct(state);
      root.querySelector('#runner-amount').focus();
    });

    root.querySelector('#runner-selection').addEventListener('click', function (event) {
      var button = findAncestor(event.target, '[data-quantity-step]', this);
      var step;
      var input;
      if (!button) return;
      step = parseInt(button.getAttribute('data-quantity-step'), 10);
      input = root.querySelector('#runner-amount');
      state.amount = Math.max(1, (parseInt(input.value, 10) || 0) + step);
      input.value = String(state.amount);
    });

    root.querySelector('#runner-amount').addEventListener('input', function () {
      if (isInteger(this.value, 1)) state.amount = parseInt(this.value, 10);
      state.pendingPayload = null;
    });

    root.querySelector('#runner-form').addEventListener('submit', function (event) {
      event.preventDefault();
      if (!state.sending) showRunnerReview(state);
    });

    root.querySelector('#runner-review').addEventListener('click', function (event) {
      var action = findAncestor(event.target, '[data-action]', this);
      if (!action || state.sending) return;
      if (action.getAttribute('data-action') === 'runner-edit') {
        this.hidden = true;
        setStatus(root, '');
        root.querySelector('#runner-amount').focus();
        return;
      }
      if (action.getAttribute('data-action') === 'runner-confirm') {
        var delivery;
        action.disabled = true;
        wait(RUNNER_SUCCESS_DELAY_MS).then(function () {
          state.sending = false;
          state.pendingPayload = null;
          runnerSuccess(state);
        });
        try {
          delivery = sendRunner(state);
          keepSendingInBackground(delivery);
        } catch (error) {
          keepSendingInBackground(Promise.reject(error));
        }
      }
    });

    root.querySelector('#runner-success').addEventListener('click', function (event) {
      var action = findAncestor(event.target, '[data-action="runner-next"]', this);
      if (!action) return;
      state.selected = null;
      state.amount = 1;
      state.pendingPayload = null;
      this.hidden = true;
      renderRunnerItems(state);
      renderSelectedProduct(state);
      root.querySelector('#runner-search').focus();
    });
  }

  function renderEndItems(state) {
    var target = state.root.querySelector('#end-items');
    var count = state.root.querySelector('[data-item-count]');
    if (count) count.textContent = state.items.length + ' artikelen';
    target.innerHTML = state.items.map(function (item) {
      return '<article class="inventory-end-item">' + itemImage(item, 'inventory-product__image') + '<div class="inventory-end-item__content"><span class="inventory-product__name">' + escapeHtml(item.name) + '</span><span class="inventory-product__description">' + escapeHtml(item.description || 'Geen omschrijving') + '</span><span class="inventory-product__number">' + escapeHtml(item.articleNumber) + '</span><div class="inventory-end-item__input-row"><input class="inventory-number-input" type="number" min="0" step="1" inputmode="numeric" data-inventory-article="' + escapeAttribute(item.articleNumber) + '" aria-label="Geteld aantal voor ' + escapeAttribute(item.name) + '"><span class="inventory-empty-label">leeg = nog niet geteld</span></div></div></article>';
    }).join('');
    attachImageFallbacks(target);
  }

  function collectEndCounts(state) {
    var counts = [];
    var invalid = false;
    var inputs = state.root.querySelectorAll('[data-inventory-article], [data-end-article]');
    Array.prototype.forEach.call(inputs, function (input) {
      var value = asString(input.value);
      var articleNumber = input.getAttribute('data-inventory-article') || input.getAttribute('data-end-article');
      if (!value) {
        counts.push({ articleNumber: articleNumber, amount: null });
      } else if (!isInteger(value, 0)) {
        invalid = true;
      } else {
        counts.push({ articleNumber: articleNumber, amount: parseInt(value, 10) });
      }
    });
    if (invalid) throw apiError('Gebruik alleen gehele aantallen vanaf 0 in de eindtelling.', 'validation');
    return counts;
  }

  function showEndReview(state) {
    var teller = asString(state.root.querySelector('#counter-name').value);
    var review = state.root.querySelector('#end-review');
    var counts;
    var missing;
    if (!teller) {
      setStatus(state.root, 'Vul de naam van de teller in.', 'error');
      return;
    }
    try {
      counts = collectEndCounts(state);
    } catch (error) {
      setStatus(state.root, error.message, 'error');
      return;
    }
    missing = counts.filter(function (entry) { return entry.amount === null; }).length;
    state.teller = teller;
    state.counts = counts;
    state.pendingPayload = null;
    review.innerHTML = '<h2 id="end-review-title">Controleer de volledige telling</h2><p>Controleer ieder artikel. Een leeg veld blijft leeg; een getoonde 0 wordt als nul opgeslagen.</p><ul class="inventory-review-list">' + state.items.map(function (item) {
      var entry = counts.filter(function (count) { return count.articleNumber === item.articleNumber; })[0];
      return '<li><span>' + escapeHtml(item.name) + '</span><span>' + (entry.amount === null ? 'Nog niet geteld' : String(entry.amount)) + '</span></li>';
    }).join('') + '</ul>' + (missing ? '<div class="inventory-review__missing">' + missing + ' artikel' + (missing === 1 ? '' : 'en') + ' is nog niet geteld.<label><input type="checkbox" data-action="end-acknowledge"> <span>Ik heb de nog niet getelde artikelen gecontroleerd.</span></label></div>' : '') + '<div class="inventory-review__actions"><button class="inventory-secondary-button" type="button" data-action="end-edit">Wijzigen</button><button class="inventory-primary-button" type="button" data-action="end-confirm"' + (missing ? ' disabled' : '') + '>Definitief opslaan</button></div>';
    review.hidden = false;
    setStatus(state.root, '');
    review.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function sendEndCount(state) {
    var payload = state.pendingPayload || {
      type: 'endCount',
      requestId: makeRequestId('count'),
      container: state.container,
      teller: state.teller,
      counts: state.counts
    };
    state.pendingPayload = payload;
    state.sending = true;
    setStatus(state.root, 'Eindtelling opslaan…');
    return apiPost(payload).then(function () {
      return {
        ok: true,
        writtenCount: payload.counts.filter(function (entry) { return entry.amount !== null && entry.amount !== ''; }).length
      };
    });
  }

  function endSuccess(state, response) {
    var success = state.root.querySelector('#end-success');
    success.innerHTML = '<h2>Eindtelling verzonden</h2><p>De telling voor ' + escapeHtml(state.container) + ' is verzonden. ' + escapeHtml(String(response.writtenCount || 0)) + ' ingevulde aantallen worden opgeslagen.</p><div class="inventory-success__actions"><button class="inventory-primary-button" type="button" data-action="end-new">Nieuwe telling invoeren</button></div>';
    success.hidden = false;
    state.root.querySelector('#end-review').hidden = true;
    state.root.querySelector('#end-form').hidden = true;
    setStatus(state.root, '');
  }

  function initEnd(root, route, items) {
    var state = {
      root: root,
      container: route.container,
      items: items,
      teller: '',
      counts: [],
      pendingPayload: null,
      sending: false
    };
    root.innerHTML = endShell();
    displayContainer(root, route.container);
    renderEndItems(state);
    setStatus(root, '');

    root.querySelector('#end-form').addEventListener('submit', function (event) {
      event.preventDefault();
      if (!state.sending) showEndReview(state);
    });

    root.querySelector('#end-review').addEventListener('change', function (event) {
      var checkbox = findAncestor(event.target, '[data-action="end-acknowledge"]', this);
      var confirm;
      if (!checkbox) return;
      confirm = this.querySelector('[data-action="end-confirm"]');
      if (confirm) confirm.disabled = !checkbox.checked;
    });

    root.querySelector('#end-review').addEventListener('click', function (event) {
      var action = findAncestor(event.target, '[data-action]', this);
      if (!action || state.sending) return;
      if (action.getAttribute('data-action') === 'end-edit') {
        this.hidden = true;
        setStatus(root, '');
        root.querySelector('#counter-name').focus();
        return;
      }
      if (action.getAttribute('data-action') === 'end-confirm') {
        action.disabled = true;
        sendEndCount(state).then(function (response) {
          state.sending = false;
          state.pendingPayload = null;
          endSuccess(state, response);
        }).catch(function (error) {
          state.sending = false;
          action.disabled = false;
          setStatus(root, error.message || 'De eindtelling kon niet worden opgeslagen.', 'error');
        });
      }
    });

    root.querySelector('#end-success').addEventListener('click', function (event) {
      var action = findAncestor(event.target, '[data-action="end-new"]', this);
      if (!action) return;
      this.hidden = true;
      root.querySelector('#end-form').hidden = false;
      root.querySelector('#end-review').hidden = true;
      root.querySelector('#counter-name').focus();
    });
  }

  function mobileRunnerShell() {
    return '' +
      '<a class="inventory-back-link" href="' + baseLink('/inventory/') + '">&larr; Inventory</a>' +
      '<header class="inventory-page-header">' +
        '<p class="inventory-kicker">Naam: <button class="inventory-name-button" type="button" data-inventory-name-edit><span data-inventory-name>Naam invullen</span> <span aria-hidden="true">&#8599;</span></button></p>' +
        '<h1>Registreer wat je uit deze koelcontainer haalt: <span data-container-title>Koelcontainer</span></h1>' +
      '</header>' +
      '<div class="inventory-status" id="inventory-status" role="status" aria-live="polite"></div>' +
      '<form class="inventory-form" id="runner-form" novalidate>' +
        '<div class="inventory-section-heading"><h2>Artikelen</h2><p data-item-count></p></div>' +
        '<div class="inventory-items" id="runner-items" role="list"></div>' +
        '<button class="inventory-primary-button" type="submit">Registratie verzenden</button>' +
        '<label class="inventory-field inventory-destination" for="runner-destination"><span>Bestemming <span>(optioneel; ook voor notities)</span></span><input id="runner-destination" type="text" autocomplete="off" placeholder="Bijvoorbeeld Bar 1 of een korte notitie"></label>' +
      '</form>' +
      '<section class="inventory-success" id="runner-success" hidden aria-live="polite"></section>' +
      '<section class="inventory-name-dialog" data-inventory-name-dialog hidden aria-labelledby="inventory-name-title">' +
        '<div class="inventory-name-dialog__panel" role="dialog" aria-modal="true">' +
          '<h2 id="inventory-name-title">Wie registreert?</h2><p>Vul je naam in. We onthouden deze op dit apparaat.</p>' +
          '<form novalidate><label class="inventory-field" for="inventory-name-input">Naam<input id="inventory-name-input" type="text" autocomplete="name" data-inventory-name-input required></label><button class="inventory-primary-button" type="submit">Doorgaan</button></form>' +
        '</div>' +
      '</section>';
  }

  function mobileEndShell() {
    return '' +
      '<a class="inventory-back-link" href="' + baseLink('/inventory/') + '">&larr; Inventory</a>' +
      '<header class="inventory-page-header">' +
        '<p class="inventory-kicker">Naam: <button class="inventory-name-button" type="button" data-inventory-name-edit><span data-inventory-name>Naam invullen</span> <span aria-hidden="true">&#8599;</span></button></p>' +
        '<h1>Registreer de resterende voorraad in deze koelcontainer: <span data-container-title>Koelcontainer</span></h1>' +
      '</header>' +
      '<div class="inventory-status" id="inventory-status" role="status" aria-live="polite"></div>' +
      '<form class="inventory-form" id="end-form" novalidate>' +
        '<div class="inventory-section-heading"><h2>Artikelen</h2><p data-item-count></p></div>' +
        '<div class="inventory-end-items" id="end-items"></div>' +
        '<p class="inventory-footnote">Laat een veld leeg als het artikel nog niet is geteld. Vul <strong>0</strong> in als er niets meer aanwezig is.</p>' +
        '<button class="inventory-primary-button" type="submit">Eindtelling verzenden</button>' +
      '</form>' +
      '<section class="inventory-success" id="end-success" hidden aria-live="polite"></section>' +
      '<section class="inventory-name-dialog" data-inventory-name-dialog hidden aria-labelledby="inventory-end-name-title">' +
        '<div class="inventory-name-dialog__panel" role="dialog" aria-modal="true">' +
          '<h2 id="inventory-end-name-title">Wie telt?</h2><p>Vul je naam in. We onthouden deze op dit apparaat.</p>' +
          '<form novalidate><label class="inventory-field" for="inventory-name-input">Naam<input id="inventory-name-input" type="text" autocomplete="name" data-inventory-name-input required></label><button class="inventory-primary-button" type="submit">Doorgaan</button></form>' +
        '</div>' +
      '</section>';
  }

  function mobileRunnerRows(state) {
    var target = state.root.querySelector('#runner-items');
    var count = state.root.querySelector('[data-item-count]');
    if (count) count.textContent = state.items.length + ' artikelen';
    target.innerHTML = state.items.map(function (item) {
      var amount = state.amounts[item.articleNumber] || 0;
      return '<article class="inventory-product-row" data-article="' + escapeAttribute(item.articleNumber) + '" role="listitem">' +
        itemImage(item, 'inventory-product-row__image') +
        '<div class="inventory-product-row__main"><div class="inventory-product-row__copy"><span class="inventory-product__name">' + escapeHtml(item.name) + '</span><span class="inventory-product__description">' + escapeHtml(item.description || 'Geen omschrijving') + '</span></div>' +
        '<div class="inventory-quantity" aria-label="Aantal ' + escapeAttribute(item.name) + '"><button class="inventory-quantity__button" type="button" data-quantity-step="-1" aria-label="Minder ' + escapeAttribute(item.name) + '">&#8722;</button><input class="inventory-number-input" type="number" min="0" step="1" inputmode="numeric" value="' + amount + '" data-runner-article="' + escapeAttribute(item.articleNumber) + '" aria-label="Aantal ' + escapeAttribute(item.name) + '"><button class="inventory-quantity__button" type="button" data-quantity-step="1" aria-label="Meer ' + escapeAttribute(item.name) + '">+</button></div></div>' +
        '</article>';
    }).join('');
    attachImageFallbacks(target);
  }

  function mobileEndRows(state) {
    var target = state.root.querySelector('#end-items');
    var count = state.root.querySelector('[data-item-count]');
    if (count) count.textContent = state.items.length + ' artikelen';
    target.innerHTML = state.items.map(function (item) {
      return '<article class="inventory-product-row" data-article="' + escapeAttribute(item.articleNumber) + '">' +
        itemImage(item, 'inventory-product-row__image') +
        '<div class="inventory-product-row__main"><div class="inventory-product-row__copy"><span class="inventory-product__name">' + escapeHtml(item.name) + '</span><span class="inventory-product__description">' + escapeHtml(item.description || 'Geen omschrijving') + '</span></div>' +
        '<div class="inventory-quantity" aria-label="Geteld aantal ' + escapeAttribute(item.name) + '"><button class="inventory-quantity__button" type="button" data-quantity-step="-1" aria-label="Minder ' + escapeAttribute(item.name) + '">&#8722;</button><input class="inventory-number-input" type="number" min="0" step="1" inputmode="numeric" value="" data-end-article="' + escapeAttribute(item.articleNumber) + '" aria-label="Geteld aantal voor ' + escapeAttribute(item.name) + '"><button class="inventory-quantity__button" type="button" data-quantity-step="1" aria-label="Meer ' + escapeAttribute(item.name) + '">+</button></div></div>' +
        '</article>';
    }).join('');
    attachImageFallbacks(target);
  }

  function quantityInputFor(row, attribute) {
    return row.querySelector('input[' + attribute + ']');
  }

  function mobileCollectRunnerEntries(state) {
    var entries = [];
    var invalid = false;
    var inputs = state.root.querySelectorAll('[data-runner-article]');
    Array.prototype.forEach.call(inputs, function (input) {
      var value = asString(input.value);
      if (!value) value = '0';
      if (!isInteger(value, 0)) {
        invalid = true;
        return;
      }
      if (parseInt(value, 10) > 0) entries.push({ articleNumber: input.getAttribute('data-runner-article'), amount: parseInt(value, 10) });
    });
    if (invalid) throw apiError('Gebruik alleen gehele aantallen vanaf 0.', 'validation');
    return entries;
  }

  function sendMobileRunner(state) {
    var payloads = state.entries.map(function (entry) {
      return {
        type: 'runner',
        requestId: makeRequestId('runner'),
        container: state.container,
        articleNumber: entry.articleNumber,
        amount: entry.amount,
        destination: state.destination,
        destinationBar: state.destination || '-',
        runner: state.name
      };
    });
    state.sending = true;
    setStatus(state.root, 'Registratie verzendenâ€¦');
    return payloads.reduce(function (chain, payload) {
      return chain.then(function () {
        return apiPost(payload);
      });
    }, Promise.resolve());
  }

  function mobileRunnerSuccess(state) {
    var success = state.root.querySelector('#runner-success');
    success.innerHTML = '<h2>Registratie opgeslagen</h2><p>' + state.entries.length + ' artikel' + (state.entries.length === 1 ? '' : 'en') + ' geregistreerd voor ' + escapeHtml(state.container) + '.</p><div class="inventory-success__actions"><button class="inventory-primary-button" type="button" data-action="runner-new">Nieuwe registratie</button></div>';
    state.root.querySelector('#runner-form').hidden = true;
    success.hidden = false;
    setStatus(state.root, '');
  }

  function initRunnerMobile(root, route, items) {
    var state = {
      root: root,
      container: route.container,
      items: items,
      amounts: {},
      name: savedInventoryName(),
      runner: savedInventoryName(),
      destination: '',
      entries: [],
      pendingPayload: null,
      pendingSubmit: false,
      sending: false
    };
    root.innerHTML = mobileRunnerShell();
    displayContainer(root, route.container);
    mobileRunnerRows(state);
    state.openNameDialog = setupInventoryName(root, state);
    state.submit = function () {
      var destination = asString(root.querySelector('#runner-destination').value);
      if (!state.name) {
        state.pendingSubmit = true;
        state.openNameDialog();
        return;
      }
      try {
        state.entries = mobileCollectRunnerEntries(state);
      } catch (error) {
        setStatus(root, error.message, 'error');
        return;
      }
      if (!state.entries.length) {
        setStatus(root, 'Vul minimaal één aantal in.', 'error');
        return;
      }
      state.destination = destination;
      root.querySelector('#runner-form button[type="submit"]').disabled = true;
      wait(RUNNER_SUCCESS_DELAY_MS).then(function () {
        state.sending = false;
        state.pendingPayload = null;
        mobileRunnerSuccess(state);
      });
      try {
        keepSendingInBackground(sendMobileRunner(state));
      } catch (error) {
        keepSendingInBackground(Promise.reject(error));
      }
    };
    root.querySelector('#runner-form').addEventListener('submit', function (event) {
      event.preventDefault();
      if (!state.sending) state.submit();
    });
    root.querySelector('#runner-items').addEventListener('click', function (event) {
      var button = findAncestor(event.target, '[data-quantity-step]', this);
      var row;
      var input;
      var next;
      if (!button) return;
      row = findAncestor(button, '[data-article]', this);
      input = quantityInputFor(row, 'data-runner-article');
      next = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(button.getAttribute('data-quantity-step'), 10));
      input.value = String(next);
      state.amounts[row.getAttribute('data-article')] = next;
    });
    root.querySelector('#runner-items').addEventListener('input', function (event) {
      var input = findAncestor(event.target, '[data-runner-article]', this);
      if (input) state.amounts[input.getAttribute('data-runner-article')] = input.value;
    });
    root.querySelector('#runner-success').addEventListener('click', function (event) {
      var action = findAncestor(event.target, '[data-action="runner-new"]', this);
      if (!action) return;
      state.amounts = {};
      state.entries = [];
      this.hidden = true;
      root.querySelector('#runner-form').hidden = false;
      root.querySelector('#runner-form button[type="submit"]').disabled = false;
      mobileRunnerRows(state);
      root.querySelector('#runner-destination').focus();
    });
  }

  function mobileEndSuccess(state, response) {
    var success = state.root.querySelector('#end-success');
    success.innerHTML = '<h2>Eindtelling opgeslagen</h2><p>' + escapeHtml(String(response.writtenCount || 0)) + ' aantallen opgeslagen voor ' + escapeHtml(state.container) + '.</p><div class="inventory-success__actions"><button class="inventory-primary-button" type="button" data-action="end-new">Nieuwe eindtelling</button></div>';
    state.root.querySelector('#end-form').hidden = true;
    success.hidden = false;
    setStatus(state.root, '');
  }

  function initEndMobile(root, route, items) {
    var state = {
      root: root,
      container: route.container,
      items: items,
      name: savedInventoryName(),
      teller: savedInventoryName(),
      counts: [],
      pendingPayload: null,
      pendingSubmit: false,
      sending: false
    };
    root.innerHTML = mobileEndShell();
    displayContainer(root, route.container);
    mobileEndRows(state);
    state.openNameDialog = setupInventoryName(root, state);
    state.submit = function () {
      if (!state.name) {
        state.pendingSubmit = true;
        state.openNameDialog();
        return;
      }
      try {
        state.counts = collectEndCounts(state);
      } catch (error) {
        setStatus(root, error.message, 'error');
        return;
      }
      state.teller = state.name;
      state.sending = true;
      root.querySelector('#end-form button[type="submit"]').disabled = true;
      sendEndCount(state).then(function (response) {
        state.sending = false;
        state.pendingPayload = null;
        mobileEndSuccess(state, response);
      }).catch(function (error) {
        state.sending = false;
        root.querySelector('#end-form button[type="submit"]').disabled = false;
        setStatus(root, error.message || 'De eindtelling kon niet worden opgeslagen.', 'error');
      });
    };
    root.querySelector('#end-form').addEventListener('submit', function (event) {
      event.preventDefault();
      if (!state.sending) state.submit();
    });
    root.querySelector('#end-items').addEventListener('click', function (event) {
      var button = findAncestor(event.target, '[data-quantity-step]', this);
      var row;
      var input;
      var current;
      if (!button) return;
      row = findAncestor(button, '[data-article]', this);
      input = quantityInputFor(row, 'data-end-article');
      current = asString(input.value);
      input.value = String(Math.max(0, (current ? parseInt(current, 10) : 0) + parseInt(button.getAttribute('data-quantity-step'), 10)));
    });
    root.querySelector('#end-success').addEventListener('click', function (event) {
      var action = findAncestor(event.target, '[data-action="end-new"]', this);
      if (!action) return;
      this.hidden = true;
      root.querySelector('#end-form').hidden = false;
      root.querySelector('#end-form button[type="submit"]').disabled = false;
      Array.prototype.forEach.call(root.querySelectorAll('[data-end-article]'), function (input) { input.value = ''; });
    });
  }

  function initRoute(root, route) {
    if (route.kind === 'runner') {
      if (!route.container) {
        routeError(root, 'Koelcontainer ontbreekt', 'Open de runnerpagina via de QR-code van een specifieke koelcontainer.');
        return;
      }
      root.innerHTML = '<div class="inventory-loading" role="status">Laden...</div>';
      loadBootstrap(root, route, function (items) {
        initRunnerMobile(root, route, items);
      });
      return;
    }
    if (route.kind === 'eindtelling') {
      if (!route.container) {
        routeError(root, 'Koelcontainer ontbreekt', 'Open de eindtellingspagina via de QR-code van een specifieke koelcontainer.');
        return;
      }
      root.innerHTML = '<div class="inventory-loading" role="status">Laden...</div>';
      loadBootstrap(root, route, function (items) {
        initEndMobile(root, route, items);
      });
      return;
    }
    if (route.kind === 'landing') return;
    routeError(root, 'Pagina niet gevonden', 'Deze URL hoort niet bij de inventorymodule.');
  }

  function init() {
    var root = document.getElementById('inventory-app');
    var route;
    if (!root) return;
    route = resolveRoute();
    if (root.getAttribute('data-inventory-page') === 'landing') {
      initQrScanner(root);
      return;
    }
    initRoute(root, route);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

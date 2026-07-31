(function () {
  'use strict';

  var callbackCount = 0;
  var loadPromise = null;
  var DAY_MS = 24 * 60 * 60 * 1000;

  function asString(value) {
    return value == null ? '' : String(value).trim();
  }

  function cellValue(cell) {
    if (!cell) return '';
    if (typeof cell.f === 'string') return cell.f;
    return cell.v == null ? '' : cell.v;
  }

  function isTrue(value) {
    return value === true || /^(true|yes|1|published|enabled)$/i.test(asString(value));
  }

  function parseNumber(value, fallback) {
    var number = parseInt(asString(value), 10);
    return isNaN(number) ? fallback : number;
  }

  function parseDateParts(dateIso) {
    var match = asString(dateIso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10) - 1,
      day: parseInt(match[3], 10)
    };
  }

  function parseTime(value) {
    var match = asString(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
  }

  function eventEndDate(event) {
    var parts = parseDateParts(event && event.dateIso);
    var end = parseTime(event && event.endTime) || parseTime(event && event.startTime) || { hours: 23, minutes: 59 };
    var start = parseTime(event && event.startTime);
    var date;

    if (!parts) return null;
    date = new Date(parts.year, parts.month, parts.day, end.hours, end.minutes, 0, 0);
    if (start && (end.hours < start.hours || (end.hours === start.hours && end.minutes <= start.minutes))) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  function ticketingOpen(event, now) {
    var current = now || new Date();
    var open = event && event.ticketingOpen ? new Date(event.ticketingOpen) : null;
    var close = event && event.ticketingClose ? new Date(event.ticketingClose) : null;
    var endDate = eventEndDate(event);

    if (open && !isNaN(open.getTime()) && current < open) return false;
    if (!close || isNaN(close.getTime())) {
      close = endDate ? new Date(endDate.getTime() + DAY_MS) : null;
    }
    return !close || isNaN(close.getTime()) || current <= close;
  }

  function isPast(event, now) {
    var endDate = eventEndDate(event);
    return !!(endDate && endDate.getTime() < (now || new Date()).getTime());
  }

  function splitUrls(value) {
    return asString(value).split('|').map(function (url) {
      return url.trim();
    }).filter(Boolean);
  }

  function headerKey(value) {
    return asString(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  function loadRows(config) {
    return new Promise(function (resolve, reject) {
      var callbackName = 'invitesSheetCallback' + (++callbackCount);
      var script = document.createElement('script');
      var endpoint = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(config.sheetId) + '/gviz/tq';
      var query = 'sheet=' + encodeURIComponent(config.sheetName || 'INVITES') + '&tqx=' + encodeURIComponent('out:json;responseHandler:' + callbackName);
      var timeout = window.setTimeout(function () {
        cleanup();
        reject(new Error('The INVITES sheet did not respond in time.'));
      }, 10000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function (response) {
        var table = response && response.table;
        var columns = table && table.cols ? table.cols.map(function (column, index) {
          return headerKey(column.label || column.id || ('column_' + index));
        }) : [];

        cleanup();
        if (!table || response.status !== 'ok') {
          reject(new Error('The INVITES sheet returned an invalid response.'));
          return;
        }

        resolve((table.rows || []).map(function (row) {
          var cells = row.c || [];
          var result = {};
          columns.forEach(function (column, index) {
            result[column] = cellValue(cells[index]);
          });
          return result;
        }));
      };

      script.onerror = function () {
        cleanup();
        reject(new Error('The INVITES sheet could not be loaded.'));
      };
      script.src = endpoint + '?' + query;
      document.head.appendChild(script);
    });
  }

  function normalize(rows) {
    var events = [];
    var byId = new Map();

    rows.forEach(function (row) {
      var id = asString(row.event_id);
      var event;
      var ticketId;

      if (!id) return;
      event = byId.get(id);
      if (!event) {
        event = {
          id: id,
          title: asString(row.title),
          publish: isTrue(row.publish),
          dateIso: asString(row.date_iso),
          dateLabel: asString(row.date_label),
          startTime: asString(row.start_time),
          endTime: asString(row.end_time),
          location: asString(row.location),
          address: asString(row.address),
          heroImage: asString(row.hero_image_url),
          galleryImages: splitUrls(row.gallery_image_urls),
          introMarkdown: asString(row.intro_markdown),
          detailsMarkdown: asString(row.details_markdown),
          programmeMarkdown: asString(row.programme_markdown),
          practicalMarkdown: asString(row.practical_markdown),
          ticketingOpen: asString(row.ticketing_open),
          ticketingClose: asString(row.ticketing_close),
          ticketPdf: asString(row.ticket_pdf_url),
          inviteOnly: isTrue(row.invite_only),
          ticketTypes: []
        };
        byId.set(id, event);
        events.push(event);
      }

      ticketId = asString(row.ticket_id);
      if (ticketId && isTrue(row.ticket_enabled)) {
        event.ticketTypes.push({
          id: ticketId,
          name: asString(row.ticket_name),
          descriptionMarkdown: asString(row.ticket_description_markdown),
          price: asString(row.ticket_price) || 'Free',
          max: Math.max(0, parseNumber(row.ticket_max, 0))
        });
      }
    });

    return events;
  }

  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = loadRows(window.TZ_INVITES_CONFIG || {})
      .then(normalize)
      .catch(function (error) {
        loadPromise = null;
        throw error;
      });
    return loadPromise;
  }

  function escapeHtml(value) {
    return asString(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function inlineMarkdown(value) {
    var escaped = escapeHtml(value);
    var tokens = [];
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
      var token = '___INVITE_LINK_' + tokens.length + '___';
      tokens.push('<a href="' + url + '" target="_blank" rel="noreferrer">' + label + '</a>');
      return token;
    });
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
    tokens.forEach(function (token, index) {
      escaped = escaped.replace('___INVITE_LINK_' + index + '___', token);
    });
    return escaped;
  }

  function renderMarkdown(value) {
    var lines = asString(value).split(/\r?\n/);
    var html = [];
    var listOpen = false;

    function closeList() {
      if (listOpen) {
        html.push('</ul>');
        listOpen = false;
      }
    }

    lines.forEach(function (line) {
      var text = line.trim();
      var match;
      if (!text) {
        closeList();
        return;
      }
      match = text.match(/^[-*]\s+(.+)$/);
      if (match) {
        if (!listOpen) {
          html.push('<ul>');
          listOpen = true;
        }
        html.push('<li>' + inlineMarkdown(match[1]) + '</li>');
        return;
      }
      closeList();
      match = text.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        html.push('<h' + (match[1].length + 2) + '>' + inlineMarkdown(match[2]) + '</h' + (match[1].length + 2) + '>');
        return;
      }
      html.push('<p>' + inlineMarkdown(text) + '</p>');
    });

    closeList();
    return html.join('');
  }

  function formatDateBadge(dateIso, dateLabel) {
    var date = parseDateParts(dateIso);
    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    if (!date) return '<span class="invite-date-badge__label">' + escapeHtml(dateLabel) + '</span>';
    return '<span class="invite-date-badge__month">' + months[date.month] + '</span><span class="invite-date-badge__day">' + date.day + '</span>';
  }

  window.TZInvites = {
    load: load,
    escapeHtml: escapeHtml,
    escapeAttribute: escapeAttribute,
    renderMarkdown: renderMarkdown,
    formatDateBadge: formatDateBadge,
    isPast: isPast,
    isTicketingOpen: ticketingOpen,
    eventEndDate: eventEndDate
  };
})();

---
layout: ticketing
title: Reservation Confirmed
permalink: /ticket-confirmation/
hide_navbar: true
---

<!-- Webhook config injected at build time from _config.yml -->
<script>
window.TZ_WEBHOOK_URL   = {{ site.ticketing_webhook_url   | default: '' | jsonify }};
window.TZ_WEBHOOK_TOKEN = {{ site.ticketing_webhook_token | default: '' | jsonify }};
</script>

<div class="tz-shop" id="tz-confirmation-app">
  <!-- content rendered by JS -->
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

<script>
(function() {
  var confirmed = JSON.parse(sessionStorage.getItem('tz_confirmed') || 'null');

  if (!confirmed) {
    document.getElementById('tz-confirmation-app').innerHTML =
      '<p class="tz-error">No confirmed reservation found. <a href="/events/">Start over</a></p>';
    return;
  }

  var event    = confirmed.event;
  var selection = confirmed.selection;
  var details  = confirmed.details;
  var orderId  = confirmed.orderId;
  var syncKey  = 'tz_sheet_sync_' + orderId;
  var syncNoticeEl;
  var syncTitleEl;
  var syncTextEl;
  var syncRetryBtn;

  var totalTickets = selection.reduce(function(a, s) { return a + s.count; }, 0);

  // Render confirmation
  var ticketItems = selection.map(function(s) {
    return '<div class="tz-confirm__ticket-item">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon tz-confirm__ticket-icon"><path d="M10.5 18.75a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" /><path fill-rule="evenodd" d="M8.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h6.75c1.035 0 1.875-.84 1.875-1.875V3.375c0-1.036-.84-1.875-1.875-1.875h-6.75zM9.75 7.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" clip-rule="evenodd" /></svg>' +
      '<div class="tz-confirm__ticket-info">' +
        '<span class="tz-confirm__ticket-name">' + escHtml(details.firstName + ' ' + details.lastName) + '</span>' +
        '<span class="tz-confirm__ticket-type">' + escHtml(s.name) + '</span>' +
        '<span class="tz-confirm__ticket-count">(' + s.count + (s.count === 1 ? ' ticket' : ' tickets') + ')</span>' +
      '</div>' +
      '<button class="tz-btn tz-btn--download" data-name="' + escAttr(s.name) + '" data-count="' + s.count + '">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="tz-icon"><path fill-rule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd" /></svg>' +
        ' Download ticket' +
      '</button>' +
    '</div>';
  }).join('');

  document.getElementById('tz-confirmation-app').innerHTML =
    '<div class="tz-confirm">' +
      '<div class="tz-confirm__success-icon">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" /></svg>' +
      '</div>' +
      '<h1 class="tz-confirm__title">Reservation confirmed!</h1>' +
      '<p class="tz-confirm__subtitle">Your ' + totalTickets + ' ticket' + (totalTickets !== 1 ? 's' : '') + ' for <strong>' + escHtml(event.title) + '</strong> have been reserved.</p>' +
      '<p class="tz-confirm__order-id">Order reference: <strong>' + escHtml(orderId) + '</strong></p>' +
      '<div class="tz-sync-notice tz-sync-notice--pending" id="tz-sync-notice" aria-live="polite">' +
        '<div class="tz-sync-notice__copy">' +
          '<span class="tz-sync-notice__title" id="tz-sync-title">Saving your reservation to the registration sheet...</span>' +
          '<span class="tz-sync-notice__text" id="tz-sync-text">Keep this page open for a moment while we sync your order.</span>' +
        '</div>' +
        '<button type="button" class="tz-btn tz-btn--secondary tz-sync-notice__retry" id="tz-sync-retry-btn" hidden>Retry</button>' +
      '</div>' +

      '<div class="tz-confirm__event-summary">' +
        '<div class="tz-confirm__event-date">' + formatDateBadge(event.date) + '</div>' +
        '<div class="tz-confirm__event-info">' +
          '<strong>' + escHtml(event.title) + '</strong>' +
          (event.invite_only ? '<div class="tz-event-card__flag">Invite only</div>' : '') +
          '<span>' + escHtml(event.date) + ' &bull; ' + escHtml(event.time) + '</span>' +
          '<span>' + escHtml(event.location) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="tz-confirm__tickets">' +
        '<h3 class="tz-overview__section-title">Your tickets</h3>' +
        ticketItems +
      '</div>' +

      '<a href="/events/" class="tz-btn tz-btn--secondary tz-confirm__new-order">Order more tickets</a>' +
    '</div>';

  syncNoticeEl = document.getElementById('tz-sync-notice');
  syncTitleEl = document.getElementById('tz-sync-title');
  syncTextEl = document.getElementById('tz-sync-text');
  syncRetryBtn = document.getElementById('tz-sync-retry-btn');

  syncRetryBtn.addEventListener('click', function() {
    syncReservation(confirmed, true);
  });

  initializeSyncStatus();

  // Wire up download buttons
  document.querySelectorAll('.tz-btn--download').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var ticketName = btn.dataset.name;
      var count = parseInt(btn.dataset.count, 10);

      // If a custom PDF exists for this event, link to it
      if (event.pdf) {
        var link = document.createElement('a');
        link.href = event.pdf;
        link.download = '';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Otherwise generate a PDF in-browser using jsPDF
      generateTicketPDF(event, details, ticketName, count, orderId);
    });
  });

  function generateTicketPDF(ev, det, ticketType, count, orderId) {
    var jsPDF = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || (window.jspdf && window.jspdf.jsPDF));
    if (!jsPDF) { alert('PDF library not loaded. Please try again.'); return; }

    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();

    // Header band
    doc.setFillColor(16, 72, 144);
    doc.rect(0, 0, pageW, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(ev.title, 20, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(ev.date + '   ' + ev.time, 20, 28);
    doc.text(ev.location, 20, 35);

    // Ticket body
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TICKET', 20, 60);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    var rows = [
      ['Ticket type',    ticketType],
      ['Quantity',       String(count)],
      ['Name',           det.firstName + ' ' + det.lastName],
      ['Order ref.',     orderId]
    ];
    if (det.email) rows.splice(3, 0, ['Email', det.email]);
    if (det.city) rows.splice(det.email ? 4 : 3, 0, ['City', det.city]);
    if (det.dateOfBirth) rows.push(['Date of birth', det.dateOfBirth]);
    if (det.notes) rows.push(['Notes', det.notes]);

    var y = 72;
    rows.forEach(function(row) {
      doc.setFont('helvetica', 'bold');
      doc.text(row[0], 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(row[1], 80, y);
      y += 9;
    });

    // Border around ticket area
    doc.setDrawColor(16, 72, 144);
    doc.setLineWidth(0.5);
    doc.rect(12, 48, pageW - 24, y - 44);

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Generated by stanbrouwer.com  |  ' + new Date().toLocaleDateString(), 20, 280);

    var filename = ev.id + '-' + ticketType.toLowerCase().replace(/\s+/g,'-') + '.pdf';
    doc.save(filename);
  }

  function initializeSyncStatus() {
    var url = window.TZ_WEBHOOK_URL;
    var state = getSyncState();

    if (!url) {
      renderSyncNotice('unconfigured');
      return;
    }

    if (state === 'sent') {
      renderSyncNotice('sent');
      return;
    }

    if (state === 'failed') {
      renderSyncNotice('failed');
      return;
    }

    syncReservation(confirmed);
  }

  function syncReservation(data, force) {
    var url = window.TZ_WEBHOOK_URL;
    if (!url) {
      renderSyncNotice('unconfigured');
      return;
    }

    if (getSyncState() === 'sent' && !force) {
      renderSyncNotice('sent');
      return;
    }

    renderSyncNotice('pending');
    postToGoogleSheets(data)
      .then(function() {
        setSyncState('sent');
        renderSyncNotice('sent');
      })
      .catch(function(err) {
        setSyncState('failed');
        renderSyncNotice('failed');
        console.warn('[ticketing] Could not reach webhook:', err);
      });
  }

  function postToGoogleSheets(data) {
    var url   = window.TZ_WEBHOOK_URL;
    var token = window.TZ_WEBHOOK_TOKEN;
    if (!url) {
      return Promise.resolve();
    }

    var totalTickets = data.selection.reduce(function(sum, ticket) {
      return sum + ticket.count;
    }, 0);

    var payload = {
      token:         token,
      timestamp:     data.timestamp,
      orderId:       data.orderId,
      eventId:       data.event.id,
      eventTitle:    data.event.title,
      eventDate:     data.event.date,
      eventTime:     data.event.time,
      eventLocation: data.event.location,
      firstName:     data.details.firstName,
      lastName:      data.details.lastName,
      email:         data.details.email || '',
      city:          data.details.city || '',
      dateOfBirth:   data.details.dateOfBirth || '',
      notes:         data.details.notes || '',
      totalTickets:  totalTickets,
      tickets:       data.selection.map(function(s) {
        return { name: s.name, count: s.count };
      })
    };

    // Use no-cors so the browser doesn't block the cross-origin POST.
    // We can't read the response in this mode, but the data is delivered.
    return fetch(url, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload)
    });
  }

  function getSyncState() {
    try {
      return localStorage.getItem(syncKey);
    } catch (err) {
      return null;
    }
  }

  function setSyncState(state) {
    try {
      localStorage.setItem(syncKey, state);
    } catch (err) {
      console.warn('[ticketing] Could not persist sync state:', err);
    }
  }

  function renderSyncNotice(state) {
    var title = '';
    var text = '';
    var showRetry = false;

    if (!syncNoticeEl || !syncTitleEl || !syncTextEl || !syncRetryBtn) {
      return;
    }

    if (state === 'sent') {
      title = 'Saved to the registration sheet';
      text = 'Your reservation details were synced successfully.';
    } else if (state === 'failed') {
      title = 'Could not save to the registration sheet';
      text = 'Your reservation is still confirmed. Retry to send the details again.';
      showRetry = true;
    } else if (state === 'unconfigured') {
      title = 'Registration sheet sync is not configured';
      text = 'The reservation is confirmed, but this site does not have a webhook URL yet.';
    } else {
      state = 'pending';
      title = 'Saving your reservation to the registration sheet...';
      text = 'Keep this page open for a moment while we sync your order.';
    }

    syncNoticeEl.className = 'tz-sync-notice tz-sync-notice--' + state;
    syncTitleEl.textContent = title;
    syncTextEl.textContent = text;
    syncRetryBtn.hidden = !showRetry;
    syncRetryBtn.disabled = state === 'pending';
  }

  function formatDateBadge(dateStr) {
    var d = new Date(dateStr);
    var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return '<span class="tz-date-badge__month">' + months[d.getMonth()] + '</span>' +
           '<span class="tz-date-badge__day">' + d.getDate() + '</span>';
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(str) {
    return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
})();
</script>

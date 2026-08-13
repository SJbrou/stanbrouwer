---
layout: inventory
title: Festival inventory
permalink: /inventory/
---

<main class="inventory-app inventory-app--landing" id="inventory-app" data-inventory-page="landing">
  <header class="inventory-hero">
    <p class="inventory-kicker">FESTIVAL INVENTORY</p>
    <h1>Voorraadregistratie</h1>
    <p class="inventory-lead">Kies de juiste QR-code voor een uitgifte of een eindtelling.</p>
  </header>

  <section class="inventory-landing-links" aria-label="Inventorypagina’s">
    <a class="inventory-action inventory-action--primary" href="{{ '/inventory/runner/' | relative_url }}">
      <span>Runnerregistratie</span>
      <small>Registreer een uitgifte uit een koelcontainer</small>
    </a>
    <a class="inventory-action" href="{{ '/inventory/eindtelling/' | relative_url }}">
      <span>Eindtelling</span>
      <small>Registreer de resterende voorraad</small>
    </a>
  </section>

  <section class="inventory-scanner-launch" aria-labelledby="inventory-scanner-title">
    <button class="inventory-action inventory-action--scan" type="button" data-inventory-scan-open>
      <span id="inventory-scanner-title">QR-code scannen</span>
      <small>Open direct de runner- of eindtellingspagina van een koelcontainer</small>
    </button>
  </section>

  <section class="inventory-scanner" data-inventory-scanner hidden aria-labelledby="inventory-scanner-dialog-title">
    <div class="inventory-scanner__panel" role="dialog" aria-modal="true" aria-labelledby="inventory-scanner-dialog-title">
      <div class="inventory-scanner__header">
        <h2 id="inventory-scanner-dialog-title">Scan de QR-code</h2>
        <button class="inventory-scanner__close" type="button" data-inventory-scan-close aria-label="Scanner sluiten">×</button>
      </div>
      <video class="inventory-scanner__video" data-inventory-scan-video playsinline muted></video>
      <p class="inventory-scanner__status" data-inventory-scan-status role="status" aria-live="polite">Camera starten…</p>
      <div class="inventory-scanner__manual">
        <label class="inventory-field" for="inventory-scan-manual">Of plak de QR-link</label>
        <input id="inventory-scan-manual" type="url" inputmode="url" placeholder="/inventory/runner/KC1" data-inventory-scan-manual>
        <button class="inventory-secondary-button" type="button" data-inventory-scan-open-manual>Open link</button>
      </div>
    </div>
  </section>

  <p class="inventory-footnote">Gebruik de volledige QR-code met de naam van de koelcontainer, bijvoorbeeld KC1.</p>
</main>

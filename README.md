# stanbrouwer

stanbrouwer.com

### Local inventory development

Run `powershell -ExecutionPolicy Bypass -File scripts/serve-local.ps1` and open
`http://127.0.0.1:4000/inventory/runner/KC1/` or
`http://127.0.0.1:4000/inventory/eindtelling/KC1/`.

De artikelcatalogus wordt statisch vanuit `_data/inventory.json` ingeladen;
de pagina hoeft dus niet op Google Sheets te wachten. Localhost gebruikt de
geconfigureerde Apps Script-webapp alleen voor registraties, zodat een test
naar dezelfde spreadsheet schrijft als de live eventsite. To work without
touching the spreadsheet, set
`inventory_local_mode: true` in `_config.yml`; then the module uses sample data
and browser-local storage instead.

## Inventorymodule

De inventorymodule staat onder `/inventory`. De website leest de vaste
artikelcatalogus en containers uit `_data/inventory.json`; het Apps Script
bevat dezelfde catalogus voor validatie en synchroniseert deze bij de setup
naar de spreadsheet. Registraties gebruiken vier tabbladen in de
[publieke prototype-spreadsheet](https://docs.google.com/spreadsheets/d/1Mj4bTKrL3c3SZTG11lMLVYtY1JqzuesiqzIivASQvzY/edit?usp=sharing):

- `Items`: `Artikelnummer`, `Naam`, `Omschrijving`, `Afbeelding`;
- `Beginsituatie`: dezelfde eerste drie kolommen en daarna één kolom per container, bijvoorbeeld `KC1`;
- `Mutaties`: iedere runneruitgifte als nieuwe rij;
- `Eindtelling`: bovenaan een live voorraadmatrix (`product × koelcontainer`), plus onder de hoofdtafel een managementoverzicht met een apart tabelblok per koelcontainer en een tellingenlog. De fysieke tellingen worden afzonderlijk opgeslagen, zodat zij het live voorraadbeeld niet overschrijven.

In ieder overzichtsblok staan de kolommen `Artikelnummer`, `Product`,
`Beginsituatie`, `Eruit gehaald`, `Nog over`, `Eindtelling` en `Verschil`.
Het blok wordt automatisch opnieuw opgebouwd wanneer artikelen of
containerkolommen veranderen; geregistreerde tellingen in het log blijven
behouden.

### Eerste installatie

1. Open de spreadsheet en kies **Extensies → Apps Script**. Maak het script dus
   vanuit deze spreadsheet; dit koppelt de app aan het ene bestand.
2. Plak de inhoud van `inventory_app_script.txt` in het Apps Script-project.
3. Zet in Apps Script via **Projectinstellingen** de manifestweergave aan en
   vervang `appsscript.json` door de inhoud van `inventory_appsscript.json`.
4. Sla alles op en voer één keer `setupInventorySheets()` uit. De toestemming
   hoort nu te verwijzen naar bestanden die deze app gebruikt, niet naar alle
   spreadsheets. Daarnaast wordt toestemming gevraagd voor externe requests.
5. Controleer de gemigreerde `Items`- en `Beginsituatie`-gegevens.
6. Deploy het project als **Web app**, uitgevoerd als jezelf en met openbare toegang.
7. Plak de deployment-URL in `_config.yml` bij `inventory_webapp_url`.
8. Bouw en deploy de Jekyll-site.

De webapp gebruikt de Sheets REST API met de niet-gevoelige `drive.file`-scope.
De eenmalige setup gebruikt daarnaast `spreadsheets.currentonly`, zodat die direct
in de gebonden doelspreadsheet kan werken. Het script gebruikt geen brede
spreadsheetservice en geen Drive-, Gmail- of andere bestandsdiensten. Als Google toch de oude brede
toestemming toont, trek dan eerst de eerdere Apps Script-toestemming in via
Google-account → Beveiliging → Verbindingen met apps van derden en autoriseer
het script opnieuw.

Als de Apps Script-editor meldt dat de Sheets API nog niet is ingeschakeld, open
via **Projectinstellingen** het gekoppelde Google Cloud-project, ga naar
**API's en services → Bibliotheek**, kies **Google Sheets API** en klik op
**Inschakelen**.

De setup-migratie behoudt bestaande product- en beginvoorraadregels. Ontbrekende
artikelnummers krijgen stabiele prototype-ID’s zoals `INV-001`. Nieuwe
containerkolommen worden vanuit `Beginsituatie` automatisch in `Eindtelling`
gesynchroniseerd.

### URL’s en QR-codes

Gebruik per container:

```text
/inventory/runner/KC1
/inventory/eindtelling/KC1
```

Een nieuwe container voeg je toe door dezelfde kolomkop, bijvoorbeeld `KC3`,
aan `Beginsituatie` toe te voegen. De website herkent de container bij de
volgende aanvraag en maakt de kolom in `Eindtelling` automatisch beschikbaar.

### Testflow

1. Zet minimaal drie artikelen en twee containerkolommen klaar.
2. Open een runner-URL op mobiel of desktop.
3. Selecteer een artikel, vul aantal en bestemmingsbar in en verzend.
4. Controleer dat precies één nieuwe rij in `Mutaties` staat.
5. Open de eindtellings-URL, vul waarden in waarbij één veld leeg blijft en één veld `0` is.
6. Controleer de telling in de juiste containerkolom en bekijk het overzicht onderaan `Eindtelling`.
7. Test ook een onbekende container, een decimaal aantal en dubbel klikken op verzenden.

### Prototypewaarschuwing

Deze versie gebruikt een openbare Apps Script-webapp zonder gebruikersauthenticatie.
De backend gebruikt een bestandsscope voor de gekoppelde spreadsheet, maar iedere
bezoeker kan de openbare endpoints aanroepen. Voeg vóór productiegebruik
authenticatie, autorisatie, rate limiting en een gecontroleerde auditlaag toe.

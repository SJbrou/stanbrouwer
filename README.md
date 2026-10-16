# stanbrouwer

stanbrouwer.com

The main site uses the welcome frame animation for opening and closing media
windows. Moving between rows and sections updates the same open preview, keeping
its size and position. Leaving a row keeps its last media visible. Reverse
welcome scrolling contracts transient previews.
A started music player stays connected across internal project, invite, and
ticket pages, including Back and Forward navigation. URLs remain the normal page
paths. Reservation pages use the existing session drafts and live booking flow.

Run `node scripts/check-collection-windows.cjs` against a local Jekyll server for
desktop/mobile checks with fixture feeds, audio, and a stubbed reservation endpoint. It never
submits a real booking. Screenshots are saved in `docs/collection-window-qa/`.
Set `COLLECTION_ORIGIN` or `COLLECTION_BROWSER_PATH` to use a different local
server or Chromium executable.

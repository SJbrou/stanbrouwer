# stanbrouwer

stanbrouwer.com

## Project details

The public `PROJECTS` sheet supplies date (A), title (B), category (C), image URL
(D), optional external link (E), and description (F). Descriptions support simple
Markdown: paragraphs, headings, emphasis, ordered/unordered lists, and HTTP(S)
links. Raw HTML is displayed as text. Column F is excluded from the homepage list.

Projects with descriptions open `/projects/?project=<title-slug>`. Titles must
produce unique slugs; renaming a project changes its URL. `/projects/` lists
available detail pages. The default design is Modular Plate, with date/category
values and the optional external link in the navigation bar above the title.
The image sits beside the title inside the content panel without a caption or
window frame. Horizontal rules below the header are omitted.
Selected SoundCloud audio keeps playing in its
existing media window through page transitions, with playback controls available.

Compare Editorial Sheet, Split Dossier, and Modular Plate at
`/projects/design-preview/`. This preview includes sample content, live sheet
projects, and a button to replay the square transition. Layout controls appear
only in the preview.

Start a Windows preview with `./scripts/serve-local.ps1` (port 4000). The local
configuration disables the unused fallback theme; deployment keeps its existing
configuration. Set `PROJECT_PREVIEW_URL` to `http://127.0.0.1:4000`, then run
`node scripts/check-project-details.cjs` for browser acceptance checks.
The script uses Playwright; `PLAYWRIGHT_MODULE`,
`CHROMIUM_PATH`, and `PROJECT_PREVIEW_URL` can point to an existing installation,
browser executable, and preview URL (default `http://127.0.0.1:4317`). Screenshots
are written to the ignored `docs/project-details-check/` directory.

The homepage welcome opens automatically in about 1.2 seconds without scrolling
the document. Scrolling then expands its frame into the collection over 75svh
(360–720px). The frame follows viewport geometry, so loading additional rows
cannot resize it mid-transition. The handover finishes sizing in its first 80%,
then crossfades PERSPECTIVE into the collection over the final 20%. Reversal hides
the collection before contracting. Input finishes the opening; reduced motion and
asset failures show the static page.
After reaching the collection, scrolling back up reverses the full entrance into
the perspective opening. Scrolling down opens it again over the same scroll
range: 10% for the grid, 40% for the large panel, and 50% for the reading view.
Each stage softens its first and last 10% while the middle follows scroll evenly;
motion stops when the scroll position stops changing. This state survives history
navigation and reloads without replaying the initial autoplay.

Run `node scripts/check-welcome.cjs` against the local preview (port 4000 by
default). It accepts the same browser and preview URL overrides described above.
The checks cover perspective alignment, delayed content, short feeds, interrupted
playback, resizing, static fallbacks, and history restoration. Screenshots go to
the ignored `docs/welcome-check/` directory.

Perspective footers stay in normal page flow with the same responsive paper
overlap: `min(9.5rem, 12vw)`. Short detail pages reserve room for the grid at the
viewport bottom; long content pushes its footer down. Event and booking papers
grow with their complete content and use document scrolling, retaining a 32rem
minimum height. The project grid persists through loading, retries, and content
replacement.
Navigation keeps one grid behind the moving paper whenever the outgoing footer
is visible. It stays still during contraction and the hold, then follows the
destination's geometry during expansion. Aligned footers hand over without
fading or jumping; long-page footers move naturally below view. An off-screen
source never introduces a grid during departure. Missing images do not delay
navigation, and document scroll locking preserves the page width.

Collection and booking navigation share the viewport snapshot renderer in
`assets/js/collection-transition.js`. Booking keeps its 480ms point contraction,
160ms hold and 600ms expansion without scaling the live full-height document.
Forward booking actions start at the top; history restores each entry's saved
document position, including direct loads. Pending content, fonts and images reserve
enough height to avoid clamping, and user input cancels delayed restoration.

Run `node scripts/check-footer.cjs` after building the preview. It uses local
event and project fixtures and the browser overrides above. Checks cover desktop
and mobile visibility, continuous grids, direct versus animated page layouts,
history, missing/slow images, reduced motion, resizing, and layer cleanup.
Screenshots go to the ignored `docs/footer-check/` directory.

Run `node scripts/check-invites.cjs` for full-length events, the booking journey,
per-entry scroll restoration, validation, interrupted motion and responsive preview
layouts. `--preview-only` checks just the local design examples.

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

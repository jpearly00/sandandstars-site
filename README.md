# sandandstars-site

Public-facing site for **Sand & Stars Touring** (`sandandstars.com`). Static HTML/CSS/JS — no build tools, no frameworks, no npm. Each page is self-contained (HTML + inline CSS + inline JS) so any Claude session can read and modify it directly.

## Status

- **Phase:** Phase 1 — launching booking surface at `book.sandandstars.com` (Cloudflare Pages subdomain). Wix remains on the apex during transition.
- **Primary page:** `index.html` (tour browse + booking shell).
- **Admin app (separate repo):** `jpearly00/sst-tour-hub` — GAS webapp, not part of this site.

## Deploy

1. Cloudflare Pages → Create project → connect this repo.
2. Build command: *(none)* — static.
3. Build output directory: `/` (repo root).
4. Custom domain: `book.sandandstars.com` (CNAME `book` → `<project>.pages.dev`).
5. Apex (`sandandstars.com`) stays on Wix until full cutover (Phase 3 of `wix_replacement_plan.md`).

`_redirects` blocks `/_garage/*` from public access.

## Structure

```
/
├── index.html              # Tour browse + booking page (was SST_Tours_Browse_v2.html)
├── tour_pics/              # Hero imagery per tour
│   └── sm/                 # Small/card versions
├── _garage/                # Retired content — NOT public
├── _redirects              # Cloudflare Pages routing
├── _headers                # Cloudflare Pages headers
├── .gitignore
└── README.md
```

## Tours shipped

arches, archescombo, castle, deadhorse, dino, isky, localgems, maze, mill, needles, night, rockart. Each has a `tour_pics/<name>.jpg` + `tour_pics/sm/<name>.jpg` (or `.jpeg` for mill).

**Note:** `archescombo.jpg` is currently a placeholder copy of `arches.jpg` until a proper combo-shot is sourced.

## Rules of the house

- **No build tools.** No npm. No bundlers. No frameworks.
- **Inline everything.** Each page is self-contained. Copy-paste consistency across pages is fine — it's the cost of no shared files.
- **Tour data never hardcoded.** Live pricing + availability reads from the Tour Hub GAS endpoint (TBD for Phase 2).
- **Retire, don't delete.** Everything pulled from live goes to `_garage/` (see its README).
- **Design system** inherited from Browse V2: Fraunces + Inter, slate/ember palette.

## Known follow-ups

- Mobile audit: BUG-1 rover, BUG-4 Arches Alt image grid, LAYOUT-1 hamburger nav, LAYOUT-2/3/4 touch targets, UX-1 through UX-5, SUG-1 through SUG-5. See `WORK/SST/LANES/LN_SS_SITE/WORKSETS/WSET_MOBILE_AUDIT_260411/HANDOFF_Mobile_Audit_v2_Browse.md`.
- Wire Tour Hub GAS JSON endpoint for live pricing/availability.
- Source real archescombo.jpg.
- Phase 2: `booking.html`, `tours.html`, `about.html`, `contact.html`.

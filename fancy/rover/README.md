# Rover — Booking UI Scaffold

Rover is the top-bar itinerary builder on `book.sandandstars.com`. It lets a
shopper assemble a multi-day trip (tours added to a cart bar at the top of
the site), see live availability, and check out. This folder is the Phase 0
scaffold — modules load, verify wiring, and stub out what the real UI will
plug into later.

Spec: `WORK/SS/WORKSETS/WSET_Rover_WISH_260415/Rover_WISH_260415.md`
Changelog: `WORK/SS/WORKSETS/WSET_Rover_WISH_260415/CHANGELOG.md`
Build log: `BUILD_LOG.md` in this folder.

## File layout

```
fancy/rover/
├── index.html                     # Phase 0 shell — module load verification
├── css/
│   └── rover.css                  # Dark canyon + ember base styles
├── js/
│   ├── analytics.js               # Event emitter (in-memory buffer, no tracking)
│   ├── dynamic-field-reader.js    # Schema-flexible wrapper for avail-governance
│   ├── default-inventory.js       # 1 AM OR 1 PM OR 1 full-day / day default
│   ├── avail-reader.js            # Unified availability API (fixture → default fallback)
│   ├── contest-detector.js        # ±3-day pairwise concurrent-shopper detection (W-R13)
│   └── test-palette.js            # W-R08 dev panel (enabled via ?palette=1)
├── fixtures/
│   ├── avail-governance-mock.json # 2-month deterministic availability fixture
│   └── mock-carts.json            # Test scenarios for contest-detector
├── tests/
│   └── README.md                  # Test plan (Playwright smoke + unit notes)
├── BUILD_LOG.md                   # Per-file build history (code-level)
└── README.md                      # This file
```

## Read order (for new contributors)

1. Top of the wset doc for context and scope.
2. `index.html` — see how modules wire.
3. `js/default-inventory.js` — the ground-truth default.
4. `js/dynamic-field-reader.js` — how we tolerate future spreadsheet schema.
5. `js/avail-reader.js` — how availability is queried.
6. `js/contest-detector.js` — how concurrent-shopper warnings fire.

## Conventions

- **No frameworks.** Vanilla JS, IIFEs exposing a single frozen global
  object per module. Plays nice with GitHub Pages + the existing `fancy/`
  tree — no bundler step.
- **No localStorage / sessionStorage.** Per W-R06 (no tracking) + the session
  analytics pattern. Everything in-memory per tab.
- **Schema-flexible.** Never throw on a new field from the avail-governance
  spreadsheet. Log it via `analytics.track('avail_schema_unknown_field', …)`.
- **Analytics event names:** `snake_case`, verb-noun form. See `js/analytics.js`
  header for the canonical list.
- **Test palette on demand only.** Append `?palette=1` to the URL to inject
  the dev panel. Never ships enabled.

## Running locally

Because this is static HTML, any static server works:

```bash
cd fancy
python3 -m http.server 8080
# then open http://localhost:8080/rover/
```

On live GitHub Pages the URL will be `https://book.sandandstars.com/rover/`.

## What's intentionally missing in Phase 0

- Real cart UI (top-bar itinerary builder) — specced, not built.
- Real backend — the six GAS endpoints in the wset r4 appendix are stubbed
  separately under `App/SST_Cart_State_v0.js` in the SST Tours@ Claude Master
  project.
- Payment / Square integration — gated behind last-second confirm + payment
  queue (W-R13). Not this phase.
- W-R07 empty state — placeholder only. Real copy ships with the cart UI.

## When the spreadsheet lands

`avail-reader.js` will switch its primary source from the JSON fixture to
the GAS endpoint `/avail/:date_range`. The dynamic field reader is already
in the path — any new governance columns will be tolerated automatically
and logged for the Rover team to wire into UI when appropriate.

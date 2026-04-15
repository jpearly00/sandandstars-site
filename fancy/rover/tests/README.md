# Rover — Test Plan

Phase 0 ships scaffolding only. This folder will hold Playwright specs as
phases advance. For now it documents the test surface so later phases
aren't inventing from scratch.

## Smoke (Phase 0)

Manual + Playwright:
1. Load `/rover/` on book.sandandstars.com.
2. Expect all six module status lines = `loaded` / `ready`.
3. Expect `avail source` = `fixture-url` (mock JSON fetched successfully).
4. Expect `sample day` line to populate with offered/booked/cart/avail counts.
5. Append `?palette=1`. Expect dev panel bottom-right.
6. Click each scenario button, expect PASS lines in the panel log.
7. Click "Dump events". Expect >0 event names in log.

## Unit (once extracted)

- `contest-detector.detect(carts)` on each fixture scenario → match
  `expected_contested` and `expected_pairs`.
- `dynamic-field-reader.wrap(x).get('unknown', fallback)` → returns fallback
  and fires `avail_schema_missing_field` exactly once per (scope, key).
- `avail-reader.getDay('2026-05-10')` (blackout day) → `blackout: true`,
  `slots_available: 0`.

## Integration (later phases)

- `/avail/:range` GAS endpoint returns governed availability.
- Add-to-cart emits `rover_tour_added` with correct payload.
- Checkout banner renders on `cart_contest_detected`.
- Last-second confirm modal appears pre-charge with NO countdown.
- Payment queue serializes conflicting attempts on the same slot.

## How to add a test

Until Playwright is wired, add expected-output JSON under
`fixtures/mock-carts.json` and a new button in `js/test-palette.js`.
Every fixture scenario pairs `expected_contested` + optional
`expected_pairs` so the palette can PASS/FAIL automatically.

# Website Reviews Refresh — Method Doc

**Purpose:** Keep Google + TripAdvisor review widgets on this site current
without scrapers, API keys, or scheduled jobs.

**Scope:** Any website John owns that displays third-party reviews (Google,
TripAdvisor, Yelp, etc.). Currently: `book.sandandstars.com/fancy/` and
moabcoyote.com / moablunchbox.com.

---

## The Rule

No scrapers. No headless browsers. No Places API. No launchd. No GitHub
Actions. No API keys to rotate. No auth to break.

**On-demand via Rube/Composio MCP. Period.**

## The Method

1. John says "check reviews" (or Claude triggers on monthly cadence, e.g.
   first of the month during any SST/MM maintenance session).
2. Claude calls Rube workbench:
   - Tool: `RUBE_REMOTE_WORKBENCH`
   - Composio tool: `COMPOSIO_SEARCH_GOOGLE_MAPS`
   - Input: `q="<business name> <city>"` (e.g. `"Sand and Stars Touring Moab"`)
3. Rube returns full payload — rating, count, reviews array with author,
   text, rating, relative date, local-guide status.
4. Claude reads the site's current `reviews/google.json` (or equivalent).
5. Diff-check: author list + count + rating.
   - If identical → report "no drift" + bump `fetchedAt` date. Done.
   - If changed → update JSON + any inline `<script>` block in the HTML page
     that hosts the widget, bump `fetchedAt`, commit, push.
6. GitHub Pages / Cloudflare Pages redeploys automatically.

## Why Not X

- **Places API (New) v1.** Requires an API key. Referrer-restricted keys
  blocked by CORS for server-side calls; server-side keys need rotation
  management. Extra infra for data we can get free via Rube.
- **Playwright scraper (local or GH Actions).** Google fingerprints
  Playwright in both headless and non-headless modes and serves a "limited
  view" with no review cards, no tabs. Dead on arrival. Also: needs Node +
  chromium (~93MB) cached somewhere and a scheduler.
- **Cloudflare Workers scheduled fetch.** Same Places-API-key problem plus
  John prefers GitHub (see JOHN_BIBLE).
- **Manual copy-paste from Google Maps.** Works, but Rube is faster and
  returns structured JSON we can diff programmatically.

## Review Payload Shape (Composio → site JSON)

Composio returns roughly:

```json
{
  "place_results": {
    "rating": 5.0,
    "reviews": 5,
    "user_reviews": {
      "most_relevant": [
        {"username": "...", "rating": 5, "date": "a year ago", "description": "..."}
      ]
    }
  }
}
```

Our site JSON shape (`fancy/reviews/google.json`):

```json
{
  "source": "google",
  "business": "Sand and Stars Touring",
  "listingUri": "https://www.google.com/maps/place/?q=place_id:<PLACE_ID>",
  "writeReviewUri": "https://search.google.com/local/writereview?placeid=<PLACE_ID>",
  "rating": 5.0,
  "count": 5,
  "fetchedAt": "YYYY-MM-DD",
  "reviews": [
    {
      "author": "…",
      "location": "Local Guide · N reviews · M photos",
      "title": "",
      "rating": 5,
      "relative": "N year(s) ago",
      "companion": "",
      "text": "…"
    }
  ]
}
```

Mapping rules:
- `username` → `author`
- `description` → `text`
- `rating` → `rating`
- `date` → `relative` (as-is, "a year ago", "3 years ago", etc.)
- `location` — Composio doesn't always return local-guide flag; copy from
  existing JSON if unchanged, drop if a new review has no equivalent.
- `title`, `companion` → empty string (we don't use these in the widget)

## Inline HTML Block

If the page has an inline `<script>` block that duplicates the JSON (for
first-paint speed without a fetch), update it in the same commit. Search
for `source: "google"` in the page to find it.

## Commit Message Template

```
fancy: refresh Google reviews (N reviews, rating X.X)
```

or, if no drift:

```
fancy: bump Google reviews fetchedAt (no new reviews)
```

## Place IDs (Keep Handy)

- Sand and Stars Touring: `ChIJ7wKY8yKu0msRKL3MvmzxDvY`
- Moab Mercantile / Coyote's: `<TBD — add when listing exists>`
- Moab Lunchbox: `<TBD — add when listing exists>`

## History

- 2026-04-14 — Scraper + Playwright + npm manifest torn out after Google
  fingerprinting defeated both headless and non-headless. Rube/Composio
  pattern adopted. Commit `c8a76b5`.

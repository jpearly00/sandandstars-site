# Garage — Retired Stable

This folder holds HTML snippets, images, tours, and experiments that were pulled from the live site but preserved for reference or possible reuse.

## Rules

1. **Never delete.** Everything that leaves the live site comes here.
2. **Keep original markup** for retired tour blocks — paste straight from `index.html` so it's liftable back in with minimal work.
3. **Tag with retirement date** (`YYMMDD`) in the garage entry.
4. **Explain why** it was retired so future-us (or a future session) knows the reason.
5. **Not public.** `_redirects` rewrites `/_garage/*` to 404 on Cloudflare Pages. Local browsing only.

## Structure

```
_garage/
├── garage.html       # Visual gallery — browse retired content in a browser
├── README.md         # This file
├── orphans/          # Imagery pulled from live site
├── tours/            # Retired tour HTML blocks (one .html per tour)
└── experiments/      # UI experiments, layouts, dead-end prototypes
```

## How to add to the garage

1. Move the asset into the appropriate subfolder.
2. Add an entry to `garage.html` in the matching section.
3. Commit with message `garage: retire <name> — <reason>`.

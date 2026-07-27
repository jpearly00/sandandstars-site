#!/usr/bin/env python3
"""
inject_tourpages.py — inject the SST trip block into the 12 per-tour SEO pages.

Usage:
    python3 inject_tourpages.py [SITE_ROOT]

SITE_ROOT defaults to the directory this script lives in. The script expects:
    SITE_ROOT/tourpage_block.html      (the block template, shipped alongside)
    SITE_ROOT/tours/{key}.html         (the 12 tour detail pages)

For each tour page it:
  1. Skips the file entirely if the SST_TRIP_BLOCK marker is already present
     (idempotent — safe to run any number of times).
  2. Inserts the block (with __TOUR_KEY__ / __TOUR_TITLE_BOX__ substituted)
     after the page-hero section, or, failing that, right after <main id="main">.
  3. Adds <link ../assets/trip.css> before </head> and
     <script ../assets/trip.js defer> before </body> (each only if missing).

No external dependencies. Writes files in place.
"""
import os
import re
import sys

KEYS = [
    "arches", "deadhorse", "isky", "mill", "castle", "rockart",
    "localgems", "dino", "archescombo", "needles", "maze", "night",
]

# Server-rendered title-box text = the recommended length's variant name
# (matches the trip engine's defaults: rec lengths per pricing canon).
TITLE_BOX = {
    "arches": "Highlights | Half Day Tour",
    "deadhorse": "Half Day Tour",
    "isky": "Full Day Tour",
    "mill": "Half Day Tour",
    "castle": "Half Day Tour",
    "rockart": "Half Day Tour",
    "localgems": "Half Day Tour",
    "dino": "Half Day Tour",
    "archescombo": "Full Day Tour",
    "needles": "Full Day Tour",
    "maze": "Full Day Tour",
    "night": "Moonlight Walk",
}

MARKER = "SST_TRIP_BLOCK"
CSS_TAG = '<link rel="stylesheet" href="../assets/trip.css">'
JS_TAG = '<script src="../assets/trip.js" defer></script>'


def build_block(template, key):
    return template.replace("__TOUR_KEY__", key).replace(
        "__TOUR_TITLE_BOX__", TITLE_BOX.get(key, "Half Day Tour")
    )


def insertion_point(html):
    """Return index just after the page-hero </section>, else after <main>."""
    hero = re.search(r'<section[^>]*class="[^"]*page-hero[^"]*"', html)
    if hero:
        close = html.find("</section>", hero.end())
        if close != -1:
            return close + len("</section>")
    main = re.search(r"<main[^>]*>", html)
    if main:
        return main.end()
    body = re.search(r"<body[^>]*>", html)
    return body.end() if body else 0


def inject(path, key, template):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    changed = []

    if MARKER in html:
        print(f"  [skip]  {os.path.basename(path)} — block already present")
    else:
        at = insertion_point(html)
        block = "\n\n" + build_block(template, key).strip() + "\n"
        html = html[:at] + block + html[at:]
        changed.append("block")

    if "assets/trip.css" not in html:
        if "</head>" in html:
            html = html.replace("</head>", CSS_TAG + "\n</head>", 1)
            changed.append("css")
    if "assets/trip.js" not in html:
        if "</body>" in html:
            html = html.replace("</body>", JS_TAG + "\n</body>", 1)
            changed.append("js")

    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  [done]  {os.path.basename(path)} — added: {', '.join(changed)}")
    return bool(changed)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(root)
    template_path = os.path.join(root, "tourpage_block.html")
    if not os.path.exists(template_path):
        # allow template next to the script even when SITE_ROOT differs
        alt = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tourpage_block.html")
        if os.path.exists(alt):
            template_path = alt
        else:
            print(f"ERROR: tourpage_block.html not found in {root} or beside the script")
            sys.exit(1)
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    tours_dir = os.path.join(root, "tours")
    print(f"Injecting trip block into {tours_dir}")
    missing, touched = [], 0
    for key in KEYS:
        page = os.path.join(tours_dir, f"{key}.html")
        if not os.path.exists(page):
            missing.append(key)
            continue
        if inject(page, key, template):
            touched += 1
    if missing:
        print(f"  [warn]  missing pages (not yet created?): {', '.join(missing)}")
    print(f"Finished — {touched} file(s) modified, {len(KEYS) - len(missing) - touched} already current, {len(missing)} missing.")


if __name__ == "__main__":
    main()

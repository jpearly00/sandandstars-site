#!/usr/bin/env python3
"""
site_check.py — Sand & Stars Touring site guardrail.
Runs in CI on every push (and locally: `python3 checks/site_check.py`).

HARD fails (exit 1) only on regressions that have actually bitten this site:
  - missing critical assets (og.jpg, favicon.ico, apple-touch-icon.png, sitemap.xml, llms.txt)
WARN only (never fails the build) on:
  - broken internal links, oversized customer-facing images (>600KB), em dashes in copy

Rationale: hard-fail only on certain regressions so John never gets a false-alarm
email; everything else surfaces as a warning in the Actions log.
"""
import os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
hard, warn = [], []

# 1. Critical assets must exist (the og.jpg 404 regression guard).
for a in ["assets/og.jpg", "favicon.ico", "favicon-32.png", "apple-touch-icon.png", "sitemap.xml", "llms.txt", "robots.txt"]:
    if not os.path.isfile(a):
        hard.append(f"MISSING critical asset: {a}")

# Gather HTML pages (root + tours/), skip archives/garage/rover/fancy.
pages = [p for p in glob.glob("*.html") + glob.glob("tours/*.html")
         if not p.startswith(("_", "fancy/"))]

IMG_BUDGET = 600 * 1024
def local_target(href, base_dir):
    if re.match(r'^(https?:|mailto:|tel:|sms:|#|data:)', href):
        return None
    href = href.split("#")[0].split("?")[0]
    if not href:
        return None
    if href.startswith("/"):
        path = href.lstrip("/")
    else:
        path = os.path.normpath(os.path.join(base_dir, href))
    return path

for page in pages:
    base = os.path.dirname(page)
    html = open(page, encoding="utf-8").read()
    # 2. Internal link / asset existence (warn).
    for attr in ("href", "src"):
        for m in re.finditer(attr + r'="([^"]+)"', html):
            tgt = local_target(m.group(1), base)
            if tgt is None:
                continue
            if os.path.isfile(tgt) or os.path.isdir(tgt):
                continue
            # GH Pages serves extensionless: accept X.html or X/index.html
            if os.path.isfile(tgt + ".html") or os.path.isfile(os.path.join(tgt, "index.html")):
                continue
            warn.append(f"{page}: broken {attr} -> {m.group(1)}")
    # 3. Oversized images referenced (warn).
    for m in re.finditer(r'src="([^"]+\.(?:jpg|jpeg|png|webp))"', html, re.I):
        tgt = local_target(m.group(1), base)
        if tgt and os.path.isfile(tgt):
            kb = os.path.getsize(tgt)
            if kb > IMG_BUDGET:
                warn.append(f"{page}: heavy image {m.group(1)} = {kb//1024}KB (budget 600KB)")
    # 4. Em dash in customer copy (warn) — voice rule is zero.
    body = re.sub(r'<script.*?</script>', '', html, flags=re.S)
    body = re.sub(r'<style.*?</style>', '', body, flags=re.S)
    n = body.count("—")
    if n:
        warn.append(f"{page}: {n} em dash(es) in copy (voice rule = none)")

# De-dupe warnings, keep order.
seen = set(); warn = [w for w in warn if not (w in seen or seen.add(w))]

print(f"Checked {len(pages)} pages.\n")
if warn:
    print(f"WARNINGS ({len(warn)}):")
    for w in warn: print("  - " + w)
    print()
if hard:
    print(f"HARD FAILURES ({len(hard)}):")
    for h in hard: print("  - " + h)
    print("\nFAIL")
    sys.exit(1)
print("PASS (no critical-asset regressions)")

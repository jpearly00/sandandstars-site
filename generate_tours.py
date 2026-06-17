#!/usr/bin/env python3
"""
generate_tours.py — Sand & Stars Touring per-tour page generator.

Reads tours.json (source of truth) and emits one static, brand-matched HTML page
per tour into /tours/<slug>.html, each with:
  - TL;DR summary + facts table + body + highlights + FAQ (answer-engine shaped)
  - JSON-LD: TouristTrip + Offer + FAQPage + BreadcrumbList
  - prefilled inquiry CTAs (email / text / call / book)
Also rewrites sitemap.xml to include the 12 tour URLs with today's lastmod.

Run:  python3 generate_tours.py
Edit content in tours.json, never in the generated files.
"""
import json, os, datetime, html, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://sandandstars.com"
TODAY = datetime.date.today().isoformat()

with open(os.path.join(ROOT, "tours.json")) as f:
    DATA = json.load(f)

META = DATA["_meta"]
BANDS = META["price_bands"]
INCLUDED = META["included"]
TOURS = DATA["tours"]

def esc(s):
    return html.escape(s, quote=True)

def price_band(hours):
    lows = [BANDS[str(h)]["low"] for h in hours]
    highs = [BANDS[str(h)]["high"] for h in hours]
    return min(lows), max(highs)

def length_label(hours):
    names = {4: "Half day (4 hr)", 6: "Extended (6 hr)", 8: "Full day (8 hr)"}
    return " · ".join(names[h] for h in hours)

# ---- shared CSS (brand tokens + nav/footer + tour-detail layout) ----
CSS = """
:root{--slate:#1e293b;--slate-deep:#0f1a22;--ember:#e89866;--canyon:#c2703e;--paper:#f5f0eb;--sand:#efe6d9;--ink:#1a1510;--muted:rgba(245,240,235,0.72);--line:rgba(245,240,235,0.14);--radius:12px;--radius-sm:8px;--pill:24px}
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:hidden}html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:'Inter',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
h1,h2,h3,h4,.serif{font-family:'Fraunces',serif;font-weight:400;letter-spacing:-0.015em;line-height:1.15;color:var(--ink)}
a{color:var(--canyon);text-decoration:none;transition:color .15s}a:hover{color:var(--ember)}
button{font-family:inherit;cursor:pointer;border:none}
.skip{position:absolute;left:-9999px;top:0;background:var(--ink);color:var(--paper);padding:10px 16px;border-radius:var(--radius-sm);z-index:999}.skip:focus{left:12px;top:12px}
header.nav{position:sticky;top:0;background:var(--slate);color:var(--paper);z-index:100;border-bottom:1px solid var(--line)}
.nav-inner{max-width:1200px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{font-family:'Fraunces',serif;font-size:22px;letter-spacing:0.04em;color:var(--paper)}
.brand b{font-weight:700;letter-spacing:0.14em;text-transform:uppercase;font-size:14px;margin-right:6px}.brand i{font-style:italic;font-weight:400}
nav ul{list-style:none;display:flex;gap:22px;flex-wrap:wrap}
nav a{color:var(--paper);font-size:14px;font-weight:500;letter-spacing:0.03em;padding:6px 2px;border-bottom:2px solid transparent;transition:border-color .2s,color .15s}
nav a:hover,nav a.active{color:var(--ember);border-bottom-color:var(--ember)}
.nav-cta{background:var(--ember);color:var(--ink);padding:10px 20px;border-radius:var(--pill);font-weight:600;font-size:14px;transition:background .15s}
.nav-cta:hover{background:var(--canyon);color:var(--paper)}
.hamburger{display:none;background:none;color:var(--paper);font-size:24px;padding:6px 10px;border-radius:var(--radius-sm)}
@media (max-width:900px){nav ul{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:0;background:var(--slate-deep);padding:12px 0;border-top:1px solid var(--line)}nav ul.open{display:flex}nav li{width:100%}nav a{display:block;padding:14px 24px;border-bottom:none;border-left:3px solid transparent}nav a:hover,nav a.active{border-left-color:var(--ember);background:rgba(232,152,102,0.08)}.hamburger{display:block}.nav-cta{display:none}.brand{font-size:18px}}
.page-hero{background:linear-gradient(160deg,var(--slate) 0%,var(--slate-deep) 100%);color:var(--paper);padding:72px 24px 56px;text-align:center;position:relative;overflow:hidden}
.page-hero::before{content:"";position:absolute;inset:0;background-image:var(--hero);background-size:cover;background-position:center 32%;opacity:0.26}
.page-hero-inner{position:relative;z-index:2;max-width:860px;margin:0 auto}
.page-hero .eyebrow{color:var(--ember);font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px}
.page-hero h1{color:var(--paper);font-size:clamp(34px,6vw,58px);margin-bottom:14px;text-wrap:balance}
.crumb{position:relative;z-index:2;font-size:12.5px;letter-spacing:0.04em;color:var(--muted);margin-bottom:18px}
.crumb a{color:var(--muted)}.crumb a:hover{color:var(--ember)}
section{padding:56px 24px}.container{max-width:920px;margin:0 auto}
.tldr{background:var(--sand);border-left:4px solid var(--ember);border-radius:var(--radius-sm);padding:22px 26px;font-size:18px;line-height:1.6;color:var(--ink);margin:0 auto 8px;max-width:920px}
.eyebrow{font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--canyon);margin-bottom:10px}
h2.sec{font-size:clamp(24px,3.4vw,34px);margin-bottom:18px;text-wrap:balance}
.facts{width:100%;border-collapse:collapse;background:#fff;border-radius:var(--radius);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin:6px 0 8px}
.facts th,.facts td{text-align:left;padding:14px 20px;border-bottom:1px solid rgba(26,21,16,0.07);font-size:15px;vertical-align:top}
.facts tr:last-child th,.facts tr:last-child td{border-bottom:none}
.facts th{width:34%;font-family:'Inter',sans-serif;font-weight:600;color:var(--slate);letter-spacing:0.02em;background:var(--sand)}
.facts td .pnum{font-family:'Fraunces',serif;color:var(--canyon);font-weight:500}
.body p{font-size:16.5px;color:rgba(26,21,16,0.86);margin-bottom:16px;max-width:760px}
.hl{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:10px 26px;margin:8px 0 0}
.hl li{position:relative;padding-left:24px;font-size:15.5px;color:rgba(26,21,16,0.82)}
.hl li::before{content:"\\2726";position:absolute;left:0;color:var(--ember)}
@media (max-width:600px){.hl{grid-template-columns:1fr}}
.included{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.included li{background:var(--sand);border:1px solid rgba(26,21,16,0.08);border-radius:var(--pill);padding:7px 15px;font-size:13.5px;color:var(--slate)}
.faq{border-top:1px solid rgba(26,21,16,0.10);margin-top:8px}
.faq details{border-bottom:1px solid rgba(26,21,16,0.10);padding:4px 0}
.faq summary{cursor:pointer;list-style:none;padding:16px 4px;font-family:'Fraunces',serif;font-size:19px;color:var(--ink);display:flex;justify-content:space-between;align-items:center;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--canyon);font-size:22px;font-family:'Inter',sans-serif}
.faq details[open] summary::after{content:"\\2212"}
.faq .a{padding:0 4px 18px;font-size:16px;color:rgba(26,21,16,0.82);max-width:760px}
.inquire{background:var(--slate);color:var(--paper)}
.inquire .container{text-align:center}
.inquire h2{color:var(--paper);font-size:clamp(26px,4vw,38px);margin-bottom:10px;text-wrap:balance}
.inquire p{color:var(--muted);font-size:16px;max-width:560px;margin:0 auto 24px}
.cta-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.btn-primary{background:var(--ember);color:var(--ink);padding:14px 28px;border-radius:var(--pill);font-weight:600;display:inline-block;transition:background .15s,transform .15s}
.btn-primary:hover{background:var(--canyon);color:var(--paper);transform:translateY(-1px)}
.btn-ghost{color:var(--ember);padding:14px 22px;border-radius:var(--pill);font-weight:500;border:1px solid rgba(232,152,102,0.40);transition:all .15s}
.btn-ghost:hover{background:rgba(232,152,102,0.10);color:var(--paper);border-color:var(--ember)}
.backlink{display:inline-block;margin-top:24px;color:var(--muted);font-size:14px}
footer{background:var(--slate-deep);color:var(--muted);padding:48px 24px 24px;font-size:14px}
.foot-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:36px;padding-bottom:32px;border-bottom:1px solid var(--line)}
.foot-grid h4{color:var(--paper);font-family:'Inter',sans-serif;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px}
.foot-grid a{color:var(--muted);display:block;padding:4px 0}.foot-grid a:hover{color:var(--ember)}
.foot-grid .brand{font-size:20px;margin-bottom:12px;display:block}.foot-brand-desc{margin-bottom:16px;max-width:320px}
.foot-bottom{max-width:1200px;margin:24px auto 0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;color:rgba(245,240,235,0.5);font-size:13px}
@media (max-width:768px){.foot-grid{grid-template-columns:1fr 1fr;gap:28px}.foot-grid .brand-col{grid-column:1/-1}section{padding:48px 20px}}
@media (max-width:480px){.foot-grid{grid-template-columns:1fr}}
"""

NAV = """<header class="nav" role="banner">
  <div class="nav-inner">
    <a href="../" class="brand"><b>Sand &amp; Stars</b><i>Touring</i></a>
    <nav aria-label="Primary">
      <ul id="navmenu">
        <li><a href="../">Home</a></li>
        <li><a href="../tours.html" class="active">Tours</a></li>
        <li><a href="../bespoke.html">Bespoke</a></li>
        <li><a href="../planning.html">Planning</a></li>
        <li><a href="../about.html">About</a></li>
        <li><a href="../faq.html">FAQ</a></li>
        <li><a href="../contact.html">Contact</a></li>
      </ul>
    </nav>
    <a href="../book.html" class="nav-cta">Book a Tour</a>
    <button class="hamburger" aria-label="Toggle menu" aria-expanded="false" onclick="var m=document.getElementById('navmenu');m.classList.toggle('open');this.setAttribute('aria-expanded',m.classList.contains('open'))">&#9776;</button>
  </div>
</header>"""

FOOTER = """<footer>
  <div class="foot-grid">
    <div class="brand-col">
      <a href="../" class="brand"><b>Sand &amp; Stars</b><i>Touring</i></a>
      <p class="foot-brand-desc">For the best desert days. Custom and private tours of Moab's canyon country. Owner-led, locally guided.</p>
      <p><a href="mailto:tours@sandandstars.com">tours@sandandstars.com</a></p>
      <p><a href="tel:+14352608260">(435) 260-8260</a></p>
    </div>
    <div><h4>Explore</h4><a href="../">Home</a><a href="../tours.html">Tours</a><a href="../bespoke.html">Bespoke</a><a href="../gallery.html">Gallery</a><a href="../about.html">About</a></div>
    <div><h4>Help</h4><a href="../planning.html">Trip Planning</a><a href="../pricing.html">Pricing</a><a href="../faq.html">FAQ</a><a href="../contact.html">Contact</a><a href="../book.html">Book a Tour</a></div>
    <div><h4>Based In</h4><p style="color:var(--muted)">Moab, Utah<br>Gateway to Arches &amp;<br>Canyonlands</p></div>
  </div>
  <div class="foot-bottom">
    <span>&copy; <span id="year">2026</span> Sand &amp; Stars Touring. All rights reserved.</span>
    <span>Operating under permits from the National Park Service &amp; BLM.</span>
  </div>
</footer>
<script>document.getElementById('year').textContent=new Date().getFullYear();</script>"""

GA = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-9N54MXKZKM"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-9N54MXKZKM');</script>"""

def build_jsonld(t, low, high, url, img_url):
    itinerary = [{"@type": "TouristAttraction", "name": h} for h in t["highlights"]]
    trip = {
        "@context": "https://schema.org",
        "@type": "TouristTrip",
        "name": t["name"],
        "description": t["tldr"],
        "url": url,
        "image": img_url,
        "touristType": "Private guided tour",
        "provider": {
            "@type": "TravelAgency",
            "name": "Sand & Stars Touring",
            "url": SITE + "/",
            "telephone": "+1-435-260-8260",
            "email": "tours@sandandstars.com",
            "areaServed": "Moab, Utah",
            "address": {"@type": "PostalAddress", "addressLocality": "Moab", "addressRegion": "UT", "addressCountry": "US"}
        },
        "itinerary": {"@type": "ItemList", "itemListElement": itinerary},
        "offers": {
            "@type": "Offer",
            "priceCurrency": "USD",
            "priceSpecification": {
                "@type": "PriceSpecification",
                "minPrice": low, "maxPrice": high,
                "priceCurrency": "USD",
                "description": "Per person; private whole-vehicle pricing, all-inclusive. Per-person rate drops as group size grows."
            },
            "availability": "https://schema.org/InStock",
            "url": url
        }
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faqs"]]
    }
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Tours", "item": SITE + "/tours.html"},
            {"@type": "ListItem", "position": 3, "name": t["h1"], "item": url}
        ]
    }
    return "\n".join('<script type="application/ld+json">\n' + json.dumps(o, indent=2) + "\n</script>" for o in (trip, faq, crumbs))

def build_page(t):
    slug = t["slug"]
    url = f"{SITE}/tours/{slug}.html"
    img_url = f"{SITE}/tour_pics/{t['img']}"
    low, high = price_band(t["hours"])
    meta_desc = t["tldr"][:155]
    facts_rows = [
        ("Duration options", length_label(t["hours"])),
        ("Group", "Private to your group"),
        ("Price", f'<span class="pnum">${low}–${high}</span> per person (rate drops as the group grows)'),
        ("Where", ", ".join(t["parks"])),
        ("Difficulty", t["difficulty"]),
        ("Best season", t["season"]),
    ]
    facts_html = "\n".join(f"      <tr><th>{esc(k)}</th><td>{v}</td></tr>" for k, v in facts_rows)
    body_html = "\n".join(f"      <p>{esc(p)}</p>" for p in t["body"])
    hl_html = "\n".join(f"        <li>{esc(h)}</li>" for h in t["highlights"])
    inc_html = "\n".join(f"        <li>{esc(i)}</li>" for i in INCLUDED)
    faq_html = "\n".join(
        f'      <details><summary>{esc(q)}</summary><div class="a">{esc(a)}</div></details>'
        for q, a in t["faqs"])
    jsonld = build_jsonld(t, low, high, url, img_url)
    subj = f"Tour inquiry: {t['h1']}"
    mailto = f"mailto:tours@sandandstars.com?subject={subj.replace(' ', '%20')}"
    book = f"../book.html?tour={slug}"

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>{esc(t['h1'])}. Sand &amp; Stars Touring</title>
<meta name="description" content="{esc(meta_desc)}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{esc(t['h1'])}. Sand &amp; Stars Touring">
<meta property="og:description" content="{esc(meta_desc)}">
<meta property="og:image" content="{img_url}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
{GA}
{jsonld}
<style>{CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
{NAV}
<main id="main">

<section class="page-hero" style="--hero:url('../tour_pics/{t['img']}')">
  <div class="page-hero-inner">
    <div class="crumb"><a href="../">Home</a> &rsaquo; <a href="../tours.html">Tours</a> &rsaquo; {esc(t['h1'])}</div>
    <div class="eyebrow">{esc(t['eyebrow'])}</div>
    <h1>{esc(t['h1'])}</h1>
  </div>
</section>

<section>
  <p class="tldr">{esc(t['tldr'])}</p>
</section>

<section style="padding-top:8px">
  <div class="container">
    <h2 class="sec">Tour at a glance</h2>
    <table class="facts">
{facts_html}
    </table>
  </div>
</section>

<section style="padding-top:8px">
  <div class="container body">
    <h2 class="sec">About this tour</h2>
{body_html}
    <h2 class="sec" style="margin-top:28px">Highlights</h2>
    <ul class="hl">
{hl_html}
    </ul>
    <h2 class="sec" style="margin-top:28px">What's included</h2>
    <ul class="included">
{inc_html}
    </ul>
  </div>
</section>

<section style="padding-top:8px">
  <div class="container">
    <h2 class="sec">Frequently asked questions</h2>
    <div class="faq">
{faq_html}
    </div>
  </div>
</section>

<section class="inquire">
  <div class="container">
    <h2>Plan your {esc(t['h1'])} day</h2>
    <p>Every Sand &amp; Stars day starts with a short conversation. Tell us your dates and group size; we usually reply same day.</p>
    <div class="cta-row">
      <a class="btn-primary" href="{esc(mailto)}" data-analytics="tour-{slug}-email">Email us about this tour</a>
      <a class="btn-ghost" href="sms:+14352608260" data-analytics="tour-{slug}-text">Text (435) 260-8260</a>
      <a class="btn-ghost" href="tel:+14352608260" data-analytics="tour-{slug}-call">Call us</a>
    </div>
    <a class="backlink" href="{book}" data-analytics="tour-{slug}-book">Or start a booking inquiry &rarr;</a>
  </div>
</section>

</main>
{FOOTER}
</body>
</html>
"""

def main():
    out_dir = os.path.join(ROOT, "tours")
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for t in TOURS:
        page = build_page(t)
        path = os.path.join(out_dir, f"{t['slug']}.html")
        with open(path, "w") as f:
            f.write(page)
        written.append(f"tours/{t['slug']}.html")
    print(f"Generated {len(written)} tour pages:")
    for w in written:
        print("  " + w)

    # --- rewrite sitemap.xml: core pages + tour pages, today's lastmod ---
    core = [("/", "1.0", "monthly"), ("/tours.html", "0.9", "monthly"),
            ("/bespoke.html", "0.9", "monthly"), ("/planning.html", "0.8", "monthly"),
            ("/pricing.html", "0.8", "monthly"), ("/gallery.html", "0.7", "monthly"),
            ("/about.html", "0.7", "yearly"), ("/faq.html", "0.7", "monthly"),
            ("/contact.html", "0.6", "yearly")]
    rows = []
    for loc, pri, cf in core:
        rows.append(f"  <url>\n    <loc>{SITE}{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>{cf}</changefreq>\n    <priority>{pri}</priority>\n  </url>")
    for t in TOURS:
        rows.append(f"  <url>\n    <loc>{SITE}/tours/{t['slug']}.html</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>")
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    with open(os.path.join(ROOT, "sitemap.xml"), "w") as f:
        f.write(sitemap)
    print(f"Rewrote sitemap.xml with {len(core)} core + {len(TOURS)} tour URLs (lastmod {TODAY}).")

if __name__ == "__main__":
    main()

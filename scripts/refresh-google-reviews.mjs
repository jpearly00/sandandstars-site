#!/usr/bin/env node
// refresh-google-reviews.mjs
// Monthly scraper for Sand & Stars Touring Google Business Profile reviews.
// Scrapes the public Google Maps reviews panel (no API, no auth required).
// Writes fancy/reviews/google.json AND updates the inline
// <script id="reviews-google-data"> block in fancy/index.html so Panel B stays in sync.
//
// Usage:
//   node scripts/refresh-google-reviews.mjs
//
// Exit codes:
//   0 = success (may or may not have made changes)
//   1 = scraping failed (no write attempted)
//   2 = unexpected error
//
// Safety: if scraping returns fewer than MIN_EXPECTED reviews or the avg rating
// looks wrong, the script aborts before touching any file. This protects
// against DOM-breakage where we might otherwise write an empty list.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'fancy', 'reviews', 'google.json');
const INDEX_PATH = path.join(ROOT, 'fancy', 'index.html');

const FID = '0x6bd2ae22f39802ef:0xf60ef16cbeccbd28';
const LAT = '38.5733';
const LNG = '-109.5498';
const PLACE_ID = 'ChIJ7wKY8yKu0msRKL3MvmzxDvY';
const MAPS_URL =
  `https://www.google.com/maps/place/Sand+%26+Stars+Touring/` +
  `@${LAT},${LNG},15z/data=!4m8!3m7!1s${FID}!8m2!3d${LAT}!4d${LNG}!9m1!1b1`;

const LISTING_URI = `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`;
const WRITE_REVIEW_URI = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;

// We currently have 5 reviews. If scraping returns fewer than 3, something is
// wrong with the DOM extraction and we should fail without writing.
const MIN_EXPECTED = 3;

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  try {
    await page.goto(MAPS_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    // Wait for at least one review card to be rendered. Try multiple selectors.
    await page.waitForFunction(
      () =>
        !!document.querySelector('div[data-review-id], div.jftiEf, div.gws-localreviews__general-reviews-block'),
      { timeout: 30_000 },
    );

    // Try to scroll the review pane to load all reviews.
    await page.evaluate(async () => {
      const candidates = [
        'div.m6QErb.DxyBCb.kA9KIf.dS8AEf',
        'div[role="feed"]',
        'div.review-dialog-list',
      ];
      let pane = null;
      for (const sel of candidates) {
        pane = document.querySelector(sel);
        if (pane) break;
      }
      if (!pane) pane = document.scrollingElement || document.body;
      for (let i = 0; i < 8; i++) {
        pane.scrollTop = pane.scrollHeight;
        await new Promise((r) => setTimeout(r, 500));
      }
    });

    // Expand "More" buttons so review text is complete.
    await page.evaluate(() => {
      const sels = [
        'button[aria-label*="more" i]',
        'button.w8nwRe',
        'button[jsaction*="pane.review.expandReview"]',
      ];
      for (const sel of sels) {
        document.querySelectorAll(sel).forEach((b) => {
          try { b.click(); } catch (_) { /* noop */ }
        });
      }
    });
    await page.waitForTimeout(1000);

    const reviews = await page.evaluate(() => {
      function textOf(el) { return (el && el.textContent || '').trim(); }
      const cards = document.querySelectorAll('div[data-review-id], div.jftiEf');
      const out = [];
      cards.forEach((n) => {
        const author = textOf(n.querySelector('div.d4r55, .WNxzHc a, .TSUbDb, .al6Kxe'));
        const location = textOf(n.querySelector('div.RfnDt, .dehysf, .A503be'));

        // Star rating: aria-label like "5 stars" or "5.0 out of 5".
        const ratingEl =
          n.querySelector('span.kvMYJc') ||
          n.querySelector('span[role="img"][aria-label*="star" i]') ||
          n.querySelector('[aria-label*="star" i]');
        const ratingLabel = ratingEl?.getAttribute('aria-label') || '';
        const ratingMatch = ratingLabel.match(/(\d+(?:\.\d+)?)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 5;

        const relative = textOf(n.querySelector('span.rsqaWe, .dehysf + span, .DU9Pgb'));

        // Full text: prefer expanded span.
        const textEl =
          n.querySelector('span.wiI7pd') ||
          n.querySelector('div.MyEned span') ||
          n.querySelector('span.review-full-text');
        const text = textOf(textEl);

        if (author && text && text.length > 20) {
          out.push({
            author,
            location,
            title: '',
            rating,
            relative,
            companion: '',
            text,
          });
        }
      });
      // De-duplicate by (author + first 40 chars of text).
      const seen = new Set();
      return out.filter((r) => {
        const k = r.author + '|' + r.text.slice(0, 40);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    });

    if (reviews.length < MIN_EXPECTED) {
      throw new Error(
        `got only ${reviews.length} reviews, expected >= ${MIN_EXPECTED}; DOM likely changed`,
      );
    }

    const avg =
      reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    if (avg < 3.5) {
      throw new Error(`avg rating ${avg} looks wrong; aborting`);
    }

    const rating = Math.round(avg * 10) / 10;

    return {
      source: 'google',
      business: 'Sand and Stars Touring',
      listingUri: LISTING_URI,
      writeReviewUri: WRITE_REVIEW_URI,
      rating,
      count: reviews.length,
      fetchedAt: new Date().toISOString().slice(0, 10),
      reviews,
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

function jsonForInline(data) {
  const reviewLines = data.reviews.map((r) => '    ' + JSON.stringify(r)).join(',\n');
  return (
    '{\n' +
    `  "source": ${JSON.stringify(data.source)},\n` +
    `  "business": ${JSON.stringify(data.business)},\n` +
    `  "listingUri": ${JSON.stringify(data.listingUri)},\n` +
    `  "writeReviewUri": ${JSON.stringify(data.writeReviewUri)},\n` +
    `  "rating": ${data.rating},\n` +
    `  "count": ${data.count},\n` +
    `  "fetchedAt": ${JSON.stringify(data.fetchedAt)},\n` +
    '  "reviews": [\n' +
    reviewLines + '\n' +
    '  ]\n' +
    '}'
  );
}

async function writeJsonFile(data) {
  const pretty = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(JSON_PATH, pretty, 'utf8');
}

async function updateIndexInline(data) {
  const html = await fs.readFile(INDEX_PATH, 'utf8');
  const block = jsonForInline(data);
  const re =
    /(<script id="reviews-google-data" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!re.test(html)) {
    throw new Error('reviews-google-data script block not found in index.html');
  }
  const next = html.replace(re, `$1\n${block}\n$2`);
  if (next === html) return false;
  await fs.writeFile(INDEX_PATH, next, 'utf8');
  return true;
}

async function main() {
  try {
    console.log('[refresh] scraping Google Maps reviews...');
    const data = await scrape();
    console.log(`[refresh] got ${data.count} reviews, avg ${data.rating}`);
    await writeJsonFile(data);
    const changed = await updateIndexInline(data);
    console.log(`[refresh] json written; index.html changed=${changed}`);
    process.exit(0);
  } catch (e) {
    console.error('[refresh] FAILED:', e.message);
    process.exit(1);
  }
}

main();

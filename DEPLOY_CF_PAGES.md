# Deploy to Cloudflare Pages — `book.sandandstars.com`

**Repo:** https://github.com/jpearly00/sandandstars-site (private)
**Target subdomain:** `book.sandandstars.com`
**Apex (`sandandstars.com`) stays on Wix** during transition — zero downtime.

---

## 1. Create Cloudflare Pages project

1. Go to https://dash.cloudflare.com → Workers & Pages → **Create → Pages → Connect to Git**.
2. Authorize the GitHub app for **jpearly00** if prompted. Grant access to the `sandandstars-site` repo only (keep scope tight).
3. Select `jpearly00/sandandstars-site` → **Begin setup**.
4. Project settings:
   - **Project name:** `sandandstars-site` (this becomes `sandandstars-site.pages.dev`)
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/`
5. **Save and Deploy.** First deploy takes ~30–60 sec. Confirm it comes up at `sandandstars-site.pages.dev`.

---

## 2. Add custom subdomain `book.sandandstars.com`

After the Pages project is live:

1. In the project → **Custom domains** → **Set up a custom domain**.
2. Enter: `book.sandandstars.com` → **Continue**.
3. Cloudflare will show the DNS record to add (CNAME, value like `sandandstars-site.pages.dev`).

### DNS setup — depends on where `sandandstars.com` DNS lives

**Option A — DNS already on Cloudflare:**
- Cloudflare auto-creates the CNAME. Wait ~1 min for SSL cert provisioning. Done.

**Option B — DNS still on Wix:**
- In Wix → Domains → `sandandstars.com` → Advanced → DNS records → **Add CNAME**.
- Host/Name: `book`
- Points to: `sandandstars-site.pages.dev`
- TTL: 3600 (or default)
- Save. Wait 5–30 min for propagation. Cloudflare will auto-issue the SSL cert once DNS resolves.

**Option C — DNS on another registrar (GoDaddy/Namecheap/etc.):**
- Same as Option B — add a CNAME record: `book` → `sandandstars-site.pages.dev`.

---

## 3. Verify

```bash
# DNS resolved?
dig book.sandandstars.com CNAME +short

# Site live?
curl -I https://book.sandandstars.com
```

Expect HTTP 200 and the HTML home (index.html) on load.

---

## 4. Confirm garage is blocked

```bash
curl -I https://book.sandandstars.com/_garage/garage.html
```

Expect HTTP 404 (from `_redirects` rule).

---

## 5. Push updates

Any `git push origin main` auto-deploys. Check **Workers & Pages → sandandstars-site → Deployments** tab.

---

## 6. Wix stays on apex

No Wix changes needed. `sandandstars.com` continues to serve the existing Wix site until Phase 3 cutover (see `wix_replacement_plan.md`). The new Cloudflare Pages site lives only at `book.sandandstars.com` until John decides to migrate the apex.

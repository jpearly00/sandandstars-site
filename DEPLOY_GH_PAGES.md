# Deploy — GitHub Pages at `book.sandandstars.com`

**Repo:** https://github.com/jpearly00/sandandstars-site (public)
**Host:** GitHub Pages (free — works because repo is public)
**Subdomain:** `book.sandandstars.com`
**Apex (`sandandstars.com`) stays on Wix** until full cutover.

---

## Status

- [x] Repo public
- [x] `CNAME` file at repo root pointing at `book.sandandstars.com`
- [x] Pages enabled via API (source: main branch, root)
- [ ] DNS CNAME added at your registrar (your step — see below)
- [ ] SSL cert issued by GitHub (auto, 5–30 min after DNS resolves)

---

## Your one step: add the DNS CNAME

Depends on where `sandandstars.com` DNS lives:

### If DNS is on Wix
- Wix → Domains → `sandandstars.com` → Advanced → DNS records → Add CNAME
- **Host:** `book`
- **Points to:** `jpearly00.github.io`
- TTL: default. Save.

### If DNS is on Cloudflare
- Cloudflare → `sandandstars.com` → DNS
- Add record: Type CNAME, Name `book`, Target `jpearly00.github.io`, Proxy **off** (gray cloud) so GH Pages can issue the cert. Save.

### If DNS is on another registrar (GoDaddy / Namecheap / etc.)
- Add CNAME: `book` → `jpearly00.github.io`

---

## Verify

```bash
dig book.sandandstars.com CNAME +short
# expect: jpearly00.github.io.

curl -I https://book.sandandstars.com
# expect: HTTP/2 200
```

---

## Updates

`git push origin main` auto-deploys. Check status: repo → **Actions** tab → "pages build and deployment" workflow.

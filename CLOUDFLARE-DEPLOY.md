# Deploying navdhan-site to Cloudflare Pages

The site is an SSR **TanStack Start** app built with the Nitro **`cloudflare-pages`**
preset (`vite.config.ts`). It deploys to the **existing Cloudflare Pages project
`navdhan-landing`**, which serves **navdhan.app / www.navdhan.app**.

> ⚠️ `navdhan-landing` has **No Git connection** — pushing to GitHub does NOT
> deploy. Deploys are **direct uploads** via `wrangler pages deploy`.

## One-time
```bash
npx wrangler login        # opens browser; sign in to the Team@kubar.tech Cloudflare account
```

## Every deploy
1. **Point the embedded DSA portal at the live backend** (only needed when its URL
   changes). The portal calls `VITE_API_BASE_URL`; in production it must be the
   absolute Cloud Run URL:
   ```bash
   # in dsa_portal/frontend/.env  (or inline)
   #   VITE_API_BASE_URL=https://<kuber-verification cloud run url>/api/v1/verify
   cd dsa_portal/frontend && npm run build && cd ../..
   npm run sync:portal        # copies the portal build into public/apply/
   ```
2. **Build + upload the site**:
   ```bash
   npm run deploy:cf          # = vite build && wrangler pages deploy dist --project-name navdhan-landing
   ```
   Output goes to `dist/` (`client/` static incl. `client/apply/`, `server/` SSR
   worker, `_routes.json`). Wrangler uploads it; the new deployment goes live on
   `navdhan.app`.

## Backend CORS (one-time, on the backend)
Add the site origins to the Cloud Run backend's `ALLOWED_ORIGINS` env (the
"whitelist") so the portal's API calls aren't blocked:
```
ALLOWED_ORIGINS=https://navdhan.app,https://www.navdhan.app
```

## Gotchas
- A Worker **route exists on `navdhan.app`** (`navdhan-os-proxy`, per the CF audit
  log). If the deployed Pages site doesn't show, check Workers → Routes that a
  worker isn't intercepting `navdhan.app/*` ahead of Pages.
- The current live navdhan.app is an **old** deployment — the first `deploy:cf`
  replaces it with the current build.
- Backend stays on **Google Cloud Run** (`kuber-verification`); only the frontend
  moves to Cloudflare.

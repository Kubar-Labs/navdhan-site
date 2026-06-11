# Deploying navdhan-site to Cloudflare

The site is an SSR **TanStack Start** app built with the Nitro **`cloudflare-module`**
preset (`vite.config.ts`) → **Cloudflare Workers (Static Assets)**. It deploys as
the Worker **`kubar-labs-navdhan-site`** (test URL:
`https://kubar-labs-navdhan-site.team-2b5.workers.dev`).

> Note: this is a **Worker**, not a Pages project. The old Pages project
> `navdhan-landing` is being retired. Deploy with `wrangler deploy` (NOT
> `wrangler pages deploy`).

## One-time
```bash
npx wrangler login        # opens browser; sign in to the Team@kubar.tech Cloudflare account
```

## Every deploy
1. **Point the embedded DSA portal at the live backend** (only when its URL
   changes). The portal calls `VITE_API_BASE_URL`; in production set the absolute
   Cloud Run URL:
   ```bash
   # in dsa_portal/frontend/.env (or inline):
   #   VITE_API_BASE_URL=https://<kuber-verification cloud run url>/api/v1/verify
   cd dsa_portal/frontend && npm run build && cd ../..
   npm run sync:portal        # copies the portal build into public/apply/
   ```
2. **Build + deploy the Worker:**
   ```bash
   npm run deploy:cf          # = vite build && npx wrangler deploy
   ```
   Build output: `dist/server/index.mjs` (worker, `main`) + `dist/client/` (static
   assets incl. `client/apply/` portal) + `dist/server/wrangler.json` (`main` +
   `assets` binding). `wrangler deploy` reads `.wrangler/deploy/config.json`.

## Point navdhan.app at the Worker (one-time, dashboard)
`navdhan.app` is still on the old Pages project. Move it:
1. Workers & Pages → **navdhan-landing** → Custom domains → remove `navdhan.app` + `www.navdhan.app`.
2. Workers & Pages → **kubar-labs-navdhan-site** → Settings → Domains & Routes →
   Add → **Custom domain** → `navdhan.app` (and `www.navdhan.app`).
3. Check the **`navdhan-os-proxy`** Worker doesn't have a route on `navdhan.app/*`.

## Backend CORS (one-time, on the backend)
Add the site origins to the Cloud Run backend's `ALLOWED_ORIGINS` so the portal's
API calls aren't blocked:
```
ALLOWED_ORIGINS=https://navdhan.app,https://www.navdhan.app
```

## Auto-deploy on push (optional)
`.github/workflows/deploy.yml` runs `wrangler deploy` on push to `main` (needs the
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` GitHub secrets, and GitHub Actions
billing in good standing). The backend stays on **Google Cloud Run**; only the
frontend is on Cloudflare.

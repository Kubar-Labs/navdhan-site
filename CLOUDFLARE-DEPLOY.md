# Deploying navdhan-site to Cloudflare

The site is a **Next.js** app deployed to **Cloudflare Workers (Static Assets)**
via the **OpenNext Cloudflare adapter** (`@opennextjs/cloudflare`). It deploys as
the Worker **`kubar-labs-navdhan-site`** (test URL:
`https://kubar-labs-navdhan-site.<your-subdomain>.workers.dev`).

> Note: this is a **Worker**, not a Pages project. Deploy with `wrangler deploy`
> (NOT `wrangler pages deploy`).

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
   npm run deploy:cf          # = opennextjs-cloudflare build && opennextjs-cloudflare deploy
   ```
   Build output: `.open-next/worker.js` (worker) + `.open-next/assets/` (static
   assets incl. `assets/apply/` portal), configured via `wrangler.jsonc`
   (`main` + `assets` binding). `wrangler deploy` reads `wrangler.jsonc`.

## Point navdhan.app at the Worker (one-time, dashboard)
1. Workers & Pages → **kubar-labs-navdhan-site** → Settings → Domains & Routes →
   Add → **Custom domain** → `navdhan.app` (and `www.navdhan.app`).
2. Check the **`navdhan-os-proxy`** Worker doesn't have a route on `navdhan.app/*`.

## Backend CORS (one-time, on the backend)
Add the site origins to the Cloud Run backend's `ALLOWED_ORIGINS` so the portal's
API calls aren't blocked:
```
ALLOWED_ORIGINS=https://navdhan.app,https://www.navdhan.app
```

## Auto-deploy on push (optional)
`.github/workflows/deploy.yml` runs `npm run cf:build && wrangler deploy` on push
to `main` (needs the `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` GitHub
secrets, and GitHub Actions billing in good standing). The backend stays on
**Google Cloud Run**; only the frontend is on Cloudflare Workers.

## Server-side env vars (Postgres/Drizzle)
This app now has server-side API routes (`app/api/*`) using Drizzle + `pg`. Set
any required DB connection secrets as Worker secrets before deploying:
```bash
npx wrangler secret put DATABASE_URL
```
Node APIs (like `pg`'s TCP sockets) require the `nodejs_compat` compatibility
flag, which is already set in `wrangler.jsonc`. If `pg` doesn't work over
Workers' runtime in practice, consider swapping to a Postgres driver with
native Workers/edge support (e.g. Neon's `@neondatabase/serverless` or
Hyperdrive) — this wasn't tested as part of this migration.

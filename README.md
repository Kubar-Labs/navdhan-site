# Navdhan Site

Marketing site for Navdhan, built with Next.js 15 (App Router), React 19, and Tailwind CSS 4.

## Stack

- Next.js 15 (App Router, SSR)
- next-intl (i18n, `app/[locale]`)
- Tailwind CSS 4
- Framer Motion
- Drizzle ORM + Postgres (server-side, `app/api/*`)

## Getting started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

## Scripts

- `dev`: local development server
- `build`: production build
- `start`: run the production build locally
- `lint`: run ESLint
- `test` / `test:watch`: run Vitest
- `sync:portal`: copy the built DSA portal (`dsa_portal/frontend`) into `public/apply/`
- `db:generate` / `db:migrate` / `db:studio`: Drizzle ORM helpers
- `cf:build` / `cf:preview` / `deploy:cf`: build & deploy to Cloudflare Workers via OpenNext

## Environment variables

Server-only values are read from `process.env` inside server handlers, route
handlers (`app/api/*`), or server components. See `CLOUDFLARE-DEPLOY.md` for
setting secrets (e.g. `DATABASE_URL`) on the deployed Worker.

## Deployment (Cloudflare Workers)

See `CLOUDFLARE-DEPLOY.md`. In short: `npm run deploy:cf` builds with the
OpenNext Cloudflare adapter and deploys the Worker `kubar-labs-navdhan-site`
via `wrangler deploy`. `.github/workflows/deploy.yml` does this automatically
on push to `main`.

## Project structure

- `app/`: Next.js App Router routes, layouts, and API route handlers
- `app/[locale]/(marketing)`: localized marketing pages
- `app/apply`: application flow pages
- `src/components`: shared React components
- `src/db`: Drizzle schema/config
- `src/lib`, `src/hooks`, `src/types`: utilities, hooks, and types
- `content/`: structured content (company info, legal pages)
- `public/apply/`: built DSA portal (embedded verification flow), synced via `npm run sync:portal` — do not edit by hand
- `dsa_portal/`: separate DSA portal frontend/backend, untouched by this migration

# NavDhan site

NavDhan's localized marketing site and existing application experience, built
with Next.js 15, React 19, Tailwind CSS 4, and `next-intl`.

## Development

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run cf:build
```

The lint command enforces the inherited 19-warning ceiling in the frozen
application/backend files; any additional warning or any error fails the gate.

Agentation is available only in development, including on `/en/apply`; it is
not rendered in production.

## Application boundary

The frontend redesign deliberately preserves the application/backend state
that existed at commit `9c6a6813df3e01044d83dfdf0bef736b6c0e3451`.
In particular, frontend-only work must not change:

- `app/api/apply/`
- `src/lib/apply/server/`
- `src/types/apply.ts`
- `dsa_portal/`
- `public/apply/`
- `scripts/sync-portal.mjs`

The root application routes retain their pre-redesign in-process MVP storage
behavior. This repository does not select or migrate to a replacement database
as part of the frontend release. Database/backend changes require a separate,
explicitly approved project.

## Project structure

- `app/[locale]/(marketing)`: localized marketing pages
- `app/[locale]/apply`: localized application entry point
- `app/apply`: existing application UI and state flow
- `app/api/apply`: existing application route handlers
- `src/components`: shared and marketing components
- `content`: structured marketing and legal content
- `dsa_portal` and `public/apply`: preserved legacy portal source and assets

## Deployment

The production frontend runs as the Cloudflare Worker
`kubar-labs-navdhan-site`. GitHub Actions are not relied on because the account
does not currently have active Actions billing. Follow
[`CLOUDFLARE-DEPLOY.md`](./CLOUDFLARE-DEPLOY.md) for preview, production,
verification, and rollback steps.

# Deploying NavDhan to Cloudflare

The Next.js site is built with the OpenNext Cloudflare adapter and deployed as
the Worker `kubar-labs-navdhan-site`. `navdhan.app` and `www.navdhan.app` are
production custom domains configured only in `wrangler.jsonc`.

This runbook covers the frontend Worker only. It must not provision, migrate,
inspect, or reconfigure any database or backend. The application/API baseline
is commit `9c6a6813df3e01044d83dfdf0bef736b6c0e3451`; compare the protected paths
listed in `README.md` before every frontend release.

## Delivery model

GitHub Actions are not part of the active release path because the account has
no active Actions billing. The existing workflow is retained unchanged. A
reviewed operator builds and deploys the exact pushed commit from a clean
checkout. Never use a dirty working tree as a deployment source.

`wrangler.preview.jsonc` has a separate Worker name, a `workers.dev` URL, and no
production routes. `wrangler.jsonc` is the production configuration.

## Preview

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run cf:build
npm run cf:deploy:preview
```

Confirm the preview has no custom domain before exercising it. Do not copy,
rotate, or delete production secrets for a frontend preview.

## Production gate

Before deploying:

1. Record `git rev-parse HEAD`, `git status --short`, and the current Worker
   deployment/version.
2. Confirm the release SHA is the exact SHA pushed to `main`.
3. Confirm the protected backend paths still match the pre-redesign baseline.
4. Pass lint, typecheck, tests, the normal Next.js build, and the OpenNext build.
5. Verify desktop, mobile, keyboard navigation, locale switching, legal links,
   calculator behavior, and the existing application flow in a real browser.
6. Review the final diff and built artifacts for secrets and unrelated files.

Deploy only after those gates pass:

```bash
npx wrangler deployments list --name kubar-labs-navdhan-site
npx wrangler deploy --config wrangler.jsonc --message "NavDhan release <full-git-sha>"
```

Do not deploy with the preview configuration, alter domain routes, or change
backend/database configuration during this release.

## Production verification

- Confirm both `https://navdhan.app` and `https://www.navdhan.app` resolve to
  the newly deployed Worker version; `www` must redirect to the apex domain.
- Check `/en`, `/en/platforms`, `/en/lenders`, `/en/team`, and `/en/apply` at
  desktop and mobile widths.
- Check all supported locale routes and language switching.
- Check response security headers, canonical metadata, robots, sitemap, asset
  caching, focus states, overflow, and browser console errors.
- Exercise only safe application validation and draft behavior. Do not submit
  real applications, OTP/KYC requests, documents, or transactions.

## Rollback

Record the previous Worker version before deployment. If production regresses,
roll the Worker back to that exact version through Cloudflare's version
rollback, then re-run the domain and application smoke checks. A frontend
rollback must not include database migrations, backend changes, domain changes,
or secret rotation.

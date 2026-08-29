# Deploy the NavDhan Next.js Worker

The supported frontend is the repository-root Next.js application built with
the OpenNext Cloudflare adapter. It deploys as the Worker
`kubar-labs-navdhan-site` and owns `navdhan.app` and `www.navdhan.app`.

`dsa_portal/frontend` is retired. Do not build it, sync it into `public/apply`,
or run its Cloud Run/PowerShell deployment scripts. It is a legacy
Vite/Perfios portal whose API does not exist in the collection backend.

## Release gate

Deploy the Worker only after:

1. the current database release and read-only RLS verification pass;
2. the Cloud Run candidate rejects missing/invalid service tokens;
3. the scanner proves clean/infected/replay/failure paths against staging
   quarantine objects;
4. the candidate passes staging acceptance; and
5. the chosen Cloud Run revision is healthy at 100% traffic.

Do not publish while reviewed legal/contact content is incomplete. Keep public
contact details email-only unless a verified phone number is approved, obtain
owner/legal approval for any public lending, outcome, or association claim, and
supply reviewed translations before indexing the six placeholder legal locales.

Record the current Worker version before changing anything so rollback is
unambiguous.

## Runtime configuration

The Worker needs exactly two backend values:

- `APPLY_BACKEND_BASE_URL`: the canonical HTTPS URL of `navdhan-backend`; and
- `APPLY_BACKEND_SERVICE_TOKEN`: the secret corresponding to Cloud Run's
  `APPLY_SERVICE_TOKEN`.

Store both values as Cloudflare secrets:

```bash
npx wrangler secret put APPLY_BACKEND_BASE_URL
npx wrangler secret put APPLY_BACKEND_SERVICE_TOKEN
```

Do not set `APPLY_BACKEND_BASE_URL` only as a dashboard variable. Wrangler's
configuration is authoritative by default and a later deploy removes dashboard
variables that are absent from `wrangler.jsonc`. Keeping both runtime values as
secrets makes them survive a version deploy without committing the environment
URL. There is deliberately no loopback or self-URL fallback. Confirm the
effective URL points to Cloud Run, not `navdhan.app` and not a tagged candidate
URL.

The token is used only by server-side route handlers and sent as
`x-navdhan-service-token`. It must never appear in browser JavaScript, HTML,
logs, analytics, error bodies, or client-readable environment variables.

Do **not** set `DATABASE_URL` on the Worker. The root application reaches
PostgreSQL only through the authenticated FastAPI backend; Cloud SQL credentials
belong exclusively to Cloud Run.

### Apply rate limiting

Public apply routes use two Cloudflare layers. The four native rate-limit
bindings are a fast coarse filter (`session` 10/minute, `write` 120/minute,
`upload` 10/minute, and `read` 300/minute). Cloudflare documents those bindings
as permissive and eventually consistent, so they are not the enforcement
boundary. `APPLY_RATE_LIMITER_DO` is the authoritative fixed-window limiter: it
keys one `ApplyRateLimiter` Durable Object by a SHA-256 hash of the client IP
and rate class, stores no raw IP, and fails closed if either layer is missing or
unavailable.

Both Wrangler configs must continue to point `main` at `worker/index.js`. That
wrapper re-exports the generated OpenNext handler and named exports, then adds
`ApplyRateLimiter`; never edit or deploy `.open-next/worker.js` directly because
the next OpenNext build replaces it. Keep the Durable Object binding and all
four native bindings in both preview and production configs.

`ApplyRateLimiter` was introduced by the ordered SQLite Durable Object
migration tagged `v1`. Once deployed to an environment, that migration is
permanent: do not edit, delete, reorder, or reuse the tag. Future Durable Object
changes must append a new migration tag.

## Build and deploy

Authenticate to the Team@kubar.tech Cloudflare account, then run from the
repository root at the approved Git SHA:

```bash
npx wrangler whoami
npm ci
npm run typecheck
npm test
npm run cf:build
npm run deploy:cf
```

`npm run deploy:cf` builds and deploys the Worker; it is not a Pages project,
so never use `wrangler pages deploy`.

GitHub auto-deploy, when enabled, needs `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as repository secrets. Those CI credentials are not
Worker runtime values and do not replace either apply-backend variable.

## Domains and smoke tests

In Workers & Pages, confirm both custom domains point to
`kubar-labs-navdhan-site` and that no older Worker (including
`navdhan-os-proxy`) owns `navdhan.app/*`.

After deploy:

- verify both apex and `www` use the intended Worker version;
- create/resume an application through the browser and confirm the Worker can
  reach Cloud Run with the service token;
- confirm a direct Cloud Run `/api/apply/*` request without that token is
  rejected while `/health` remains public;
- upload a PDF, prove it cannot satisfy a requirement while quarantined, wait
  for an authenticated clean verdict, and confirm the exact generation moves
  from `quarantine/` to `clean/` before delete/re-upload;
- prove anonymous session and upload requests 1–10 are admitted and request 11
  in the same minute returns 429 with a bounded `Retry-After`, without creating
  an additional backend session or document record;
- verify the active Cloudflare plan accepts the configured upload size and both
  the native bindings and authoritative Durable Object are present at the edge;
- inspect Worker and Cloud Run logs for token, session, and PII leakage; and
- check CSP/HSTS/frame/nosniff headers, canonical URLs, locale routing, and
  `/sitemap.xml` as independent production gates.

The browser never calls Cloud Run directly. `ALLOWED_ORIGINS` is defense in
depth, not authentication; the service-token middleware is the backend access
boundary.

## Rollback

If frontend errors rise, roll the Worker back to the recorded prior version
before changing backend traffic. Use the Cloudflare dashboard's version
rollback or the supported Wrangler rollback command for the installed version.
Then verify both domains and an application resume.

A Worker code rollback does not reverse the `v1` Durable Object migration or
delete its namespace. Do not use a `deleted_classes` migration as an incident
rollback and do not remove `v1` from either Wrangler config; retain the migration
history so a later forward deployment sees the correct remote state.

If the failure persists, follow `DEPLOYMENT.md`: route Cloud Run to its recorded
prior revision. Do not run database down migrations as part of either rollback.

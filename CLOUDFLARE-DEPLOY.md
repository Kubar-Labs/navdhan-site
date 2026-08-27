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

- `APPLY_BACKEND_BASE_URL`: the canonical HTTPS origin of the approved GCP
  application gateway in front of `navdhan-backend`; and
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
effective URL points to the approved application gateway, not directly to
Cloud Run, not to `navdhan.app`, and not to a tagged candidate URL.

The token is used only by server-side route handlers and sent as
`x-navdhan-service-token`. It must never appear in browser JavaScript, HTML,
logs, analytics, error bodies, or client-readable environment variables.

Do **not** set `DATABASE_URL` on the Worker. The root application reaches
PostgreSQL only through the authenticated FastAPI backend; Cloud SQL credentials
belong exclusively to Cloud Run.

## Build and delivery

GitHub Actions are not part of this release path. The existing Cloudflare
project's Git Build connection is the preferred builder. It must be configured
to build the exact approved Git SHA with `npm ci` and `npm run cf:build`; a
feature branch may create only a Preview deployment.

Before allowing a Git Build to publish, verify in Cloudflare that:

- the connected repository and commit SHA are exact;
- the production branch is `main` and the candidate is not treated as
  production;
- preview builds have no `navdhan.app` or `www.navdhan.app` route;
- `APPLY_INTAKE_MODE=paused`; and
- production secrets are not copied to a preview environment.

For a local verification build from the approved SHA:

```bash
npm ci
npm run verify
npm run build
```

For an explicitly authorized preview only, authenticate to the correct
Cloudflare account and run `npm run cf:deploy:preview`. This command uses
`wrangler.preview.jsonc`, a distinct Worker name, `workers.dev` preview URLs,
separate rate-limit namespaces, paused intake, and no production domain routes.

There is deliberately no generic npm production-deploy command. Production
publication occurs only through the verified Cloudflare Git Build connection
after all gates pass. Never use `wrangler pages deploy`; this is a Worker.

Cloudflare build credentials are delivery credentials, not Worker runtime
values, and do not replace either apply-backend secret.

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
- prove anonymous session and upload limits return 429 with a bounded
  `Retry-After`, without storing an extra object;
- verify the active Cloudflare plan accepts the configured upload size and the
  rate-limit bindings enforce the expected behavior at the edge;
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

If the failure persists, follow `DEPLOYMENT.md`: route Cloud Run to its recorded
prior revision. Do not run database down migrations as part of either rollback.

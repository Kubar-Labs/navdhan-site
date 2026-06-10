/**
 * Where the "Apply Loan" CTAs send users — the DSA / KYC onboarding portal.
 *
 * The portal is a static SPA copied into `public/apply/` (built with Vite
 * `base: '/apply/'`). It's served on the same origin as this site. We link to
 * the explicit `index.html` because the marketing app's SSR router owns the
 * bare `/apply` path (404) and redirects `/apply/` — the static file path
 * resolves cleanly in both dev and production. Plain <a href> (full nav).
 */
export const APPLY_URL = "/apply/index.html";

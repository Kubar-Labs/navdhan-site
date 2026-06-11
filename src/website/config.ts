/**
 * Where the "Apply Loan" CTAs send users — the DSA / KYC onboarding portal.
 *
 * The portal is a static SPA in `public/apply/` (built with Vite
 * `base: '/apply/'`), served from the same Cloudflare Worker (Static Assets)
 * as this site. `/apply/` is the canonical path (Workers normalizes
 * `/apply` and `/apply/index.html` to it). Plain <a href> (full nav).
 */
export const APPLY_URL = "/apply/";

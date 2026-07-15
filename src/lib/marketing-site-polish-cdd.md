# Micro-CDD — Marketing Site Polish (NavDhan)

## Scope

Polish the deployed NavDhan marketing MVP on `factory/navdhan-redesign/integration` to match the approved Design.md/marketing-contract.yaml and the provided 24-point instruction list.

## Architecture decisions

### i18n strategy

- Server components consume JSON via `src/lib/i18n/translations.ts` and `src/lib/i18n/messages/<locale>.json`.
- Client homepage consumes TS modules (`src/lib/i18n/messages/<locale>.ts`) via `getMessages`.
- To fix raw-key regressions, every key used in server components must exist identically in both JSON and TS files.
- Marketing copy edits are applied to the TS modules first, then mirrored into the matching JSON files for server-component parity.

### Animation system

- `app/globals.css` adds reduced-motion helpers and accent/theme tokens.
- Reusable Framer Motion wrappers:
  - `AnimatedSection`: `whileInView` reveal with `useReducedMotion` fallback.
  - `StaggerContainer` + `StaggerItem`: hero / grid stagger.
- Hero entrance: `y: 16 → 0`, `opacity: 0 → 1`, stagger 0.08, duration 0.7s, ease `[0.25, 0.46, 0.45, 0.94]`.
- Section reveal: same transform, 0.6s, intersect once.
- Ticker: CSS keyframes `translateX`, 30s linear, paused on hover/focus.
- Carousel: Framer Motion x-track, autoplay + manual controls.

### Homepage section order

1. AnnouncementBar
2. Hero
3. AssociationBadges
4. TechEcosystemTicker
5. LoanProducts
6. WhyNavDhan
7. RecognitionCarousel
8. CustomerStories
9. EmiCalculator
10. FinalCta
11. Footer

### Static assets

- Create `public/` directory and place:
  - `public/assets/navdhan-logo.svg` — transparent orange wordmark.
  - `public/assets/recognition/` — selected representative photos copied from `/home/yash/LinkedIn/`.
  - `public/assets/stories/` — illustrative avatar placeholders.
  - Partner/association SVG components are inline to avoid broken assets.

### Header / Footer

- Header becomes client component with hamburger mobile menu, real logo, and locale switcher.
- Mobile menu exposes Products, Why, EMI, Stories, Team anchors.
- Footer uses JSON i18n; all keys supplied; legal links route under `/{locale}/legal/{slug}`.

### Team page

- Scrape `https://kubar.tech/team` via `webfetch`.
- Update `content/team.json` and TS locale modules.
- Eliminate double-translation bug by passing literal strings to presentation components.

### Copy rules

- No em-dashes anywhere.
- Borrower-facing wording only; remove lender/platform language.
- Footer tagline: "One stop-solution for all your working capital needs".
- HQ address: "156, Tarvakere, BTM Layout 1st Stage, Bengaluru, Karnataka".
- Emails: `@kubar.tech` for support, partnerships, careers, press, loan; `outreach@kubar.tech` for Talk to Us.

## Risk / blockers

- LinkedIn photos must be copied into `public/assets/recognition/` and served as static assets.
- Team scrape may be unavailable; fallback to existing `content/team.json`.
- Two i18n systems require careful JSON/TS parity.

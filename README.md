# Navdhan Site

Marketing site for Navdhan, built with TanStack Start, React 19, Vite, and Tailwind CSS.

## Stack

- TanStack Start (SSR)
- TanStack Router + React Query
- Vite 7
- Tailwind CSS 4

## Getting started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Or, with Bun:

```bash
bun install
bun run dev
```

## Scripts

- `dev`: local development server
- `build`: production build (SSR)
- `preview`: preview the production build locally
- `lint`: run ESLint
- `format`: run Prettier

## Environment variables

Server-only values should be read from `process.env` inside server handlers or helper
functions in `.server.ts` modules. Client-safe values must be prefixed with `VITE_`.

There are no required environment variables by default.

## Deployment (Vercel)

This project uses Nitro with the `vercel` preset, which emits a Build Output API
artifact for Vercel during `npm run build`.

1. Create a new Vercel project and import this repo.
2. Build command: `npm run build` (or `bun run build` if you prefer Bun).
3. Output: leave empty (Vercel will use the generated Build Output API output).
4. Set any required environment variables in Vercel project settings.

The deployment uses the Node runtime (not Edge), which is compatible with
`process.env` usage in server code.

## Project structure

- `src/routes`: file-based routes (TanStack Start)
- `src/components/navdhan`: page sections
- `src/lib`: server helpers and utilities
- `src/styles.css`: Tailwind theme and base styles

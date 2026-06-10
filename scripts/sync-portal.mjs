// Copy the built DSA portal into the marketing site's public/apply so it's
// served at /apply on the same origin. Run after rebuilding the portal:
//   (cd dsa_portal/frontend && npm run build) && npm run sync:portal
import { cpSync, rmSync, existsSync } from "node:fs";

const src = "dsa_portal/frontend/dist";
const dest = "public/apply";

if (!existsSync(src)) {
  console.error(`✗ ${src} not found — build the portal first (cd dsa_portal/frontend && npm run build).`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`✓ Synced ${src} → ${dest}`);

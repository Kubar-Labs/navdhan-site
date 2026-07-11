/**
 * Reference number generation for submitted applications.
 */

import { randomBytes } from "crypto";

export function generateApplicationReferenceNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `NDH-${today}-${random}`;
}

export function generateNavReference(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `NAV-${today.slice(0, 4)}-${random}`;
}

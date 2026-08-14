import type { Messages } from "@/src/lib/i18n/messages";
import { getMessages } from "@/src/lib/i18n/messages";
import teamData from "@/src/lib/data/team.json";

export type TeamField = "role" | "bio" | "domain" | "contribution";

export interface TeamLocalizationApi {
  getMemberCopy(id: string, field: "role" | "bio"): string;
  getAdvisorCopy(id: string, field: "domain" | "contribution"): string;
  getBrandTagline(): string;
}

const BRAND_TAGLINE = "One stop-solution for all your working capital needs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getString(messages: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function getTeamLocalization(
  messages: Messages,
  locale: string,
  fallbackLocale = "en",
): TeamLocalizationApi {
  function resolve(path: string): string | undefined {
    const active = getString(messages, path);
    if (active) return active;
    if (locale === fallbackLocale) return undefined;
    return getString(getMessages(fallbackLocale), path);
  }

  function memberRaw(id: string, field: "roleKey" | "bioKey"): string {
    const member = teamData.members.find((m) => m.id === id);
    return member?.[field] ?? "";
  }

  function advisorRaw(id: string, field: "domainKey" | "contributionKey"): string {
    const advisor = teamData.advisors.find((a) => a.id === id);
    return advisor?.[field] ?? "";
  }

  return {
    getMemberCopy(id, field) {
      const translated = resolve(`team.members.items.${id}.${field}`);
      if (translated) return translated;
      return memberRaw(id, field === "role" ? "roleKey" : "bioKey");
    },
    getAdvisorCopy(id, field) {
      const translated = resolve(`team.advisors.items.${id}.${field}`);
      if (translated) return translated;
      return advisorRaw(id, field === "domain" ? "domainKey" : "contributionKey");
    },
    getBrandTagline: () => BRAND_TAGLINE,
  };
}

import { notFound } from "next/navigation";
import { getMessages, type Messages } from "@/src/lib/i18n/messages";
import { isValidLocale } from "@/src/lib/i18n/config";

export type Translator = (key: string, variables?: Record<string, string | number>) => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function parentExists(obj: unknown, path: string): boolean {
  const parts = path.split(".");
  parts.pop();
  if (parts.length === 0) return false;
  return isRecord(getByPath(obj, parts.join(".")));
}

function interpolate(value: string, variables?: Record<string, string | number>): string {
  if (!variables) return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    const replacement = variables[key];
    return replacement === undefined ? `{${key}}` : String(replacement);
  });
}

function formatLeaf(raw: unknown, variables?: Record<string, string | number>): string {
  if (typeof raw === "string") return interpolate(raw, variables);
  if (Array.isArray(raw)) {
    if (raw.length === 0) return "";
    return raw.map((item) => String(item)).join(" · ");
  }
  return "";
}

export async function getTranslator(locale: string, namespace?: string): Promise<Translator> {
  if (!isValidLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (key: string, variables?: Record<string, string | number>): string => {
    if (namespace) {
      const namespacedRoot = getByPath(messages, namespace);
      if (isRecord(namespacedRoot)) {
        const relativeValue = getByPath(namespacedRoot, key);
        if (typeof relativeValue === "string" || Array.isArray(relativeValue)) {
          return formatLeaf(relativeValue, variables);
        }
        if (parentExists(namespacedRoot, key)) {
          return "";
        }
      }
    }

    const absoluteValue = getByPath(messages, key);
    if (typeof absoluteValue === "string" || Array.isArray(absoluteValue)) {
      return formatLeaf(absoluteValue, variables);
    }
    if (parentExists(messages, key)) {
      return "";
    }

    return key;
  };
}

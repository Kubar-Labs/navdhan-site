import { getCloudflareContext } from "@opennextjs/cloudflare";

export type ApplyIntakeMode = "paused" | "staging" | "live";

function runtimeValue(): string | undefined {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const value = env.APPLY_INTAKE_MODE;
    if (typeof value === "string") return value;
  } catch {
    // Build, local development, and unit tests do not have a Cloudflare context.
  }
  return process.env.APPLY_INTAKE_MODE;
}

export function resolveApplyIntakeMode(
  configuredValue: string | undefined,
  nodeEnv: string | undefined,
): ApplyIntakeMode {
  const value = configuredValue?.trim().toLowerCase();
  if (value === "live" || value === "staging" || value === "paused") return value;

  // Production fails closed. Local development and tests remain usable without
  // requiring a deployed Worker binding.
  return nodeEnv === "production" ? "paused" : "staging";
}

export function getApplyIntakeMode(): ApplyIntakeMode {
  return resolveApplyIntakeMode(runtimeValue(), process.env.NODE_ENV);
}

export function isApplyIntakeAvailable(): boolean {
  return getApplyIntakeMode() !== "paused";
}

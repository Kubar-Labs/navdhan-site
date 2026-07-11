import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";
import { cn } from "@/src/lib/utils/cn";

export interface TrustBadgeItem {
  name: string;
  logoAsset?: string;
  altKey?: string;
}

export interface TrustBadgeBarProps {
  badges: TrustBadgeItem[];
  layout?: "inline" | "stacked";
  variant?: "light" | "dark";
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "RBI Aligned": BadgeCheck,
  "Bank-grade encryption": Lock,
  "FACE Registered": ShieldCheck,
};

export function TrustBadgeBar({
  badges,
  layout = "inline",
  variant = "light",
}: TrustBadgeBarProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        layout === "stacked"
          ? "flex-col items-stretch"
          : "flex-row flex-wrap items-center justify-center",
      )}
      aria-label="Trust badges"
    >
      {badges.map((badge) => {
        const Icon = iconMap[badge.name] ?? ShieldCheck;
        return (
          <div
            key={badge.name}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              variant === "dark"
                ? "border-nt-slate-700 bg-nt-slate-800 text-nt-slate-100"
                : "border-nt-slate-200 bg-nt-cream text-nt-slate-700",
            )}
          >
            <Icon className="h-3.5 w-3.5 text-nt-orange-600" aria-hidden="true" />
            <span>{badge.name}</span>
          </div>
        );
      })}
    </div>
  );
}

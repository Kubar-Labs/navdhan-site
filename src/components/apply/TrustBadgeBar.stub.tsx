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
        "flex gap-2.5",
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
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-all shadow-xs",
              variant === "dark"
                ? "border-nt-slate-800 bg-nt-slate-900/80 text-nt-slate-200"
                : "border-nt-slate-200/80 bg-nt-cream/80 text-nt-slate-700 hover:border-nt-slate-300 hover:bg-white",
            )}
          >
            <Icon className="h-3.5 w-3.5 text-nt-orange-600 shrink-0" aria-hidden="true" />
            <span>{badge.name}</span>
          </div>
        );
      })}
    </div>
  );
}

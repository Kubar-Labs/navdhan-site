import { cn } from "@/src/lib/utils/cn";

interface LogoProps {
  variant?: "dark" | "light";
  className?: string;
}

export function Logo({ variant = "dark", className }: LogoProps) {
  const light = variant === "light";

  return (
    <span className={cn("inline-flex items-center gap-3", className)} aria-label="NavDhan">
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-nt-orange-700 text-sm font-semibold text-white"
        aria-hidden="true"
      >
        N
      </span>
      <span
        className={cn(
          "text-2xl font-semibold leading-8 tracking-[-0.5px]",
          light ? "text-white" : "text-nt-slate-900",
        )}
      >
        NavDhan
      </span>
    </span>
  );
}

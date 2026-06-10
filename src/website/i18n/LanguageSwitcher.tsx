import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLang } from "./LanguageProvider";
import { LANGUAGES } from "./messages";

/**
 * Globe dropdown for switching language. `tone="dark"` styles it for dark
 * surfaces (e.g. the footer); default suits the light header.
 */
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { lang, setLang, t } = useLang();
  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t.switcher.label}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-body-sm font-medium transition-colors",
            tone === "dark"
              ? "border-white/20 text-white/85 hover:border-white/50"
              : "border-mist text-ink hover:border-ink",
          )}
        >
          <Globe className="size-4" aria-hidden />
          <span>{current?.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => setLang(l.code)}
            className="flex items-center justify-between gap-4"
          >
            <span>{l.label}</span>
            {l.code === lang && <Check className="size-4 text-ember" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

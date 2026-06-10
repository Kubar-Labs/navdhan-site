import { useT } from "@/website/i18n";

/**
 * Slim dark bar above the nav for a single time-sensitive message.
 * Carbon background, centered caption text, one inline ember link.
 */
export function AnnouncementBar() {
  const t = useT();
  return (
    <div className="w-full bg-carbon">
      <div className="container-prose flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 py-2 text-center text-caption font-medium text-white/90">
        <span>{t.announcement.text}</span>
        <a href="#emi" className="font-semibold text-ember hover:underline">
          {t.announcement.cta}
        </a>
      </div>
    </div>
  );
}

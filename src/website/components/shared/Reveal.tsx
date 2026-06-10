import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals its contents with a fade-up as it scrolls into view.
 *
 * - `stagger` makes direct children animate one after another (for card grids).
 * - Falls back to immediately visible when IntersectionObserver is unavailable.
 * - Honors `prefers-reduced-motion` and no-JS via CSS (see styles.css).
 */
export function Reveal({
  children,
  className,
  stagger = false,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) io.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <div ref={ref} className={cn(stagger ? "stagger" : "reveal", shown && "in", className)}>
      {children}
    </div>
  );
}

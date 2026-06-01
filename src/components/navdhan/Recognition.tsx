import { ArrowUpRight, Award } from "lucide-react";

export function Recognition() {
  return (
    <section className="bg-background py-24">
      <div className="container-prose grid gap-6 md:grid-cols-2">
        <a
          href="#"
          className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-8 shadow-soft transition-colors hover:border-gold/60"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Featured Article
          </p>
          <div className="mt-10">
            <h3 className="font-display text-3xl leading-tight">
              How India's NBFC ecosystem is unlocking credit for MSMEs.
            </h3>
            <div className="mt-6 flex items-center gap-2 text-sm text-foreground">
              Read on the Navdhan blog
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </div>
        </a>

        <div className="rounded-2xl border border-border bg-ink p-8 text-ink-foreground shadow-soft">
          <div className="flex items-center gap-3">
            <Award className="size-5 text-gold" aria-hidden />
            <p className="text-xs uppercase tracking-[0.22em] text-ink-foreground/70">
              Recognition
            </p>
          </div>
          <h3 className="mt-8 font-display text-3xl leading-tight">
            Featured by FACE & recognized by leading fintech publications.
          </h3>
          <ul className="mt-8 grid grid-cols-2 gap-4 border-t border-ink-foreground/10 pt-6 text-sm text-ink-foreground/80">
            <li>FACE Registered Member</li>
            <li>RBI Aligned Practices</li>
            <li>20+ Lender Partners</li>
            <li>Zero Platform Fee</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

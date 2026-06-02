import { ArrowUpRight, Award } from "lucide-react";

export function Recognition() {
  return (
    <section className="bg-white py-24">
      <div className="container-prose grid gap-6 md:grid-cols-2">
        <a
          href="#"
          className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-8 shadow-soft transition-all duration-300 hover:border-brand-blue/30 hover:shadow-elegant"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-brand-blue font-semibold">
            Featured Article
          </p>
          <div className="mt-10">
            <h3 className="font-display text-3xl leading-tight text-brand-navy">
              How India's NBFC ecosystem is unlocking credit for MSMEs.
            </h3>
            <div className="mt-6 flex items-center gap-2 text-sm text-brand-blue font-semibold transition-colors group-hover:text-brand-blue-hover">
              Read on the Navdhan blog
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </div>
        </a>

        <div className="rounded-2xl border border-transparent bg-gradient-to-br from-brand-green to-brand-navy p-8 text-white shadow-soft">
          <div className="flex items-center gap-3">
            <Award className="size-5 text-brand-orange" aria-hidden />
            <p className="text-xs uppercase tracking-[0.22em] text-white/70">Recognition</p>
          </div>
          <h3 className="mt-8 font-display text-3xl leading-tight text-white">
            Featured by FACE & recognized by leading fintech publications.
          </h3>
          <ul className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <span className="text-brand-orange">✓</span> FACE Registered Member
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-orange">✓</span> RBI Aligned Practices
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-orange">✓</span> 20+ Lender Partners
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-orange">✓</span> Zero Platform Fee
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

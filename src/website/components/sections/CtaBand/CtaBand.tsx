import { Button } from "@/components/ui/button";
import { Reveal } from "@/website/components/shared";
import { useT } from "@/website/i18n";
import { APPLY_URL } from "@/website/config";

export function CtaBand() {
  const { cta } = useT();
  return (
    <section className="bg-paper py-20 md:py-24">
      <div className="container-prose">
        <Reveal className="rounded-xl border border-mist bg-fog px-6 py-16 text-center md:px-16 md:py-20">
          <h2 className="mx-auto max-w-2xl text-heading font-semibold text-balance text-ink md:text-heading-lg">
            {cta.headingLead} <span className="text-ember">{cta.headingAccent}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-body text-graphite">{cta.subtext}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="ember" size="lg">
              <a href={APPLY_URL}>{cta.apply}</a>
            </Button>
            <Button variant="outline" size="lg">
              {cta.talk}
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

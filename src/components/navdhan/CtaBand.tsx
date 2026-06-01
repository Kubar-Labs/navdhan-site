import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section className="bg-ink py-20 text-ink-foreground">
      <div className="container-prose">
        <div className="rounded-2xl border border-ink-foreground/10 bg-gradient-to-br from-ink-foreground/[0.04] to-transparent p-10 text-center md:p-16">
          <h2 className="font-display text-4xl leading-tight text-balance md:text-5xl">
            Get the right loan with{" "}
            <span className="italic text-gold">Navdhan.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-foreground/70">
            Zero Platform Fee · High Approval Rates · Multiple Offers
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="gold" size="lg">Apply Online</Button>
            <Button variant="outline-cream" size="lg">Talk to Us</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

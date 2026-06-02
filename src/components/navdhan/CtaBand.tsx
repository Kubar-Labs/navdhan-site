import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section className="bg-white py-20">
      <div className="container-prose">
        <div className="rounded-2xl border border-transparent bg-gradient-to-br from-brand-blue to-brand-navy p-10 text-center text-white md:p-16 shadow-elegant">
          <h2 className="font-display text-4xl leading-tight text-balance md:text-5xl text-white">
            Get the right loan with{" "}
            <span className="italic text-brand-orange">Navdhan.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Zero Platform Fee · High Approval Rates · Multiple Offers
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="orange" size="lg">Apply Online</Button>
            <Button variant="outline-orange" size="lg">Talk to Us</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

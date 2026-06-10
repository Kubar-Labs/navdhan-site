import { SectionHeading, Reveal } from "@/website/components/shared";
import { useT } from "@/website/i18n";
import { PRODUCT_ICONS } from "./content";

export function LoanProducts() {
  const { products } = useT();
  return (
    <section id="products" className="border-y border-mist bg-paper py-20 md:py-28">
      <div className="container-prose grid gap-12 md:grid-cols-[1fr_1.25fr] md:items-start md:gap-16">
        <Reveal className="md:sticky md:top-28">
          <SectionHeading eyebrow={products.eyebrow} headingClassName="mt-4">
            {products.heading}
          </SectionHeading>
          <p className="mt-5 max-w-md text-body text-graphite">{products.intro}</p>
        </Reveal>

        <Reveal stagger className="grid gap-4 sm:grid-cols-2">
          {products.items.map((item, i) => {
            const Icon = PRODUCT_ICONS[i];
            return (
              <article
                key={item.title}
                className="group rounded-xl border border-mist bg-paper p-6 transition-colors hover:border-ink sm:p-7"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-fog text-ink transition-colors group-hover:bg-ink group-hover:text-paper">
                  {Icon ? <Icon className="size-5" aria-hidden /> : null}
                </div>
                <h3 className="mt-5 text-heading-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-body-sm text-graphite">{item.description}</p>
              </article>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

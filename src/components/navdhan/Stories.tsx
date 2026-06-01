import { Button } from "@/components/ui/button";
import rajivImg from "@/assets/customer-rajiv.jpg";
import sunitaImg from "@/assets/customer-sunita.jpg";
import amitImg from "@/assets/customer-amit.jpg";

const STORIES = [
  {
    image: rajivImg,
    name: "Rajiv K.",
    role: "Garment Shop Owner",
    question:
      "I needed to scale but didn't know where to start. How can I get a loan without collateral?",
    outcome:
      "Rajiv qualified for a collateral-free term loan, securing ₹25 Lakhs.",
    cta: "Check Eligibility",
  },
  {
    image: sunitaImg,
    name: "Sunita M.",
    role: "Handicraft Artisan, Varanasi",
    question:
      "We needed to upgrade our loom but cash flow was tight. Can I get a loan for equipment?",
    outcome:
      "Sunita secured a machinery loan for ₹15 Lakhs at competitive rates.",
    cta: "Get Your Offers",
  },
  {
    image: amitImg,
    name: "Amit V.",
    role: "E-commerce Logistics, Gurugram",
    question:
      "What is the best way to fund my operational expansion and hire more staff?",
    outcome:
      "Amit received a working capital loan of ₹18 Lakhs to optimize operations.",
    cta: "Apply Now",
  },
];

export function Stories() {
  return (
    <section id="stories" className="bg-secondary py-24">
      <div className="container-prose">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Customer Stories
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
              Real business problems,{" "}
              <span className="italic">real solutions.</span>
            </h2>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STORIES.map((story) => (
            <article
              key={story.name}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={story.image}
                  alt={`${story.name}, ${story.role}`}
                  loading="lazy"
                  width={768}
                  height={576}
                  className="size-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-4 text-ink-foreground">
                  <p className="font-display text-lg leading-tight">{story.name}</p>
                  <p className="text-xs text-ink-foreground/75">{story.role}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <p className="font-display text-xl leading-snug">
                  "{story.question}"
                </p>
                <p className="text-sm text-muted-foreground">{story.outcome}</p>
                <Button variant="outline-ink" className="mt-auto w-full">
                  {story.cta}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

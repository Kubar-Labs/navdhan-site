import { ArrowRight } from "lucide-react";
import { SectionHeading, Reveal } from "@/website/components/shared";
import { useT } from "@/website/i18n";
import { STORY_IMAGES } from "./content";

export function Stories() {
  const { stories } = useT();
  return (
    <section id="stories" className="border-t border-mist bg-paper py-20 md:py-28">
      <div className="container-prose">
        <Reveal>
          <SectionHeading eyebrow={stories.eyebrow} headingClassName="mt-3">
            {stories.heading}
          </SectionHeading>
        </Reveal>

        <Reveal stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {stories.items.map((story, i) => (
            <article
              key={story.name}
              className="group flex flex-col overflow-hidden rounded-xl border border-mist bg-paper transition-colors hover:border-ink"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={STORY_IMAGES[i]}
                  alt={`${story.name}, ${story.role}`}
                  loading="lazy"
                  width={768}
                  height={576}
                  className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-6">
                <p className="text-caption font-medium uppercase tracking-[0.06em] text-steel">
                  {story.name} · {story.role}
                </p>
                <p className="text-subheading font-semibold leading-snug text-ink">
                  "{story.question}"
                </p>
                <p className="text-body-sm text-graphite">{story.outcome}</p>
                <a
                  href="#emi"
                  className="mt-auto inline-flex items-center gap-1.5 pt-2 text-body-sm font-semibold text-ink hover:text-ember"
                >
                  {story.cta}
                  <ArrowRight className="size-4 text-ember" aria-hidden />
                </a>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

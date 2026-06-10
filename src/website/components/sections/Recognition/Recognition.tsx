import { Award, Check } from "lucide-react";
import { Eyebrow, Reveal } from "@/website/components/shared";
import { useT } from "@/website/i18n";

export function Recognition() {
  const { recognition } = useT();
  return (
    <section className="bg-fog py-20 md:py-28">
      <Reveal className="container-prose">
        <div className="rounded-xl border border-mist bg-paper p-8 md:p-12">
          <div className="flex items-center gap-2.5">
            <Award className="size-5 text-ember" aria-hidden />
            <Eyebrow>{recognition.eyebrow}</Eyebrow>
          </div>
          <h3 className="mt-8 max-w-2xl text-heading-sm font-semibold leading-snug text-ink md:text-heading">
            {recognition.heading}
          </h3>
          <ul className="mt-8 grid gap-4 border-t border-mist pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {recognition.points.map((point) => (
              <li key={point} className="flex items-center gap-2 text-body-sm text-graphite">
                <Check className="size-4 shrink-0 text-ember" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { RecognitionItem } from "@/src/types";

interface RecognitionCarouselProps {
  eyebrow: string;
  heading: string;
  items: RecognitionItem[];
}

export function RecognitionCarousel({ eyebrow, heading, items }: RecognitionCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<RecognitionItem | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const scrollBy = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 300;
    el.scrollBy({ left: direction === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  return (
    <div className="relative">
      <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">{eyebrow}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-nt-slate-900 md:text-4xl">
          {heading}
        </h2>
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            aria-label="Previous recognition"
            onClick={() => scrollBy("left")}
            className="rounded-full border border-nt-slate-300 bg-white p-2 text-nt-slate-700 hover:border-nt-orange-600 hover:text-nt-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-orange-600"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next recognition"
            onClick={() => scrollBy("right")}
            className="rounded-full border border-nt-slate-300 bg-white p-2 text-nt-slate-700 hover:border-nt-orange-600 hover:text-nt-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-orange-600"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => (
          <article
            key={item.id}
            className="group w-[280px] flex-shrink-0 snap-start rounded-xl border border-nt-slate-200 bg-nt-cream transition-shadow hover:shadow-md md:w-[320px]"
          >
            <button
              type="button"
              onClick={() => setSelected(item)}
              className="block w-full text-left"
              aria-label={`Open details for ${item.titleKey}`}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-nt-slate-200">
                {item.imageAsset ? (
                  <Image
                    src={item.imageAsset}
                    alt={item.titleKey}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 280px, 320px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-nt-slate-100 to-nt-slate-200 text-nt-slate-400">
                    <span className="text-sm font-medium">{item.date}</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="text-sm font-semibold text-nt-orange-600">{item.date}</p>
                <h3 className="mt-2 text-lg font-semibold text-nt-slate-900">{item.titleKey}</h3>
                <p className="mt-2 text-sm leading-relaxed text-nt-slate-600">
                  {item.descriptionKey}
                </p>
                <span className="mt-4 inline-block text-sm font-medium text-nt-orange-600">
                  Read more
                </span>
              </div>
            </button>
          </article>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-nt-slate-900/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.currentTarget === e.target) setSelected(null);
          }}
          role="presentation"
        >
          <div
            className="relative mt-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl md:mt-16 md:p-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recognition-modal-title"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-nt-slate-200 bg-white p-2 text-nt-slate-600 hover:border-nt-orange-600 hover:text-nt-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-orange-600 md:right-6 md:top-6"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-nt-slate-100">
              {selected.imageAsset ? (
                <Image
                  src={selected.imageAsset}
                  alt={selected.titleKey}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-nt-slate-100 to-nt-slate-200 px-8 text-center">
                  <span className="text-lg font-medium text-nt-slate-500">
                    {selected.titleKey}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-nt-orange-600">{selected.date}</p>
              <h3
                id="recognition-modal-title"
                className="mt-2 text-2xl font-semibold tracking-tight text-nt-slate-900 md:text-3xl"
              >
                {selected.titleKey}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-nt-slate-700">{selected.writeUp}</p>
            </div>

            {selected.galleryAssets.length > 0 && (
              <div className="mt-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-nt-slate-500">
                  Gallery
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selected.galleryAssets.map((src, idx) => (
                    <div
                      key={`${selected.id}-${idx}`}
                      className="relative aspect-[4/3] overflow-hidden rounded-lg bg-nt-slate-100"
                    >
                      <Image
                        src={src}
                        alt={`${selected.titleKey} gallery image ${idx + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 240px"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

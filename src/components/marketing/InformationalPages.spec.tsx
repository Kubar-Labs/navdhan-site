/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HowItWorksWalkthrough, InformationFaq } from "./InformationalPages";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => (
    <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={!alt} />
  ),
}));

interface ObserverRecord {
  callback: IntersectionObserverCallback;
  observed: Element[];
  unobserved: Element[];
  disconnected: boolean;
}

let observers: ObserverRecord[] = [];

function installMatchMedia({ mobile = false, reduced = false } = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduced : mobile,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function installIntersectionObserver() {
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px 0px -15% 0px";
    readonly thresholds = [0];
    readonly record: ObserverRecord;

    constructor(callback: IntersectionObserverCallback) {
      this.record = { callback, observed: [], unobserved: [], disconnected: false };
      observers.push(this.record);
    }

    observe = (target: Element) => this.record.observed.push(target);
    unobserve = (target: Element) => this.record.unobserved.push(target);
    disconnect = () => {
      this.record.disconnected = true;
    };
    takeRecords = () => [];
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

function intersection(target: Element, isIntersecting = true): IntersectionObserverEntry {
  return { isIntersecting, target } as IntersectionObserverEntry;
}

describe("How It Works walkthrough reveal", () => {
  beforeEach(() => {
    observers = [];
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 1000,
      top: 1000,
      right: 100,
      bottom: 1100,
      left: 0,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reveals each desktop row once from left to right with the approved stagger", () => {
    installMatchMedia();
    installIntersectionObserver();
    render(<HowItWorksWalkthrough />);

    const section = screen.getByTestId("walkthrough");
    const firstRow = screen.getByTestId("walkthrough-row-1");
    const firstCards = ["01", "02", "03"].map((number) =>
      screen.getByTestId(`walkthrough-card-${number}`),
    );

    expect(section).toHaveAttribute("data-reveal-mode", "desktop");
    expect(observers[0].observed).toHaveLength(3);
    expect(firstCards.every((card) => !card.hasAttribute("data-revealed"))).toBe(true);

    act(() => {
      observers[0].callback([intersection(firstRow)], observers[0] as never);
    });

    expect(firstCards.map((card) => card.style.getPropertyValue("--reveal-delay"))).toEqual([
      "0ms",
      "80ms",
      "160ms",
    ]);
    expect(firstCards.every((card) => card.getAttribute("data-revealed") === "true")).toBe(true);
    expect(observers[0].unobserved).toContain(firstRow);

    act(() => {
      observers[0].callback([intersection(firstRow, false)], observers[0] as never);
    });
    expect(firstCards.every((card) => card.getAttribute("data-revealed") === "true")).toBe(true);
  });

  it("observes and reveals mobile cards independently without a runtime delay", () => {
    installMatchMedia({ mobile: true });
    installIntersectionObserver();
    render(<HowItWorksWalkthrough />);

    const section = screen.getByTestId("walkthrough");
    const fourthCard = screen.getByTestId("walkthrough-card-04");
    const fifthCard = screen.getByTestId("walkthrough-card-05");

    expect(section).toHaveAttribute("data-reveal-mode", "mobile");
    expect(observers[0].observed).toHaveLength(9);

    act(() => {
      observers[0].callback([intersection(fourthCard)], observers[0] as never);
    });

    expect(fourthCard).toHaveAttribute("data-revealed", "true");
    expect(fifthCard).not.toHaveAttribute("data-revealed");
    expect(observers[0].unobserved).toContain(fourthCard);
  });

  it("keeps every card visible when reduced motion is requested", () => {
    installMatchMedia({ reduced: true });
    installIntersectionObserver();
    render(<HowItWorksWalkthrough />);

    expect(screen.getByTestId("walkthrough")).not.toHaveAttribute("data-reveal-mode");
    expect(observers).toHaveLength(0);
  });

  it("keeps every card visible when IntersectionObserver is unavailable", () => {
    installMatchMedia();
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<HowItWorksWalkthrough />);

    expect(screen.getByTestId("walkthrough")).not.toHaveAttribute("data-reveal-mode");
    expect(screen.getAllByTestId(/walkthrough-card-/)).toHaveLength(9);
  });
});

describe("information-page FAQ", () => {
  afterEach(() => cleanup());

  it("exposes and updates expanded state with associated answer regions", () => {
    render(
      <InformationFaq
        eyebrow="Good to know"
        title="Questions"
        idPrefix="test"
        faqs={[
          { question: "First question?", answer: "First answer." },
          { question: "Second question?", answer: "Second answer." },
        ]}
      />,
    );

    const first = screen.getByRole("button", { name: "First question?" });
    const second = screen.getByRole("button", { name: "Second question?" });
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region")).toHaveAccessibleName("First question?");

    fireEvent.click(second);

    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region")).toHaveAccessibleName("Second question?");
  });
});

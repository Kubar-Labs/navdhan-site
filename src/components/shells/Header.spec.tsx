/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/hi/team",
}));

vi.mock("@/src/components/shells/Logo", () => ({
  Logo: () => <span>NavDhan</span>,
}));

import { Header } from "./Header";

describe("Header accessibility", () => {
  afterEach(() => cleanup());

  it("keeps localized navigation labels and a valid mobile-menu control target", () => {
    render(
      <Header
        navLinks={[{ label: "उत्पाद", href: "/hi/#products" }]}
        cta={{ label: "आवेदन", href: "/hi/apply" }}
        currentLocale="hi"
        skipToContentLabel="मुख्य सामग्री पर जाएँ"
        primaryNavigationLabel="मुख्य नेविगेशन"
        languageSelectorLabel="भाषा चुनें"
        mobileMenuOpenLabel="मेन्यू खोलें"
        mobileMenuCloseLabel="मेन्यू बंद करें"
        mobileNavigationLabel="मोबाइल नेविगेशन"
      />,
    );

    expect(screen.getByRole("link", { name: "मुख्य सामग्री पर जाएँ" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("navigation", { name: "मुख्य नेविगेशन" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "भाषा चुनें" })).toHaveValue("hi");

    const toggle = screen.getByRole("button", { name: "मेन्यू खोलें" });
    const mobileNavigation = document.getElementById("mobile-navigation");
    expect(toggle).toHaveAttribute("aria-controls", "mobile-navigation");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(mobileNavigation).toHaveAttribute("hidden");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "मेन्यू बंद करें" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("navigation", { name: "मोबाइल नेविगेशन" })).toBe(
      mobileNavigation,
    );
  });
});

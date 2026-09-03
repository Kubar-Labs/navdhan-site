/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialInstitutionCarousel } from "./FinancialInstitutionCarousel";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

describe("FinancialInstitutionCarousel", () => {
  afterEach(() => cleanup());

  it("renders one accessible list containing all 36 institutions", () => {
    render(<FinancialInstitutionCarousel />);

    const list = screen.getByRole("list", { name: "Financial institutions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(36);
    expect(within(list).getByText("HDFC Bank").className).toContain("srOnly");
    expect(within(list).getByText("SBM Bank India").className).toContain("srOnly");
  });

  it("hides the visual duplicate from assistive technology and uses the approved disclosure", () => {
    const { container } = render(<FinancialInstitutionCarousel />);

    expect(container.querySelector('ul[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.getByText(
      "Product availability, eligibility, pricing and approval are determined by the respective financial institution, made available to us through third-party partnerships instead of direct integrations",
    )).toBeInTheDocument();
  });
});

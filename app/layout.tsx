import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://navdhan.app"),
  title: "NavDhan: Business Financing Applications for India's MSMEs",
  description:
    "Submit a digital business-financing application for lender assessment. Eligibility, pricing, and approval remain subject to lender terms.",
  applicationName: "NavDhan",
  icons: {
    icon: "/assets/logos/navdhan-wordmark.webp",
  },
  openGraph: {
    type: "website",
    siteName: "NavDhan",
    title: "NavDhan: Business Financing Applications for India's MSMEs",
    description:
      "Submit a digital business-financing application for lender assessment. Eligibility, pricing, and approval remain subject to lender terms.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NavDhan: Business Financing Applications for India's MSMEs",
    description:
      "Submit a digital business-financing application for lender assessment. Eligibility, pricing, and approval remain subject to lender terms.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

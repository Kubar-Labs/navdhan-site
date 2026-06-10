import { createFileRoute } from "@tanstack/react-router";
import { Home } from "@/website/pages/Home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Navdhan: Fuel your business growth with the right loan" },
      {
        name: "description",
        content:
          "A loan marketplace by Kubar Labs. Compare offers from 20+ NBFCs and Cooperative Banks with a single application. ₹5L to ₹1Cr+, approvals in 24h to 7 days.",
      },
      { property: "og:title", content: "Navdhan: Business loans, one application" },
      {
        property: "og:description",
        content:
          "Compare offers from 20+ NBFCs and Cooperative Banks with one application. Zero platform fee. RBI aligned, FACE registered.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Home,
});

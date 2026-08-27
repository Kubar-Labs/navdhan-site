import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NavDhan",
    short_name: "NavDhan",
    description: "Business financing applications for India's MSMEs.",
    start_url: "/en",
    display: "standalone",
    background_color: "#fafaf8",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}

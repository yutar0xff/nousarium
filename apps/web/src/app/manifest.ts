import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nousarium",
    short_name: "Nousarium",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#2f5d50",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Halcyon — Calm, private video calls",
    short_name: "Halcyon",
    description: "Peer-to-peer video calls. Open a room, share the link, talk.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0f1a",
    theme_color: "#0d0f1a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

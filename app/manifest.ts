import type { MetadataRoute } from "next";

// Makes the site installable as an app (PWA): "Add to Home Screen" / "Install
// app" opens it full-screen with its own icon, no browser bars. Served by
// Next at /manifest.webmanifest. Icons are drawn from the same 🧠 as the
// homepage title (public/icons/). See public/sw.js for the offline page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Brain Quest",
    short_name: "Brain Quest",
    description: "Logic, math, and riddle quizzes that earn real rewards.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any", // tablets are often used sideways
    background_color: "#f0f9ff", // brand-50, the page background
    theme_color: "#f0f9ff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

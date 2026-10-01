import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Brain Quest - Logic & Reward Quiz",
  description: "Logic, math, and riddle quizzes that earn real rewards.",
  // Installed on an iPhone/iPad via Share -> Add to Home Screen, open
  // full-screen like an app (Android reads app/manifest.ts instead).
  appleWebApp: { capable: true, title: "Brain Quest", statusBarStyle: "default" },
  // Next writes the newer "mobile-web-app-capable"; iPads older than iOS 16.4
  // only understand the Apple-specific name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f0f9ff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-50 text-slate-800 antialiased">
        {/* max-w-xl matches phone widths almost exactly, so this is a no-op
            there; md/lg let a tablet use more of its actual screen instead
            of rendering a narrow phone-width column with huge dead margins
            on either side. */}
        <div className="mx-auto min-h-screen max-w-xl px-4 pb-10 pt-6 sm:px-6 md:max-w-2xl lg:max-w-3xl">
          {children}
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

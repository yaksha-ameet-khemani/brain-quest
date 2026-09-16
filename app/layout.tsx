import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Quest - Logic & Reward Quiz",
  description: "Logic, math, and riddle quizzes that earn real rewards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
      </body>
    </html>
  );
}

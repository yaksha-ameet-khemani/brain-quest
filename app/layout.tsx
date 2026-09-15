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
        <div className="mx-auto max-w-xl min-h-screen px-4 pb-10 pt-6 sm:px-6">{children}</div>
      </body>
    </html>
  );
}

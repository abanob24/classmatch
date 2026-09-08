import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClassMatch — Tutoring Session Finder",
  description: "Describe what tutoring help you need and get matched to a real available session.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

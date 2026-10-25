import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Pages set only their own part ("Anmelden"), the template adds the product name:
// "Anmelden – Lizenzzentrale" (design.md → Seiten und Rahmen).
export const metadata: Metadata = {
  title: {
    default: "Lizenzzentrale",
    template: "%s – Lizenzzentrale",
  },
  description: "Lizenzen für Bildungsträger verwalten.",
};

// Inter for everything (docs/design-system.md → Typografie). next/font downloads the file at
// build time and serves it from this app, so the browser never asks Google. Latin covers
// ä, ö, ü and ß. globals.css → --font-sans reads the variable.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// No Turnstile script and no preconnect, dns-prefetch or preload to Cloudflare here: the bot
// check loads only on /login and /register (design.md → Bot-Prüfung, "Laden nur bei Bedarf").
// No ThemeProvider either: the theme follows the device, and the Toaster falls back to "system".
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // German throughout, so screen readers read the pages in German.
    <html lang="de" className={inter.variable}>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

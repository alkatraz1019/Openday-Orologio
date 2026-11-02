import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Open Day — Timer Aule",
  description:
    "Timer sincronizzati in tempo reale per coordinare gli open day: un timer per aula, tutti vedono lo stesso countdown.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

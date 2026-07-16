import type { Metadata } from "next";
import { Geist, Geist_Mono, Onest, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font: no render-blocking Google CSS request, fonts served from our
// origin with size-adjusted fallbacks (no layout shift). All four are variable fonts.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const onest = Onest({ subsets: ["latin"], variable: "--font-onest" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  // Absolute base for og:image and canonical URLs (pulse unfurl needs absolute HTTPS).
  metadataBase: new URL(process.env.APP_BASE_URL ?? "http://localhost:3000"),
  title: "Bonfire — Make something happen",
  description: "Live, ambient social presence for your circles.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${onest.variable} ${sourceSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

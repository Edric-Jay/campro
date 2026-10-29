import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "camLUT Pro",
  description: "A browser camera with live film looks. Photos stay on this device.",
};

export const viewport: Viewport = {
  themeColor: "#141413",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} bg-ink text-paper antialiased`}>{children}</body>
    </html>
  );
}

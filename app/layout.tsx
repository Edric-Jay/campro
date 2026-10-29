import type { Metadata, Viewport } from "next";
import { Caveat, DM_Sans, Homemade_Apple, IBM_Plex_Mono, Patrick_Hand, Reenie_Beanie, Shadows_Into_Light } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const patrick = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-patrick" });
const homemade = Homemade_Apple({ subsets: ["latin"], weight: "400", variable: "--font-homemade" });
const shadows = Shadows_Into_Light({ subsets: ["latin"], weight: "400", variable: "--font-shadows" });
const reenie = Reenie_Beanie({ subsets: ["latin"], weight: "400", variable: "--font-reenie" });

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
      <body
        className={`${sans.variable} ${mono.variable} ${caveat.variable} ${patrick.variable} ${homemade.variable} ${shadows.variable} ${reenie.variable} bg-ink text-paper antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

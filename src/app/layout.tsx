import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOVA — a quieter social network",
  description: "A calm social network built for people, not engagement loops.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#f5f3ee", colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

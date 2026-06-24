import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/pwa/PwaRegister";
import { getCookieLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  metadataBase: new URL("https://artales.net"),
  title: {
    default: "ARTales",
    template: "%s · ARTales",
  },
  description:
    "ARTales is a literary publishing and reading platform for living editions, curated collections and structured online reading.",
  applicationName: "ARTales",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ARTales",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/artales-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/artales-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf5ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1528" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getCookieLocale();

  return (
    <html lang={locale}>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

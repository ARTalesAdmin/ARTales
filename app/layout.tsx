import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/pwa/PwaRegister";
import ThemeScript from "@/components/theme/ThemeScript";
import { cookies } from "next/headers";
import { getCookieLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  metadataBase: new URL("https://artales.net"),
  title: {
    default: "ARTales",
    template: "%s · ARTales",
  },
  description:
    "ARTales is an online library for calm reading, curated collections and a reader community around literature.",
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
      { url: "/favicon.svg", type: "image/svg+xml" },
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
    { media: "(prefers-color-scheme: light)", color: "#f7efe2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getCookieLocale();
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("artales_theme")?.value;
  const initialTheme = cookieTheme === "dark" ? "dark" : "light";

  return (
    <html lang={locale} data-artales-theme={initialTheme} style={{ colorScheme: initialTheme }} suppressHydrationWarning>
      <body>
        <ThemeScript initialTheme={initialTheme} />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moby — Trade Smarter",
  description:
    "Onchain intelligence for traders. Follow whales, KOLs, and top-performing traders in real time. Discover trending tokens before they hit the crowd.",
  keywords: [
    "Moby",
    "AssetDash",
    "crypto",
    "smart money",
    "whale tracking",
    "onchain",
    "Solana",
    "trading",
  ],
  authors: [{ name: "AssetDash" }],
  manifest: "/manifest.json",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Moby — Trade Smarter",
    description:
      "Onchain intelligence for traders. Follow whales, KOLs, and top-performing traders in real time.",
    siteName: "Moby",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script prevents flash-of-dark-theme for users who selected light theme.
  // Runs before React hydrates — reads from localStorage (moby-storage) and sets the class.
  const themeScript = `(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('moby-storage') || '{}');
      const theme = stored.state?.theme;
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    } catch (e) {}
  })();`;

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

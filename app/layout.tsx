import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

// Inter for UI (spec §1). IBM Plex Mono is deliberately retained for code, JSON payloads,
// run logs and identifiers — it reads well in dense traces and gives the operational
// surfaces a distinct texture from the UI type.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const APP = process.env.NEXT_PUBLIC_APP_NAME || "BusiGo";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://busigo.app";

export const metadata: Metadata = {
  // metadataBase is what lets every page's relative OG/canonical URLs resolve to absolute
  // ones. Without it Next.js emits a build warning and social cards resolve against the
  // wrong origin when the app is previewed on a deploy URL.
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP} — Your AI Business Operating System`, template: `%s · ${APP}` },
  description:
    "An AI business operating system: understand how your business works, find what's worth automating, build it, and keep a human in control of every decision that matters.",
  applicationName: APP,
  openGraph: { type: "website", siteName: APP, url: SITE_URL },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Blocking (not deferred) on purpose: applies the theme class before first paint so
            there's no flash of the wrong theme. Reads localStorage synchronously, falls back
            to the OS preference, and fails safe to light if either throws (e.g. storage
            blocked in a locked-down browser context). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('busigo-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      {/* AuroraBackground is deliberately NOT mounted here. It used to be global, which put a
          drifting gradient behind every dense dashboard table, run trace and workflow canvas
          — directly against spec §1 ("Never place strong gradients behind dense data"). It is
          now scoped to marketing/auth surfaces in app/(public)/layout.tsx. */}
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

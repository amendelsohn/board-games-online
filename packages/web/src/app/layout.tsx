import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Young_Serif } from "next/font/google";
import "@/styles/globals.css";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import Navbar from "@/components/Navbar";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

const youngSerif = Young_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-young-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BoardGames.online — play with friends, instantly",
  description:
    "Quick-play social board games. Share a 4-letter code, play in seconds. No signups, no downloads.",
};

// Avoid a theme flash before the toggle runs.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('bgo.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'parlor-night':'parlor-day';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${hanken.variable} ${youngSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <QueryProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </QueryProvider>
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-base-300/70">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-base-content/60">
          <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-display text-base text-base-content/80">
            BoardGames.online
          </span>
          <span className="opacity-60">— a quiet parlor on the open web.</span>
        </div>
        <div className="text-xs text-base-content/50 tabular tracking-wide uppercase">
          Next · NestJS · Socket.IO
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BoardGames.online",
  description:
    "Quick-play social board games. Pick a name, share a code, start playing — no signups, no downloads.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Avoid a theme flash before ThemeToggle runs.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bgo.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'night':'cupcake';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <QueryProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-base-300 bg-base-200/50 py-6 text-center text-sm text-base-content/60">
            <div className="max-w-5xl mx-auto px-4">
              Built with Next.js &middot; NestJS &middot; Socket.IO
            </div>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}

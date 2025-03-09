import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Board Games Online",
  description: "Play board games online with friends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light">
      <body className={`${inter.className} overflow-hidden flex flex-col h-full gap-8`}>
        <QueryProvider>
            <div>
              {/* Navbar - fixed at top */}
              <Navbar />

              {/* Main content - scrollable */}
              <main className="container mx-auto overflow-y-auto px-4 justify-start">
                <div className="py-4">
                  {children}
                </div>
              </main>

              {/* Footer - fixed at bottom */}
              <footer className="footer">
                <aside>
                <p>
                  © {new Date().getFullYear()} Board Games Online - A modern
                  implementation of board games using Next.js, React, and
                  TypeScript
                </p>
              </aside>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import Navbar from "@/components/Navbar";
import Link from "next/link";

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
      <body className={inter.className}>
        <QueryProvider>
          <div className="drawer">
            <input id="my-drawer-3" type="checkbox" className="drawer-toggle" /> 
            <div className="drawer-content flex flex-col">
              {/* Navbar */}
              <Navbar />

              {/* Main content */}
              <main className="flex-1 container mx-auto px-4 py-8">
                {children}
              </main>

              {/* Footer */}
              <footer className="footer footer-center p-8 bg-base-200 text-base-content">
                <aside>
                  <p>© {new Date().getFullYear()} Board Games Online - A modern implementation of board games using Next.js, React, and TypeScript</p>
                </aside>
              </footer>
            </div>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}

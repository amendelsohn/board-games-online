import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { QueryProvider } from "@/lib/providers/QueryProvider";

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
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <div className="container">
            <header>
              <h1>Board Games Online</h1>
            </header>
            <main>{children}</main>
            <footer>
              <p>© {new Date().getFullYear()} Board Games Online</p>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import { PrivyProvider } from "@/components/PrivyProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import Image from "next/image";
import Link from "next/link";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auton - Decentralized Tipping with x402",
  description: "Lightweight, decentralized tipping miniapp built on Solana Devnet using the x402 payment protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800`}
      >
        <ThemeProvider>
          <PrivyProvider>
            <WalletProvider>
              <header className="sticky top-0 z-50 py-4">
              <div className="container mx-auto px-4 max-w-7xl">
                <div className="flex items-center justify-between backdrop-blur-xl rounded-full px-6 py-3 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
                  <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative transition-all">
                      <Image
                        src="/auton-logo.png"
                        alt="Auton Logo"
                        width={40}
                        height={40}
                        className="object-contain"
                      />
                    </div>
                    <span className="text-xl font-bold text-white bg-clip-text text-transparent">
                      Auton
                    </span>
                  </Link>
                  <nav className="flex items-center gap-3">
                    <Link
                      href="/"
                      className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 rounded-full transition-all duration-300"
                    >
                      Creator Hub
                    </Link>
                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                    <ThemeToggle />
                  </nav>
                </div>
              </div>
            </header>
            <main className="min-h-[calc(100vh-73px)]">
              {children}
            </main>
            </WalletProvider>
          </PrivyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WalletContextProvider>
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E0E0E0]">
            <div className="container mx-auto px-4 py-4 max-w-7xl">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Image
                    src="/images/auton-logo.png"
                    alt="Auton Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                  <span className="text-xl font-semibold text-gray-900">Auton</span>
                </Link>
                <nav className="flex items-center gap-6">
                  <Link
                    href="/"
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Creator Hub
                  </Link>
                </nav>
              </div>
            </div>
          </header>
          <main className="min-h-[calc(100vh-73px)]">
            {children}
          </main>
        </WalletContextProvider>
      </body>
    </html>
  );
}

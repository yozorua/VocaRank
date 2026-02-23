import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VocaRank",
  description: "The definitive Vocaloid ranking platform.",
};

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} flex flex-col min-h-screen`}>
        <AuthProvider>
          <NextIntlClientProvider messages={messages}>
            <Navbar />
            <main className="flex-grow pt-[var(--header-height)]">
              {children}
            </main>
            <Footer />
          </NextIntlClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

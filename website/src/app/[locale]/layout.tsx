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
  metadataBase: new URL('https://vocarank.live'),
  title: {
    default: 'VocaRank',
    template: '%s | VocaRank',
  },
  description: "The definitive Vocaloid ranking platform. Discover the most popular Vocaloid songs with real-time rankings from YouTube and Niconico.",
  openGraph: {
    siteName: 'VocaRank',
    type: 'website',
    images: [{ url: '/web-app-manifest-512x512.png', width: 512, height: 512, alt: 'VocaRank' }],
  },
  twitter: {
    card: 'summary',
    images: ['/web-app-manifest-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    title: 'VOCARANK',
  },
};

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();
  const session = await getServerSession(authOptions);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} flex flex-col min-h-screen`}>
        <AuthProvider session={session}>
          <PlayerProvider>
            <NextIntlClientProvider messages={messages}>
              <Navbar />
              <main className="flex-grow pt-[var(--header-height)]">
                {children}
              </main>
              <Footer />
            </NextIntlClientProvider>
          </PlayerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

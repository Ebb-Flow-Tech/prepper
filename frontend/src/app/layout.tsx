import type { Metadata } from 'next';
import { Manrope, Geist_Mono } from 'next/font/google';
import { Providers } from '@/lib/providers';
import { TopNav } from '@/components/layout';
import './globals.css';

// Fallback fonts from Google
const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Prepper - Recipe Builder',
  description: 'Kitchen-first recipe workspace for chefs and operators',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Adobe Typekit - Primary fonts */}
        <link rel="stylesheet" href="https://use.typekit.net/syo6zfp.css" />
      </head>
      <body
        className={`${manrope.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="flex h-screen flex-col">
            <TopNav />
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

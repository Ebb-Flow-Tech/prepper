import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import { Providers } from '@/lib/providers';
import { TopNav } from '@/components/layout';
import './globals.css';

// The one sanctioned second face (styleguide §5.4) — scoped to IDs, SKUs,
// codes and logs. Satoshi is self-hosted via @font-face in globals.css.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Reciperep - Recipe Management',
  description: 'Kitchen-first recipe workspace for chefs and operators',
  icons: {
    icon: '/logo/reciperep-favicon-512x512.png',
    apple: '/logo/reciperep-favicon-512x512.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <body className={`${geistMono.variable} antialiased`}>
        <Providers>
          <div className="flex h-dvh flex-col">
            <TopNav />
            <main className="flex-1 min-h-0 overflow-hidden">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

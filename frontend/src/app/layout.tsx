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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Adobe Typekit - Primary fonts */}
        <link rel="stylesheet" href="https://use.typekit.net/syo6zfp.css" />
        {/* Prevent FOUC: apply theme class before first paint (critical for mobile) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('prepper-theme')||'system';var d=t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light':t;document.documentElement.classList.add(d);document.documentElement.style.colorScheme=d}catch(e){}})()`,
          }}
        />
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

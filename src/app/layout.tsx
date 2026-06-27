import type { Metadata } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import { Navbar } from '@/components/Navbar';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Burst — Every drop. Transparent. Fair. Real-time.',
  description: 'The only drop platform that shows you exactly what happened. Live inventory, real-time queue position, and full transparency reports. No bots. No mystery. Just fair drops.',
  keywords: ['drops', 'limited edition', 'sneakers', 'collectibles', 'fair', 'transparent'],
  openGraph: {
    title: 'Burst — Fair Drops, Verified',
    description: 'See your queue position. Watch inventory deplete. Know exactly what happened.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ paddingTop: 'var(--header-height)' }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';

export const metadata: Metadata = {
  title: 'Pablo Intel — Commodity Intelligence Platform',
  description: 'Real-time commodity intelligence: Oil Watchtower (Brent, WTI, tankers, chokepoints) and Minerals Watchtower (gold, silver, copper, PGMs, critical minerals).',
  icons: { icon: '/favicon.svg' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pablo Intel',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#030c18' },
    { media: '(prefers-color-scheme: light)', color: '#edf2f7' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="scanlines crt-vignette">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

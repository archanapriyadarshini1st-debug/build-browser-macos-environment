import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  title: 'BrowserMac — a full computer in your browser',
  description:
    'A persistent Mac-style desktop environment running entirely in your browser: real filesystem, windows, Spaces, Spotlight, Finder, Terminal and more. Your files never leave the device.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-512.png', apple: '/icons/icon-512.png' },
  applicationName: 'BrowserMac',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#101216',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased`}>{children}</body>
    </html>
  );
}

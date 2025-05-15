import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'SpinHarbor – Demo Casino', template: '%s · SpinHarbor' },
  description: 'SpinHarbor is a portfolio demo casino platform. All balances are virtual demo credits; no real money is involved.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#0b0b10', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-text">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

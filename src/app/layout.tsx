import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastBridgeProvider } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'Round Table - Trusted Personal Decision Assistant',
  description: 'Evidence-backed personal decision assistant for important life decisions.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/brand/round-table-favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/round-table-favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/round-table-favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/brand/round-table-favicon.svg',
    apple: '/brand/round-table-apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ToastBridgeProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

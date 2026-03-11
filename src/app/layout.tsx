import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastBridgeProvider } from '@/components/ui/toaster';
import './globals.css';

const GeistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const GeistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Round Table - Multi-Agent Discussion',
  description: 'Multi-agent round-table discussion system for personal advisory',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ToastBridgeProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Geist_Mono, Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Coverdesk — Book Cover Production',
  description: 'A production and approval workspace for grade-book cover designers.',
  icons: {
    icon: '/coverdesk-logo.png',
    apple: '/coverdesk-logo.png',
  },
  openGraph: {
    title: 'Coverdesk — Book Cover Production',
    description: 'Book cover production, organized.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coverdesk — Book Cover Production',
    description: 'Book cover production, organized.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${nunito.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

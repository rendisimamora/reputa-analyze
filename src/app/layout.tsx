import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReputaScan ID — Media Sentiment & Reputation Monitoring',
  description:
    'AI-powered monitoring of Indonesian media for sentiment, reputation, and emerging issues.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      {/*
        suppressHydrationWarning di <body> wajib karena beberapa browser extension
        (ColorZilla, Grammarly, LastPass, dll) menyisipkan atribut ke <body>
        SEBELUM React hydrate — itu hanya menyentuh node ini, bukan turunannya.
      */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

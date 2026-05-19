import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReputaScan ID — Media Sentiment & Reputation Monitoring',
  description:
    'AI-powered monitoring of Indonesian media for sentiment, reputation, and emerging issues.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body>{children}</body>
    </html>
  );
}

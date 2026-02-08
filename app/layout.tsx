import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Harbiz Prospecting',
  description: 'Internal outbound prospecting app for Harbiz SDRs'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

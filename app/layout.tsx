import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Colorize - Color Harmony Generator',
  description: 'Interactive Color Wheel for Complementary, Analogous, and Split-Complementary schemes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
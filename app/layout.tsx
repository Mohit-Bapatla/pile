import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource/caveat/500.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Pile — a little less on your mind',
  description:
    'Dump anything in. Turn voice notes, files, screenshots and messy thoughts into an organized plan.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

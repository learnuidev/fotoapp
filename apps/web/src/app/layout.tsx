import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@foto/auth';

export const metadata: Metadata = {
  title: 'foto — the camera roll of the evening',
  description:
    'Scan the code, shoot the evening, and watch it arrive on the wall. Film rolls that develop at midnight, no app to install, no account for guests.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0a09' },
  ],
  width: 'device-width',
  initialScale: 1,
  // A gallery is a picture; letting a phone zoom into a caption is not the point.
  maximumScale: 5,
};

/**
 * The frame, such as it is.
 *
 * There is deliberately no shell here: the guest screens are a phone in a dark
 * room and the console is a laptop on a table, and the two should not share a
 * chrome. Each area draws its own — `host/layout.tsx` for the console, the gallery
 * pages for the guest.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

/* eslint-disable @next/next/no-sync-scripts */
// app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './contexts/AuthContext';
import TelegramInit from '../components/TelegramInit';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Bingo Game',
  description: 'Telegram Bingo Mini App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js?59"></script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-purple-600 to-blue-600 min-h-screen`}>
        <AuthProvider>
          <TelegramInit />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
// app/layout.tsx
import type { Metadata } from 'next';
import { AuthProvider } from './contexts/AuthContext';
import TelegramInit from '../components/TelegramInit';

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
      <body className="bg-gradient-to-br from-purple-600 to-blue-600 min-h-screen">
        <AuthProvider>
          <TelegramInit />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/components/TelegramInit.tsx - FIXED
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function TelegramInit() {
  const { login, isLoading, isAuthenticated } = useAuth();
  const hasAttemptedLogin = useRef(false);

  useEffect(() => {
    const initializeTelegram = async () => {
      if (hasAttemptedLogin.current || isAuthenticated || isLoading) {
        return;
      }

      hasAttemptedLogin.current = true;
      console.log('🔄 Starting Telegram initialization...');

      try {
        const telegram = (window as any).Telegram;
        
        if (telegram?.WebApp) {
          const webApp = telegram.WebApp;
          console.log('📱 Telegram WebApp detected');
          
          webApp.expand();
          
          if (typeof webApp.enableClosingConfirmation === 'function') {
            webApp.enableClosingConfirmation();
          }
          
          const telegramUser = webApp.initDataUnsafe?.user;
          
          if (telegramUser && telegramUser.id) {
            console.log('🔐 Attempting Telegram authentication with user:', telegramUser);
            
            // Create proper User object from Telegram data
            const userData = {
              id: telegramUser.id.toString(),
              _id: telegramUser.id.toString(),
              telegramId: telegramUser.id.toString(),
              firstName: telegramUser.first_name,
              username: telegramUser.username || `user_${telegramUser.id}`,
              telegramUsername: telegramUser.username,
              language_code: telegramUser.language_code,
              gamesPlayed: 0,
              gamesWon: 0,
              totalScore: 0,
              isAdmin: false,
              isModerator: false,
              role: 'user' as const
            };
            
            console.log('👤 TelegramInit - Created user data:', userData);
            
            await login(userData);
            console.log('✅ Telegram WebApp authenticated successfully');
            return;
          } else {
            console.warn('⚠️ No Telegram user data available');
          }
        } else {
          console.log('🌐 Not in Telegram WebApp environment');
        }

        // Development mode fallback
        console.log('🔧 Falling back to development mode...');
        const devUser = {
          id: 'dev-user-001',
          _id: 'dev-user-001', 
          telegramId: 'dev-telegram-001',
          firstName: 'Development',
          username: 'dev_user',
          language_code: 'en',
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          isAdmin: false,
          isModerator: false,
          role: 'user' as const
        };
        
        await login(devUser);
        console.log('✅ Development mode authentication successful');
        
      } catch (error) {
        console.error('❌ Authentication failed:', error);
        hasAttemptedLogin.current = false;
      }
    };

    if (!isLoading && !isAuthenticated) {
      initializeTelegram();
    }
  }, [login, isLoading, isAuthenticated]);

  return null;
}
// app/components/TelegramInit.tsx - FIXED (prevent multiple auth attempts)
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function TelegramInit() {
  const { login, isLoading, isAuthenticated } = useAuth();
  const hasAttemptedLogin = useRef(false);

  useEffect(() => {
    const initializeTelegram = async () => {
      // Prevent multiple login attempts
      if (hasAttemptedLogin.current || isAuthenticated || isLoading) {
        return;
      }

      hasAttemptedLogin.current = true;
      console.log('🔄 Starting Telegram initialization...');

      try {
        // Check if we're in Telegram WebApp
        const telegram = (window as any).Telegram;
        
        if (telegram?.WebApp) {
          const webApp = telegram.WebApp;
          
          console.log('📱 Telegram WebApp detected');
          
          // Expand the WebApp to full height
          webApp.expand();
          
          // Safely call enableClosingConfirmation if it exists
          if (typeof webApp.enableClosingConfirmation === 'function') {
            webApp.enableClosingConfirmation();
          }
          
          // Get init data for authentication
          const initData = webApp.initData;
          
          if (initData) {
            console.log('🔐 Attempting Telegram authentication...');
            await login(initData);
            console.log('✅ Telegram WebApp authenticated successfully');
            return; // Success, don't fall back to development mode
          } else {
            console.warn('⚠️ No init data available in Telegram WebApp');
          }
        } else {
          console.log('🌐 Not in Telegram WebApp environment');
        }

        // Fallback to development mode only if not in Telegram or Telegram auth failed
        console.log('🔧 Falling back to development mode...');
        await login('development');
        console.log('✅ Development mode authentication successful');
        
      } catch (error) {
        console.error('❌ Authentication failed:', error);
        hasAttemptedLogin.current = false; // Reset on error to allow retry
      }
    };

    // Only initialize if not loading and not already authenticated
    if (!isLoading && !isAuthenticated) {
      initializeTelegram();
    }
  }, [login, isLoading, isAuthenticated]);

  return null;
}
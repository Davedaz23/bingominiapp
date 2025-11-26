// app/components/TelegramInit.tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

declare global {
  interface Window {
    Telegram: {
      WebApp: any;
    };
  }
}

export default function TelegramInit() {
  const { login, isLoading } = useAuth();

  useEffect(() => {
    const initializeTelegram = async () => {
      // Check if we're in Telegram WebApp
      if (window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;
        
        // Expand the WebApp to full height
        webApp.expand();
        
        // Enable closing confirmation
        webApp.enableClosingConfirmation();
        
        // Get init data for authentication
        const initData = webApp.initData;
        
        if (initData) {
          try {
            await login(initData);
            console.log('Telegram WebApp authenticated successfully');
          } catch (error) {
            console.error('Telegram authentication failed:', error);
            // Fallback to development mode
            try {
              await login('development');
            } catch (devError) {
              console.error('Development auth also failed:', devError);
            }
          }
        } else {
          // No init data, use development mode
          try {
            await login('development');
          } catch (error) {
            console.error('Development auth failed:', error);
          }
        }
        
        // Set theme params
        const themeParams = webApp.themeParams;
        if (themeParams) {
          document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color || '#ffffff');
          document.documentElement.style.setProperty('--tg-theme-text-color', themeParams.text_color || '#000000');
          document.documentElement.style.setProperty('--tg-theme-hint-color', themeParams.hint_color || '#999999');
          document.documentElement.style.setProperty('--tg-theme-link-color', themeParams.link_color || '#2481cc');
          document.documentElement.style.setProperty('--tg-theme-button-color', themeParams.button_color || '#2481cc');
          document.documentElement.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color || '#ffffff');
        }
      } else {
        // Not in Telegram, use development mode
        console.log('Not in Telegram WebApp - using development mode');
        try {
          await login('development');
        } catch (error) {
          console.error('Development auth failed:', error);
        }
      }
    };

    if (!isLoading) {
      initializeTelegram();
    }
  }, [login, isLoading]);

  return null;
}
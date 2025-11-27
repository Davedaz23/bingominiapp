// contexts/AuthContext.tsx - FIXED VERSION
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../../services/api';
import { User } from '../../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (initData: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  initializeTelegramAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to set auth data in localStorage
  const setAuthData = (token: string, userData: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bingo_token', token);
      localStorage.setItem('bingo_user', JSON.stringify(userData));
      
      // Safely set IDs with fallbacks
      if (userData._id) {
        localStorage.setItem('user_id', userData._id);
      }
      if (userData.telegramId) {
        localStorage.setItem('telegram_user_id', userData.telegramId);
      }
      
      console.log('🔐 Auth data stored:', {
        userId: userData._id || 'unknown',
        telegramId: userData.telegramId || 'unknown',
        username: userData.username || 'unknown'
      });
    }
  };

  // Helper function to clear auth data
  const clearAuthData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bingo_token');
      localStorage.removeItem('bingo_user');
      localStorage.removeItem('user_id');
      localStorage.removeItem('telegram_user_id');
      localStorage.removeItem('telegram_user_data');
    }
  };

  // Helper function to get user ID from localStorage
  const getUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('user_id');
  };

  // Helper function to get Telegram ID from localStorage
  const getTelegramId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('telegram_user_id');
  };

  // Refresh user data from API
  const refreshUser = async () => {
    const userId = getUserId();
    const telegramId = getTelegramId();

    if (!userId && !telegramId) {
      console.warn('No user ID or Telegram ID found for refresh');
      return;
    }

    try {
      console.log('🔄 Refreshing user data:', { userId, telegramId });
      
      // Try to refresh by Telegram ID first (more reliable)
      if (telegramId) {
        const response = await authAPI.getProfile(telegramId);
        if (response.data.success) {
          setUser(response.data.user);
          localStorage.setItem('bingo_user', JSON.stringify(response.data.user));
          console.log('✅ User data refreshed via Telegram ID');
          return;
        }
      }
      
      // Fallback to user ID
      if (userId && userId !== 'default-user') {
        const response = await authAPI.getProfile(userId);
        if (response.data.success) {
          setUser(response.data.user);
          localStorage.setItem('bingo_user', JSON.stringify(response.data.user));
          console.log('✅ User data refreshed via User ID');
        }
      }
    } catch (error: any) {
      console.error('❌ Error refreshing user data:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // Don't logout on refresh failure, just keep existing user data
    }
  };

  // Initialize Telegram WebApp authentication
  const initializeTelegramAuth = async () => {
    if (typeof window === 'undefined') return;

    try {
      console.log('🔐 Initializing Telegram auth...');
      
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Expand the mini app to full height
        tg.expand();
        
        // Set theme colors to match Telegram
        tg.setHeaderColor('#6b46c1');
        tg.setBackgroundColor('#6b46c1');
        
        // Get Telegram user data
        const telegramUser = tg.initDataUnsafe?.user;
        
        if (telegramUser) {
          console.log('📱 Telegram user detected:', telegramUser);
          
          // Store Telegram user info temporarily
          localStorage.setItem('telegram_user_data', JSON.stringify(telegramUser));
          localStorage.setItem('telegram_user_id', telegramUser.id.toString());
          
          // Auto-authenticate with backend
          await handleTelegramAuthentication(telegramUser);
        } else {
          console.log('⚠️ No Telegram user data in initDataUnsafe');
          
          // Try to get from URL parameters (from bot deep linking)
          const urlParams = new URLSearchParams(window.location.search);
          const telegramId = urlParams.get('tg');
          
          if (telegramId) {
            console.log('🔗 Telegram ID from URL:', telegramId);
            localStorage.setItem('telegram_user_id', telegramId);
            
            // Try to get user profile by Telegram ID
            await refreshUser();
          } else {
            console.log('ℹ️ No Telegram authentication data available');
          }
        }
        
        // Enable closing confirmation
        tg.enableClosingConfirmation();
        
      } else {
        console.log('🌐 Telegram WebApp not detected - running in browser mode');
        // You can set up development/test user here
      }
    } catch (error) {
      console.error('❌ Telegram auth initialization error:', error);
    }
  };

  // Handle Telegram authentication with backend
  const handleTelegramAuthentication = async (telegramUser: any) => {
    try {
      console.log('🔄 Authenticating with backend...');
      
      if (!window.Telegram?.WebApp) {
        console.warn('Telegram WebApp not available for authentication');
        return;
      }

      const initData = window.Telegram.WebApp.initData;
      
      if (!initData) {
        console.warn('No initData available for authentication');
        return;
      }

      // Use the correct method name from authAPI
      const response = await authAPI.telegramLogin(initData);
      
      if (response.data.success) {
        // Set the token and user data
        setAuthData(response.data.token, response.data.user);
        setUser(response.data.user);
        
        console.log('✅ Telegram authentication successful:', response.data.user);
      } else {
        console.error('❌ Telegram authentication failed - response not successful');
        throw new Error(response.data.error || 'Telegram authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Telegram authentication error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Fallback: Try to get user profile by Telegram ID
      try {
        const telegramId = telegramUser.id.toString();
        console.log('🔄 Falling back to profile lookup for Telegram ID:', telegramId);
        
        const profileResponse = await authAPI.getProfile(telegramId);
        if (profileResponse.data.success) {
          setUser(profileResponse.data.user);
          localStorage.setItem('bingo_user', JSON.stringify(profileResponse.data.user));
          
          // Safely set IDs
          if (profileResponse.data.user._id) {
            localStorage.setItem('user_id', profileResponse.data.user._id);
          }
          if (profileResponse.data.user.telegramId) {
            localStorage.setItem('telegram_user_id', profileResponse.data.user.telegramId);
          }
          
          console.log('✅ User profile loaded via fallback');
        }
      } catch (fallbackError) {
        console.error('❌ Fallback authentication also failed:', fallbackError);
      }
    }
  };

  // Quick auth function that uses the new /play endpoint
  const quickAuth = async (telegramId: string) => {
    try {
      console.log('⚡ Starting quick auth for Telegram ID:', telegramId);
      
      const response = await authAPI.quickAuth(telegramId);
      
      if (response.data.success) {
        setAuthData(response.data.token, response.data.user);
        setUser(response.data.user);
        console.log('✅ Quick auth successful:', response.data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Quick auth failed:', error);
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('bingo_token');
        const savedUser = localStorage.getItem('bingo_user');
        const telegramId = localStorage.getItem('telegram_user_id');

        console.log('🔍 Initializing auth state:', {
          hasToken: !!token,
          hasUser: !!savedUser,
          hasTelegramId: !!telegramId
        });

        if (token && savedUser) {
          // Token is automatically handled by axios interceptor
          const userData = JSON.parse(savedUser);
          setUser(userData);
          
          // Verify the token is still valid by refreshing user data
          await refreshUser();
        } else if (telegramId) {
          // No token but have Telegram ID - try quick auth
          console.log('🔄 No token found, but Telegram ID exists - trying quick auth');
          const success = await quickAuth(telegramId);
          if (!success) {
            // If quick auth fails, try regular refresh
            await refreshUser();
          }
        } else {
          console.log('ℹ️ No saved auth data found');
          
          // Initialize Telegram auth if available
          await initializeTelegramAuth();
        }
      } catch (error) {
        console.error('❌ Error restoring auth state:', error);
        // Clear any invalid data
        clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Manual login function (for development/testing)
  const login = async (initData: string) => {
    try {
      setIsLoading(true);
      console.log('🔐 Starting manual login process...');
      
      // Use the correct method name from authAPI
      const response = await authAPI.telegramLogin(initData);
      
      if (response.data.success) {
        // Set the token and user data
        setAuthData(response.data.token, response.data.user);
        setUser(response.data.user);
        
        console.log('✅ Manual login successful:', response.data.user);
      } else {
        console.error('❌ Manual login failed - response not successful');
        throw new Error(response.data.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Manual login error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Clear any partial auth data on login failure
      clearAuthData();
      throw error;
    } finally {
      setIsLoading(false);
      console.log('🏁 Manual login process completed');
    }
  };

  const logout = () => {
    console.log('🚪 Logging out user:', user?.username);
    setUser(null);
    clearAuthData();
    console.log('✅ User logged out successfully');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
    initializeTelegramAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
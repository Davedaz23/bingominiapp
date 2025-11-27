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
      
      // Store both MongoDB ID and Telegram ID
      if (userData._id) {
        localStorage.setItem('user_id', userData._id);
      }
      if (userData.telegramId) {
        localStorage.setItem('telegram_user_id', userData.telegramId);
      }
      
      console.log('🔐 Auth data stored:', {
        mongoId: userData._id,
        telegramId: userData.telegramId,
        username: userData.username
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

  // Refresh user data from API - ONLY if we have valid Telegram data
  const refreshUser = async (): Promise<void> => {
    const userId = getUserId();
    const telegramId = getTelegramId();

    console.log('🔄 Refreshing user data:', { 
      mongoId: userId, 
      telegramId: telegramId 
    });

    // Only refresh if we have a valid Telegram ID (not a made-up one)
    if (!telegramId || telegramId.startsWith('user_') || telegramId.startsWith('auto_') || telegramId === 'default_user') {
      console.warn('⚠️ Invalid Telegram ID detected, skipping refresh:', telegramId);
      return;
    }

    try {
      // Try to refresh by Telegram ID first
      if (telegramId) {
        const response = await authAPI.getProfile(telegramId);
        if (response.data.success) {
          setUser(response.data.user);
          localStorage.setItem('bingo_user', JSON.stringify(response.data.user));
          console.log('✅ User data refreshed via Telegram ID');
          return;
        }
      }
      
      // Fallback to user ID (only if it's a valid MongoDB ID)
      if (userId && userId.match(/^[0-9a-fA-F]{24}$/)) {
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
    }
  };

  // Initialize Telegram WebApp authentication - ONLY create users from real Telegram data
  const initializeTelegramAuth = async (): Promise<void> => {
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
        
        if (telegramUser && telegramUser.id) {
          console.log('📱 Real Telegram user detected:', telegramUser);
          
          // Store Telegram user info
          localStorage.setItem('telegram_user_data', JSON.stringify(telegramUser));
          localStorage.setItem('telegram_user_id', telegramUser.id.toString());
          
          // ONLY authenticate with real Telegram data
          await handleTelegramAuthentication(telegramUser);
        } else {
          console.log('⚠️ No real Telegram user data available');
          // Don't create fake users - just set loading to false
          setIsLoading(false);
        }
        
        // Enable closing confirmation
        tg.enableClosingConfirmation();
        
      } else {
        console.log('🌐 Telegram WebApp not detected - running in browser mode');
        // Don't create fake users in browser mode either
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Telegram auth initialization error:', error);
      setIsLoading(false);
    }
  };

  // Handle Telegram authentication with backend - ONLY for real Telegram users
  const handleTelegramAuthentication = async (telegramUser: any): Promise<void> => {
    try {
      console.log('🔄 Authenticating real Telegram user with backend...');
      
      if (!window.Telegram?.WebApp) {
        console.warn('Telegram WebApp not available for authentication');
        return;
      }

      const initData = window.Telegram.WebApp.initData;
      
      if (!initData) {
        console.warn('No initData available for authentication');
        return;
      }

      // Use the real Telegram authentication
      const response = await authAPI.telegramLogin(initData);
      
      if (response.data.success) {
        setAuthData(response.data.token, response.data.user);
        setUser(response.data.user);
        
        console.log('✅ Real Telegram authentication successful:', response.data.user);
      } else {
        console.error('❌ Telegram authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Telegram authentication error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('bingo_token');
        const savedUser = localStorage.getItem('bingo_user');
        const telegramId = getTelegramId();

        console.log('🔍 Initializing auth state:', {
          hasToken: !!token,
          hasUser: !!savedUser,
          hasTelegramId: !!telegramId,
          telegramId: telegramId
        });

        // Check if we have a valid Telegram ID (not a fake one)
        const isValidTelegramId = telegramId && 
          !telegramId.startsWith('user_') && 
          !telegramId.startsWith('auto_') && 
          !telegramId.startsWith('default_') &&
          telegramId !== 'default_user';

        if (token && savedUser && isValidTelegramId) {
          // Restore user from localStorage if we have valid Telegram data
          const userData = JSON.parse(savedUser);
          setUser(userData);
          
          // Verify the user still exists
          await refreshUser();
        } else if (isValidTelegramId) {
          // We have a valid Telegram ID but no token - try to refresh
          console.log('🔄 Valid Telegram ID found, refreshing user data');
          await refreshUser();
        } else {
          // No valid Telegram data - initialize Telegram auth
          console.log('ℹ️ No valid Telegram data found - initializing Telegram auth');
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

  // Manual login function (for development/testing) - ONLY with real initData
  const login = async (initData: string) => {
    try {
      setIsLoading(true);
      console.log('🔐 Starting manual login process...');
      
      const response = await authAPI.telegramLogin(initData);
      
      if (response.data.success) {
        setAuthData(response.data.token, response.data.user);
        setUser(response.data.user);
        console.log('✅ Manual login successful:', response.data.user);
      } else {
        console.error('❌ Manual login failed');
        throw new Error(response.data.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Manual login error:', error);
      clearAuthData();
      throw error;
    } finally {
      setIsLoading(false);
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
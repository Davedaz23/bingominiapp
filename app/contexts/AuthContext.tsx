// contexts/AuthContext.tsx - FIXED (Remove API dependency)
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Helper function to set auth data
  const setAuthData = (token: string, userData: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bingo_token', token);
      localStorage.setItem('bingo_user', JSON.stringify(userData));
      
      if (userData._id) {
        localStorage.setItem('user_id', userData._id);
      }
      if (userData.telegramId) {
        localStorage.setItem('telegram_user_id', userData.telegramId);
      }
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

  // Get user ID from localStorage
  const getUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('user_id');
  };

  // Get Telegram ID from localStorage
  const getTelegramId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('telegram_user_id');
  };

  // Refresh user data - MOVED TO COMPONENT LEVEL
  const refreshUser = async (): Promise<void> => {
    // This will be implemented in components that need it
    console.log('🔄 Refresh user called - implement in component');
  };

  // Initialize Telegram WebApp authentication
  const initializeTelegramAuth = async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      console.log('🔐 Initializing Telegram auth...');
      
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        
        const telegramUser = tg.initDataUnsafe?.user;
        
        if (telegramUser && telegramUser.id) {
          console.log('📱 Real Telegram user detected:', telegramUser);
          localStorage.setItem('telegram_user_data', JSON.stringify(telegramUser));
          localStorage.setItem('telegram_user_id', telegramUser.id.toString());
        }
      }
    } catch (error) {
      console.error('❌ Telegram auth initialization error:', error);
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
        });

        if (token && savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
        }
      } catch (error) {
        console.error('❌ Error restoring auth state:', error);
        clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function - will be implemented by components
  const login = async (initData: string) => {
    console.log('🔐 Login called - implement in component');
    throw new Error('Login not implemented in AuthContext');
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    setUser(null);
    clearAuthData();
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
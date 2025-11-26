// contexts/AuthContext.tsx
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to set token in localStorage
  const setToken = (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bingo_token', token);
      
      // Extract user ID from token (simple implementation)
      try {
        const parts = token.split('.');
        if (parts.length > 1) {
          const payload = JSON.parse(atob(parts[1]));
          const userId = payload.userId || payload.sub || payload.id || 'default-user';
          localStorage.setItem('user_id', userId);
          console.log('Stored user ID:', userId);
        }
      } catch (error) {
        console.warn('Failed to parse token for user ID:', error);
        localStorage.setItem('user_id', 'default-user');
      }
    }
  };

  // Helper function to get user ID from localStorage
  const getUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('user_id');
  };

  // Refresh user data from API
  const refreshUser = async () => {
    const userId = getUserId();
    if (!userId || userId === 'default-user') {
      console.warn('No valid user ID found for refresh');
      return;
    }

    try {
      console.log('Refreshing user data for ID:', userId);
      const response = await authAPI.getProfile(userId);
      if (response.data.success) {
        setUser(response.data.user);
        localStorage.setItem('bingo_user', JSON.stringify(response.data.user));
        console.log('User data refreshed successfully');
      } else {
        console.warn('Failed to refresh user profile - response not successful');
      }
    } catch (error: any) {
      console.error('Error refreshing user data:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // Don't logout on refresh failure, just keep existing user data
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('bingo_token');
        const savedUser = localStorage.getItem('bingo_user');

        console.log('Initializing auth - token exists:', !!token, 'user exists:', !!savedUser);

        if (token && savedUser) {
          // Token is automatically handled by axios interceptor
          const userData = JSON.parse(savedUser);
          setUser(userData);
          
          // Verify the token is still valid by refreshing user data
          await refreshUser();
        } else {
          console.log('No saved auth data found');
        }
      } catch (error) {
        console.error('Error restoring auth state:', error);
        // Don't logout immediately, just clear invalid data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('bingo_token');
          localStorage.removeItem('bingo_user');
          localStorage.removeItem('user_id');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (initData: string) => {
    try {
      setIsLoading(true);
      console.log('Starting Telegram login...');
      
      // Use the correct method name from authAPI
      const response = await authAPI.telegramLogin(initData);
      
      if (response.data.success) {
        // Set the token and user data
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem('bingo_user', JSON.stringify(response.data.user));
        
        console.log('Login successful:', response.data.user);
      } else {
        // FIXED: Use response.data.error instead of response.data.success
        throw new Error(response.data.success || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('Login failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Provide more specific error messages
      let errorMessage = 'Login failed';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error - please check your connection';
      }
      
      // Clear any partial auth data on login failure
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bingo_token');
        localStorage.removeItem('bingo_user');
        localStorage.removeItem('user_id');
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('Logging out user:', user?.username);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bingo_token');
      localStorage.removeItem('bingo_user');
      localStorage.removeItem('user_id');
    }
    console.log('User logged out successfully');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
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
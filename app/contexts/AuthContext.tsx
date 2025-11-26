// contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { User } from '../../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (initData: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('bingo_token');
      const savedUser = localStorage.getItem('bingo_user');

      if (token && savedUser) {
        try {
          apiService.setToken(token);
          const userData = JSON.parse(savedUser);
          setUser(userData);
        } catch (error) {
          console.error('Error restoring auth state:', error);
          logout();
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (initData: string) => {
    try {
      setIsLoading(true);
      const response = await apiService.telegramAuth(initData);
      
      if (response.success) {
        setUser(response.user);
        localStorage.setItem('bingo_user', JSON.stringify(response.user));
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bingo_token');
    localStorage.removeItem('bingo_user');
    localStorage.removeItem('user_id');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
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
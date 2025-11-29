// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface User {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  telegramUsername?: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  userRole: string;
  hasPermission: (permission: string) => boolean;
  login: (telegramData: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user from Telegram WebApp or localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // First, check if we're in a Telegram context
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
          const tg = (window as any).Telegram.WebApp;
          const tgUser = tg.initDataUnsafe?.user;
          
          if (tgUser) {
            console.log('🔐 Telegram user detected:', tgUser);
            
            // Transform Telegram user to our User format
            const userData: User = {
              id: tgUser.id.toString(),
              telegramId: tgUser.id.toString(),
              firstName: tgUser.first_name,
              lastName: tgUser.last_name,
              username: tgUser.username,
              telegramUsername: tgUser.username,
              role: 'user', // Default role
              permissions: ['play_games', 'view_games'] // Default permissions
            };
            
            // Check if this is the admin user
            if (tgUser.id === 444206486 || tgUser.first_name === 'ሰው') {
              userData.role = 'admin';
              userData.permissions = ['manage_games', 'manage_users', 'view_reports', 'play_games', 'view_games'];
              console.log('👑 Admin user detected');
            }
            
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('user_id', userData.id);
          } else {
            console.log('⚠️ No Telegram user data found');
            // Check localStorage for existing user
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              setUser(JSON.parse(storedUser));
            }
          }
        } else {
          console.log('🌐 Not in Telegram context, checking localStorage');
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = (telegramData: any) => {
    try {
      const userData: User = {
        id: telegramData.id.toString(),
        telegramId: telegramData.id.toString(),
        firstName: telegramData.first_name,
        lastName: telegramData.last_name,
        username: telegramData.username,
        telegramUsername: telegramData.username,
        role: 'user',
        permissions: ['play_games', 'view_games']
      };

      // Admin check
      if (telegramData.id === 444206486 || telegramData.first_name === 'ሰው') {
        userData.role = 'admin';
        userData.permissions = ['manage_games', 'manage_users', 'view_reports', 'play_games', 'view_games'];
      }

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('user_id', userData.id);
      
      console.log('✅ User logged in:', userData);
    } catch (error) {
      console.error('❌ Login error:', error);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('user_id');
    router.push('/');
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isModerator = user?.role === 'moderator';
  const userRole = user?.role || 'user';

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isAdmin,
        isModerator,
        userRole,
        hasPermission,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
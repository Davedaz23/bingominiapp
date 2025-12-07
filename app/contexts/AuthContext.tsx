/* eslint-disable @typescript-eslint/no-explicit-any */
// contexts/AuthContext.tsx - UPDATED WITH WALLET BALANCE
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, walletAPIAuto } from '../../services/api';

interface BackendUser {
  _id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  telegramUsername?: string;
  role: string;
  isAdmin?: boolean;
  isModerator?: boolean;
  walletBalance?: number;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
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
  walletBalance?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  userRole: string;
  walletBalance: number; // Add wallet balance to context
  hasPermission: (permission: string) => boolean;
  login: (telegramData: any) => Promise<void>;
  logout: () => void;
  refreshWalletBalance: () => Promise<void>; // Add refresh method
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const router = useRouter();

  // Fetch actual user data from backend
  const fetchUserFromBackend = async (telegramId: string): Promise<BackendUser | null> => {
    try {
      console.log('🔍 Fetching user data from backend for Telegram ID:', telegramId);
      
      // Try multiple endpoints to get user data
      try {
        const response = await authAPI.quickAuth(telegramId);
        if (response.data.success && response.data.user) {
          console.log('✅ User found via quick-auth:', response.data.user);
          return response.data.user;
        }
      } catch (error) {
        console.log('⚠️ quick-auth failed, trying play endpoint');
      }
      
      // Try play endpoint (creates user if doesn't exist)
      try {
        const response = await authAPI.play(telegramId);
        if (response.data.success && response.data.user) {
          console.log('✅ User created/found via play endpoint:', response.data.user);
          return response.data.user;
        }
      } catch (error) {
        console.log('❌ All user fetch strategies failed');
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error fetching user from backend:', error);
      return null;
    }
  };

  // Fetch wallet balance for the actual user
  const fetchWalletBalanceForUser = async (userId: string): Promise<number> => {
    try {
      console.log('💰 Fetching wallet balance for user ID:', userId);
      
      // Make sure we have the proper user ID in localStorage for wallet API
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_id', userId);
      }
      
      const balanceResponse = await walletAPIAuto.getBalance();
      
      if (balanceResponse.data.success) {
        const balance = balanceResponse.data.balance;
        console.log('✅ Wallet balance fetched:', balance);
        return balance;
      } else {
        console.log('⚠️ No wallet balance found, using 0');
        return 0;
      }
    } catch (error: any) {
      console.log('💰 Wallet balance fetch failed:', error.message);
      return 0;
    }
  };

  // Transform backend user to frontend user format
  const transformBackendUser = (backendUser: BackendUser): User => {
    return {
      id: backendUser._id, // Use MongoDB _id as the primary ID
      telegramId: backendUser.telegramId,
      firstName: backendUser.firstName,
      lastName: backendUser.lastName,
      username: backendUser.username,
      telegramUsername: backendUser.telegramUsername,
      role: backendUser.role,
      permissions: backendUser.permissions,
      walletBalance: backendUser.walletBalance
    };
  };

  // Main authentication initialization
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
            
            // Fetch actual user data from backend
            const backendUser = await fetchUserFromBackend(tgUser.id.toString());
            
            let userData: User;
            
            if (backendUser) {
              // Use backend data with proper MongoDB _id
              userData = transformBackendUser(backendUser);
              
              // Check admin status
              if (tgUser.id === 444206486 || tgUser.first_name === 'ሰው' || backendUser.isAdmin) {
                userData.role = 'admin';
                userData.permissions = ['manage_games', 'manage_users', 'view_reports', 'play_games', 'view_games'];
                console.log('👑 Admin user detected');
              }
              
              setUser(userData);
              
              // Fetch wallet balance using the proper user ID
              const balance = await fetchWalletBalanceForUser(userData.id);
              setWalletBalance(balance);
              
              // Store both user data and IDs
              localStorage.setItem('user', JSON.stringify(userData));
              localStorage.setItem('user_id', userData.id);
              localStorage.setItem('telegram_user_id', userData.telegramId);
              localStorage.setItem('wallet_balance', balance.toString());
              
            } else {
              // Fallback to Telegram data
              console.warn('⚠️ Using fallback Telegram data');
              userData = {
                id: tgUser.id.toString(),
                telegramId: tgUser.id.toString(),
                firstName: tgUser.first_name,
                lastName: tgUser.last_name,
                username: tgUser.username,
                telegramUsername: tgUser.username,
                role: 'user',
                permissions: ['play_games', 'view_games']
              };
              
              if (tgUser.id === 444206486 || tgUser.first_name === 'ሰው') {
                userData.role = 'admin';
                userData.permissions = ['manage_games', 'manage_users', 'view_reports', 'play_games', 'view_games'];
              }
              
              setUser(userData);
              
              // Try to fetch wallet balance with Telegram ID
              const balance = await fetchWalletBalanceForUser(userData.id);
              setWalletBalance(balance);
              
              localStorage.setItem('user', JSON.stringify(userData));
              localStorage.setItem('user_id', userData.id);
              localStorage.setItem('telegram_user_id', userData.telegramId);
              localStorage.setItem('wallet_balance', balance.toString());
            }
            
          } else {
            console.log('⚠️ No Telegram user data found');
            await restoreUserFromStorage();
          }
        } else {
          console.log('🌐 Not in Telegram context');
          await restoreUserFromStorage();
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const restoreUserFromStorage = async () => {
      const storedUser = localStorage.getItem('user');
      const storedBalance = localStorage.getItem('wallet_balance');
      
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        if (storedBalance) {
          setWalletBalance(parseFloat(storedBalance));
        } else {
          // Refresh balance for stored user
          const balance = await fetchWalletBalanceForUser(userData.id);
          setWalletBalance(balance);
        }
        
        console.log('✅ User restored from storage:', userData);
      }
    };

    initializeAuth();
  }, []);

  const login = async (telegramData: any) => {
    try {
      console.log('🔐 Logging in user:', telegramData);
      
      // Fetch actual user data from backend
      const backendUser = await fetchUserFromBackend(telegramData.id.toString());
      
      let userData: User;
      
      if (backendUser) {
        userData = transformBackendUser(backendUser);
        
        // Check admin status
        if (telegramData.id === 444206486 || telegramData.first_name === 'ሰው' || backendUser.isAdmin) {
          userData.role = 'admin';
          userData.permissions = ['manage_games', 'manage_users', 'view_reports', 'play_games', 'view_games'];
        }
      } else {
        // Fallback
        userData = {
          id: telegramData.id.toString(),
          telegramId: telegramData.id.toString(),
          firstName: telegramData.first_name,
          lastName: telegramData.last_name,
          username: telegramData.username,
          telegramUsername: telegramData.username,
          role: 'user',
          permissions: ['play_games', 'view_games']
        };
        
        if (telegramData.id === 444206486 || telegramData.first_name === 'ሰው') {
          userData.role = 'admin';
          userData.permissions = ['manage_games', 'manage_users', 'view_reports', 'play_games', 'view_games'];
        }
      }

      setUser(userData);
      
      // Fetch wallet balance
      const balance = await fetchWalletBalanceForUser(userData.id);
      setWalletBalance(balance);
      
      // Store auth data
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('user_id', userData.id);
      localStorage.setItem('telegram_user_id', userData.telegramId);
      localStorage.setItem('wallet_balance', balance.toString());
      
      console.log('✅ User logged in with balance:', balance);
    } catch (error) {
      console.error('❌ Login error:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setWalletBalance(0);
    localStorage.removeItem('user');
    localStorage.removeItem('user_id');
    localStorage.removeItem('telegram_user_id');
    localStorage.removeItem('wallet_balance');
    router.push('/');
  };

  // Add method to refresh wallet balance
  // Update refreshWalletBalance function in AuthContext
const refreshWalletBalance = async (): Promise<void> => {
  if (!user) return;
  
  try {
    console.log('💰 Refreshing wallet balance...');
    
    // Fetch fresh balance from API
    const balance = await fetchWalletBalanceForUser(user.id);
    
    // Update wallet balance state
    setWalletBalance(balance);
    
    // Also update the user object with new balance
    setUser(prev => prev ? {
      ...prev,
      walletBalance: balance
    } : null);
    
    // Update localStorage
    localStorage.setItem('wallet_balance', balance.toString());
    
    // Update user in localStorage with new balance
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      userData.walletBalance = balance;
      localStorage.setItem('user', JSON.stringify(userData));
    }
    
    console.log('✅ Wallet balance refreshed:', balance);
  } catch (error) {
    console.error('❌ Error refreshing wallet balance:', error);
    // Try to use cached balance as fallback
    const storedBalance = localStorage.getItem('wallet_balance');
    if (storedBalance) {
      const fallbackBalance = parseFloat(storedBalance);
      setWalletBalance(fallbackBalance);
      console.log('⚠️ Using cached balance as fallback:', fallbackBalance);
    }
  }
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
        walletBalance, // Include wallet balance in context
        hasPermission,
        login,
        logout,
        refreshWalletBalance, // Include refresh method
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
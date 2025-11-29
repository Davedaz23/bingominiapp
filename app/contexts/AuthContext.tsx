// contexts/AuthContext.tsx - UPDATED WITH ACCOUNT-SPECIFIC STORAGE
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
  walletBalance: number;
  hasPermission: (permission: string) => boolean;
  login: (telegramData: any) => Promise<void>;
  logout: () => void;
  refreshWalletBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Account-specific storage management
const getAccountStorageKey = (baseKey: string, telegramId?: string): string => {
  if (!telegramId) return baseKey;
  return `${baseKey}_${telegramId}`;
};

const getAccountData = (baseKey: string, telegramId?: string): any => {
  if (typeof window === 'undefined') return null;
  
  const accountKey = getAccountStorageKey(baseKey, telegramId);
  const stored = localStorage.getItem(accountKey);
  
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn(`⚠️ Failed to parse stored data for ${accountKey}:`, error);
      return null;
    }
  }
  return null;
};

const setAccountData = (baseKey: string, data: any, telegramId?: string): void => {
  if (typeof window === 'undefined' || !telegramId) return;
  
  const accountKey = getAccountStorageKey(baseKey, telegramId);
  localStorage.setItem(accountKey, JSON.stringify(data));
};

const removeAccountData = (baseKey: string, telegramId?: string): void => {
  if (typeof window === 'undefined') return;
  
  const accountKey = getAccountStorageKey(baseKey, telegramId);
  localStorage.removeItem(accountKey);
};

// Clean up old storage data when switching accounts
const cleanupOldStorage = (currentTelegramId: string) => {
  if (typeof window === 'undefined') return;
  
  // Get all keys that might be account-specific
  const allKeys = Object.keys(localStorage);
  const accountKeys = allKeys.filter(key => 
    key.includes('_') && 
    !key.endsWith(currentTelegramId) &&
    (key.includes('user_') || key.includes('selected_number_') || key.includes('wallet_balance_'))
  );
  
  // Remove old account data
  accountKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  
  if (accountKeys.length > 0) {
    console.log('🧹 Cleaned up old account data:', accountKeys);
  }
};

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
  const fetchWalletBalanceForUser = async (userId: string, telegramId: string): Promise<number> => {
    try {
      console.log('💰 Fetching wallet balance for user ID:', userId);
      
      // Store user ID for wallet API
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_id', userId);
        setAccountData('user_id', userId, telegramId);
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
      id: backendUser._id,
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
            
            const telegramId = tgUser.id.toString();
            
            // Clean up old storage data when detecting a new account
            cleanupOldStorage(telegramId);
            
            // Check if we already have this user's data
            const storedUser = getAccountData('user', telegramId);
            const storedBalance = getAccountData('wallet_balance', telegramId);
            
            if (storedUser && storedUser.telegramId === telegramId) {
              // Use stored data for faster loading
              console.log('✅ Using stored user data');
              setUser(storedUser);
              setWalletBalance(storedBalance || 0);
              setIsLoading(false);
              
              // Refresh data in background
              refreshUserData(telegramId);
              return;
            }
            
            // Fetch fresh user data from backend
            await refreshUserData(telegramId);
            
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
        setIsLoading(false);
      }
    };

    const refreshUserData = async (telegramId: string) => {
      try {
        const backendUser = await fetchUserFromBackend(telegramId);
        
        let userData: User;
        
        if (backendUser) {
          // Use backend data with proper MongoDB _id
          userData = transformBackendUser(backendUser);
          
          // Check admin status
          const tg = (window as any).Telegram?.WebApp;
          const tgUser = tg?.initDataUnsafe?.user;
          if (tgUser && (tgUser.id === 444206486 || tgUser.first_name === 'ሰው' || backendUser.isAdmin)) {
            userData.role = 'admin';
            userData.permissions = ['manage_games', 'manage_users', 'view_reports', 'play_games', 'view_games'];
            console.log('👑 Admin user detected');
          }
          
          setUser(userData);
          
          // Fetch wallet balance using the proper user ID
          const balance = await fetchWalletBalanceForUser(userData.id, telegramId);
          setWalletBalance(balance);
          
          // Store account-specific data
          setAccountData('user', userData, telegramId);
          setAccountData('wallet_balance', balance, telegramId);
          setAccountData('user_id', userData.id, telegramId);
          setAccountData('telegram_user_id', telegramId, telegramId);
          
        } else {
          // Fallback to Telegram data
          console.warn('⚠️ Using fallback Telegram data');
          const tg = (window as any).Telegram.WebApp;
          const tgUser = tg.initDataUnsafe.user;
          
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
          const balance = await fetchWalletBalanceForUser(userData.id, telegramId);
          setWalletBalance(balance);
          
          // Store account-specific data
          setAccountData('user', userData, telegramId);
          setAccountData('wallet_balance', balance, telegramId);
          setAccountData('user_id', userData.id, telegramId);
          setAccountData('telegram_user_id', telegramId, telegramId);
        }
        
      } catch (error) {
        console.error('❌ Error refreshing user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const restoreUserFromStorage = async () => {
      // Try to find any stored user data
      const allKeys = Object.keys(localStorage);
      const userKeys = allKeys.filter(key => key.startsWith('user_'));
      
      if (userKeys.length > 0) {
        // Use the first found user (most recent)
        const userKey = userKeys[0];
        const telegramId = userKey.replace('user_', '');
        
        const storedUser = getAccountData('user', telegramId);
        const storedBalance = getAccountData('wallet_balance', telegramId);
        
        if (storedUser) {
          setUser(storedUser);
          setWalletBalance(storedBalance || 0);
          console.log('✅ User restored from storage:', storedUser);
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (telegramData: any) => {
    try {
      console.log('🔐 Logging in user:', telegramData);
      
      const telegramId = telegramData.id.toString();
      
      // Clean up old storage
      cleanupOldStorage(telegramId);
      
      // Fetch actual user data from backend
      const backendUser = await fetchUserFromBackend(telegramId);
      
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
      const balance = await fetchWalletBalanceForUser(userData.id, telegramId);
      setWalletBalance(balance);
      
      // Store account-specific data
      setAccountData('user', userData, telegramId);
      setAccountData('wallet_balance', balance, telegramId);
      setAccountData('user_id', userData.id, telegramId);
      setAccountData('telegram_user_id', telegramId, telegramId);
      
      console.log('✅ User logged in with balance:', balance);
    } catch (error) {
      console.error('❌ Login error:', error);
    }
  };

  const logout = () => {
    if (user?.telegramId) {
      // Remove account-specific data
      removeAccountData('user', user.telegramId);
      removeAccountData('wallet_balance', user.telegramId);
      removeAccountData('user_id', user.telegramId);
      removeAccountData('telegram_user_id', user.telegramId);
      removeAccountData('selected_number', user.telegramId);
    }
    
    setUser(null);
    setWalletBalance(0);
    router.push('/');
  };

  // Add method to refresh wallet balance
  const refreshWalletBalance = async (): Promise<void> => {
    if (!user) return;
    
    try {
      const balance = await fetchWalletBalanceForUser(user.id, user.telegramId);
      setWalletBalance(balance);
      setAccountData('wallet_balance', balance, user.telegramId);
      console.log('💰 Wallet balance refreshed:', balance);
    } catch (error) {
      console.error('❌ Error refreshing wallet balance:', error);
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
        walletBalance,
        hasPermission,
        login,
        logout,
        refreshWalletBalance,
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
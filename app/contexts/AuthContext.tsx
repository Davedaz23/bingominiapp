// contexts/AuthContext.tsx - COMPLETE FIXED VERSION
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { validateAdminAccess, validateModeratorAccess } from '../../lib/utils/roleValidation';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  userRole: UserRole;
  login: (userData: User, token?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  initializeTelegramAuth: () => Promise<void>;
  checkAdminStatus: (userData: User) => boolean;
  checkUserRole: (userData: User) => UserRole;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Permission definitions
const PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_GAMES: 'manage_games',
  MANAGE_WALLETS: 'manage_wallets',
  VIEW_ADMIN_DASHBOARD: 'view_admin_dashboard',
  MANAGE_SETTINGS: 'manage_settings',
  MODERATE_GAMES: 'moderate_games',
  VIEW_REPORTS: 'view_reports',
  PLAY_GAMES: 'play_games',
  JOIN_GAMES: 'join_games',
  VIEW_LEADERBOARD: 'view_leaderboard',
} as const;

type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role definitions with permissions
const ROLES = {
  ADMIN: {
    name: 'admin' as const,
    permissions: [
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_GAMES,
      PERMISSIONS.MANAGE_WALLETS,
      PERMISSIONS.VIEW_ADMIN_DASHBOARD,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.MODERATE_GAMES,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.PLAY_GAMES,
      PERMISSIONS.JOIN_GAMES,
      PERMISSIONS.VIEW_LEADERBOARD,
    ] as Permission[]
  },
  MODERATOR: {
    name: 'moderator' as const,
    permissions: [
      PERMISSIONS.MODERATE_GAMES,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.PLAY_GAMES,
      PERMISSIONS.JOIN_GAMES,
      PERMISSIONS.VIEW_LEADERBOARD,
    ] as Permission[]
  },
  USER: {
    name: 'user' as const,
    permissions: [
      PERMISSIONS.PLAY_GAMES,
      PERMISSIONS.JOIN_GAMES,
      PERMISSIONS.VIEW_LEADERBOARD,
    ] as Permission[]
  }
} as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('user');

  // Get admin Telegram ID from environment
  const getAdminTelegramId = (): string | null => {
    if (typeof window === 'undefined') return null;
    const adminId = process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_ID;
    return adminId || null;
  };

  // Get moderator Telegram IDs from environment
  const getModeratorTelegramIds = (): string[] => {
    if (typeof window === 'undefined') return [];
    const moderatorIds = process.env.NEXT_PUBLIC_MODERATOR_TELEGRAM_IDS;
    return moderatorIds ? moderatorIds.split(',') : [];
  };

  // Check user role based on multiple factors
  const checkUserRole = (userData: User): UserRole => {
    if (!userData) return 'user';
    
    console.log('🔍 Checking user role for:', {
      telegramId: userData.telegramId,
      firstName: userData.firstName,
      username: userData.username,
      existingRole: userData.role,
      isAdmin: userData.isAdmin,
      isModerator: userData.isModerator
    });

    // Priority 1: Check if user object already has role flags
    if (userData.isAdmin === true || userData.role === 'admin') {
      console.log('✅ User is ADMIN (from user object)');
      return 'admin';
    }
    
    if (userData.isModerator === true || userData.role === 'moderator') {
      console.log('✅ User is MODERATOR (from user object)');
      return 'moderator';
    }

    // Priority 2: Check against environment variables (for Telegram WebApp users)
    if (validateAdminAccess(userData.telegramId)) {
      console.log('✅ User is ADMIN (from Telegram ID match)');
      return 'admin';
    }
    
    if (validateModeratorAccess(userData.telegramId)) {
      console.log('✅ User is MODERATOR (from Telegram ID match)');
      return 'moderator';
    }
    
    // Priority 3: Use existing role if present
    if (userData.role && ['admin', 'moderator', 'user'].includes(userData.role)) {
      console.log('✅ User role from existing data:', userData.role);
      return userData.role;
    }
    
    // Default to user
    console.log('✅ User is regular USER (default)');
    return 'user';
  };

  // Check if user is admin (backward compatibility)
  const checkAdminStatus = (userData: User): boolean => {
    return checkUserRole(userData) === 'admin';
  };

  // Check if user has specific permission
  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    
    const roleKey = userRole.toUpperCase() as keyof typeof ROLES;
    const role = ROLES[roleKey];
    
    const hasPerm = role ? role.permissions.includes(permission) : false;
    console.log(`🔐 Permission check: ${permission} for ${userRole} -> ${hasPerm}`);
    
    return hasPerm;
  };

  // Helper function to set auth data
  const setAuthData = (token: string, userData: User) => {
    if (typeof window !== 'undefined') {
      const userRole = checkUserRole(userData);
      
      localStorage.setItem('bingo_token', token);
      localStorage.setItem('bingo_user', JSON.stringify(userData));
      localStorage.setItem('user_role', userRole);
      
      if (userData._id) {
        localStorage.setItem('user_id', userData._id);
      }
      if (userData.telegramId) {
        localStorage.setItem('telegram_user_id', userData.telegramId);
      }
      
      // Update state
      setUserRole(userRole);
      setIsAdmin(userRole === 'admin');
      setIsModerator(userRole === 'moderator');
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
      localStorage.removeItem('user_role');
      localStorage.removeItem('is_admin');
      localStorage.removeItem('is_moderator');
    }
    setUserRole('user');
    setIsAdmin(false);
    setIsModerator(false);
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    try {
      console.log('🔄 Refreshing user data...');
      
      const savedUser = localStorage.getItem('bingo_user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        
        const newRole = checkUserRole(userData);
        setUserRole(newRole);
        setIsAdmin(newRole === 'admin');
        setIsModerator(newRole === 'moderator');
        
        localStorage.setItem('user_role', newRole);
        
        console.log('✅ User data refreshed - Role:', newRole);
      }
    } catch (error) {
      console.error('❌ Error refreshing user:', error);
    }
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
          // Store Telegram user data
          localStorage.setItem('telegram_user_data', JSON.stringify(telegramUser));
          localStorage.setItem('telegram_user_id', telegramUser.id.toString());
          
          // Check role based on Telegram ID
          const adminTelegramId = getAdminTelegramId();
          const moderatorTelegramIds = getModeratorTelegramIds();
          const telegramId = telegramUser.id.toString();
          
          if (telegramId === adminTelegramId) {
            console.log('👑 Admin user detected via Telegram WebApp');
            localStorage.setItem('user_role', 'admin');
            setUserRole('admin');
            setIsAdmin(true);
          } else if (moderatorTelegramIds.includes(telegramId)) {
            console.log('🛡️ Moderator user detected via Telegram WebApp');
            localStorage.setItem('user_role', 'moderator');
            setUserRole('moderator');
            setIsModerator(true);
          }
        } else {
          console.log('⚠️ No Telegram user data found in WebApp');
        }
      } else {
        console.log('⚠️ Telegram WebApp not available - running in browser mode');
      }
    } catch (error) {
      console.error('❌ Telegram auth initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Login function - FIXED to fetch actual user data
  const login = async (userData: User, token?: string): Promise<void> => {
    try {
      console.log('🔐 Logging in user with Telegram data:', {
        telegramId: userData.telegramId,
        firstName: userData.firstName,
        username: userData.username
      });

      // ✅ IMPORTANT: Fetch the actual user data from your backend
      let actualUserData = userData;
      
      try {
        // Call your backend API to get the real user data
        const response = await fetch(`/api/users/${userData.telegramId}`);
        if (response.ok) {
          const backendUser = await response.json();
          actualUserData = { ...userData, ...backendUser };
          console.log('✅ Fetched user data from backend:', backendUser);
        } else {
          console.log('⚠️ Could not fetch user from backend, using Telegram data');
        }
      } catch (error) {
        console.log('⚠️ Backend fetch failed, using Telegram data:', error);
      }

      console.log('🔐 Final user data for login:', {
        id: actualUserData._id,
        name: actualUserData.firstName,
        telegramId: actualUserData.telegramId,
        role: actualUserData.role,
        isAdmin: actualUserData.isAdmin,
        isModerator: actualUserData.isModerator
      });
      
      setUser(actualUserData);
      
      // Check and set role using the actual user data
      const newRole = checkUserRole(actualUserData);
      setUserRole(newRole);
      setIsAdmin(newRole === 'admin');
      setIsModerator(newRole === 'moderator');
      
      // Store auth data
      if (token) {
        setAuthData(token, actualUserData);
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('bingo_user', JSON.stringify(actualUserData));
          localStorage.setItem('user_role', newRole);
          
          if (actualUserData._id) {
            localStorage.setItem('user_id', actualUserData._id);
          }
          if (actualUserData.telegramId) {
            localStorage.setItem('telegram_user_id', actualUserData.telegramId);
          }
        }
      }
      
      console.log('✅ Login successful - Role:', newRole);
    } catch (error) {
      console.error('❌ Login failed:', error);
    }
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    setUser(null);
    setUserRole('user');
    setIsAdmin(false);
    setIsModerator(false);
    clearAuthData();
    
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        const token = localStorage.getItem('bingo_token');
        const savedUser = localStorage.getItem('bingo_user');
        const savedRole = localStorage.getItem('user_role') as UserRole;
        const telegramId = localStorage.getItem('telegram_user_id');

        console.log('🔍 Initializing auth state:', {
          hasToken: !!token,
          hasUser: !!savedUser,
          hasTelegramId: !!telegramId,
          savedRole: savedRole
        });

        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          
          // Restore role
          if (savedRole && ['admin', 'moderator', 'user'].includes(savedRole)) {
            setUserRole(savedRole);
            setIsAdmin(savedRole === 'admin');
            setIsModerator(savedRole === 'moderator');
          } else {
            const newRole = checkUserRole(userData);
            setUserRole(newRole);
            setIsAdmin(newRole === 'admin');
            setIsModerator(newRole === 'moderator');
            localStorage.setItem('user_role', newRole);
          }
          
          console.log('✅ Auth state restored - User:', userData.firstName, 'Role:', userRole);
        } else {
          console.log('ℹ️ No saved user found - starting fresh');
        }

        await initializeTelegramAuth();
        
      } catch (error) {
        console.error('❌ Error restoring auth state:', error);
        clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isAdmin,
    isModerator,
    userRole,
    login,
    logout,
    refreshUser,
    initializeTelegramAuth,
    checkAdminStatus,
    checkUserRole,
    hasPermission,
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

export { PERMISSIONS };
export type { Permission };
// services/api.ts - FIXED VERSION
import axios from 'axios';
import { Game, User, BingoCard, WinnerInfo, GameStats } from '../types';

// Use your Render backend URL directly
const API_BASE_URL = 'https://telegram-bingo-bot-lwrl.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout for better reliability
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('bingo_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Enhanced response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    // Log successful API calls in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    console.log("Direct API Error",error);
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      // Clear invalid token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bingo_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('telegram_user_id');
      }
    }
    
    // Network errors
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      console.warn('🌐 Network error - check connection');
    }
    
    // Timeout errors
    if (error.code === 'ECONNABORTED') {
      console.warn('⏰ Request timeout');
    }
    
    return Promise.reject(error);
  }
);

// Helper function to get user ID
const getUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user_id');
};

// Helper function to get Telegram ID
const getTelegramId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('telegram_user_id');
};

// FIXED: All endpoints now use the same api instance with consistent base URL
export const authAPI = {
  // Telegram WebApp authentication - FIXED: use api instance
  telegramLogin: (initData: string) => 
    api.post('/auth/telegram', { initData }),

  // Quick authentication - FIXED: use api instance
  quickAuth: (telegramId: string) =>
    api.post('/auth/quick-auth', { telegramId }),

  // Play endpoint - NEW: for auto user creation
  play: (telegramId: string, initData?: string) =>
    api.post('/auth/play', { telegramId, initData }),

  // Get user profile by ID (accepts both MongoDB ID and Telegram ID) - FIXED: use api instance
  getProfile: (userId: string) => 
    api.get(`/auth/profile/${userId}`),

  // Get user profile by Telegram ID specifically - NEW
  getProfileByTelegramId: (telegramId: string) =>
    api.get(`/auth/profile/telegram/${telegramId}`),

  // Verify endpoint for manual verification - FIXED: use api instance
  verify: (initData: string) =>
    api.post('/auth/verify', { initData }),

  // Get user stats - FIXED: use api instance
  getStats: (userId: string) =>
    api.get(`/auth/stats/${userId}`),

  // Create default user - NEW: for testing
  createDefaultUser: () =>
    api.get('/auth/create-default-user'),
};

export const gameAPI = {
  // Game management
  joinGame: (code: string, userId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${code}/join`, { userId }),
  
  joinGameWithWallet: (code: string, userId: string, entryFee: number = 10) =>
    api.post<{ success: boolean; game: Game }>(`/games/${code}/join-with-wallet`, { userId, entryFee }),
  
  startGame: (gameId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${gameId}/start`),
  
  callNumber: (gameId: string) =>
    api.post<{ success: boolean; number: number; calledNumbers: number[]; totalCalled: number }>(`/games/${gameId}/call-number`),
  
  markNumber: (gameId: string, userId: string, number: number) =>
    api.post<{ success: boolean; bingoCard: BingoCard; isWinner: boolean; isSpectator?: boolean }>(`/games/${gameId}/mark-number`, { userId, number }),
  
  // Game queries
  getActiveGames: () =>
    api.get<{ success: boolean; games: Game[] }>('/games/active'),
  
  getWaitingGames: () =>
    api.get<{ success: boolean; games: Game[] }>('/games/waiting'),
  
  getGame: (gameId: string) =>
    api.get<{ success: boolean; game: Game }>(`/games/${gameId}`),
  
  getGameByCode: (code: string) =>
    api.get<{ success: boolean; game: Game }>(`/games/code/${code}`),
  
  getUserBingoCard: (gameId: string, userId: string) =>
    api.get<{ success: boolean; bingoCard: BingoCard }>(`/games/${gameId}/card/${userId}`),
  
  // Game actions
  leaveGame: (gameId: string, userId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${gameId}/leave`, { userId }),
  
  endGame: (gameId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${gameId}/end`),
  
  checkForWin: (gameId: string, userId: string) =>
    api.post<{ success: boolean; isWinner: boolean; bingoCard: BingoCard; winningPattern?: string }>(`/games/${gameId}/check-win`, { userId }),
  
  // Game info
  getWinnerInfo: (gameId: string) =>
    api.get<{ success: boolean; winnerInfo: WinnerInfo }>(`/games/${gameId}/winner`),
  
  getGameStats: (gameId: string) =>
    api.get<{ success: boolean; stats: GameStats }>(`/games/${gameId}/stats`),
  
  // User games
  getUserActiveGames: (userId: string) =>
    api.get<{ success: boolean; games: Game[] }>(`/games/user/${userId}/active`),
  
  getUserGameHistory: (userId: string, limit?: number, page?: number) =>
    api.get<{ success: boolean; games: Game[]; pagination: any }>(`/games/user/${userId}/history`, {
      params: { limit, page }
    }),
  
  getUserGameRole: (gameId: string, userId: string) =>
    api.get<{ success: boolean; role: any }>(`/games/user/${userId}/role/${gameId}`),
  
  // Health check
  healthCheck: () =>
    api.get<{ status: string; timestamp: string; database: string }>('/health'),
};

export const walletAPI = {
  // Balance - include userId in query params
  getBalance: (userId: string) =>
    api.get<{ success: boolean; balance: number; user?: any }>(`/wallet/balance`, {
      params: { userId }
    }),
  
  // Update balance - NEW: for adding/removing funds
  updateBalance: (userId: string, amount: number) =>
    api.post<{ success: boolean; balance: number }>(`/wallet/update`, { userId, amount }),
  
  // Transactions - include userId in query params
  getTransactions: (userId: string, limit?: number, page?: number) =>
    api.get<{ success: boolean; transactions: any[]; pagination: any }>(`/wallet/transactions`, {
      params: { userId, limit, page }
    }),
  
  // Deposit - include userId in request body
  createDeposit: (userId: string, data: { amount: number; receiptImage: string; reference: string; description?: string }) =>
    api.post<{ success: boolean; transaction: any }>(`/wallet/deposit`, {
      userId,
      ...data
    }),
  
  // Admin endpoints - include userId in query params
  getPendingDeposits: (userId: string) =>
    api.get<{ success: boolean; deposits: any[] }>(`/wallet/admin/pending-deposits`, {
      params: { userId }
    }),
  
  approveDeposit: (userId: string, transactionId: string) =>
    api.post<{ success: boolean; wallet: any; transaction: any }>(`/wallet/admin/approve-deposit/${transactionId}`, {
      userId
    }),

  // Health check
  healthCheck: () =>
    api.get<{ status: string; timestamp: string }>('/wallet/health'),
};

// Enhanced convenience methods with better fallbacks
// services/api.ts - FIXED WALLET METHODS
// Enhanced convenience methods with proper ID handling
export const walletAPIAuto = {
  getBalance: async () => {
    // Try to get the correct user ID
    const telegramId = getTelegramId();
    const userId = getUserId();

    console.log('💰 Wallet balance request:', { telegramId, userId });

    // Prefer Telegram ID for wallet requests since backend expects it
    if (telegramId && telegramId.match(/^\d+$/)) {
      console.log('💰 Using Telegram ID for balance:', telegramId);
      return walletAPI.getBalance(telegramId);
    }

    // Fallback to user ID if it's a valid MongoDB ID
    if (userId && userId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('💰 Using MongoDB ID for balance:', userId);
      return walletAPI.getBalance(userId);
    }

    throw new Error('No valid user ID found for wallet balance');
  },
  
  getTransactions: async (limit?: number, page?: number) => {
    const telegramId = getTelegramId();
    const userId = getUserId();

    if (telegramId && telegramId.match(/^\d+$/)) {
      return walletAPI.getTransactions(telegramId, limit, page);
    }

    if (userId && userId.match(/^[0-9a-fA-F]{24}$/)) {
      return walletAPI.getTransactions(userId, limit, page);
    }

    throw new Error('No valid user ID found for transactions');
  },
  
  createDeposit: async (data: { amount: number; receiptImage: string; reference: string; description?: string }) => {
    const telegramId = getTelegramId();
    const userId = getUserId();

    if (telegramId && telegramId.match(/^\d+$/)) {
      return walletAPI.createDeposit(telegramId, data);
    }

    if (userId && userId.match(/^[0-9a-fA-F]{24}$/)) {
      return walletAPI.createDeposit(userId, data);
    }

    throw new Error('No valid user ID found for deposit');
  },

  updateBalance: async (amount: number) => {
    const telegramId = getTelegramId();
    const userId = getUserId();

    if (telegramId && telegramId.match(/^\d+$/)) {
      return walletAPI.updateBalance(telegramId, amount);
    }

    if (userId && userId.match(/^[0-9a-fA-F]{24}$/)) {
      return walletAPI.updateBalance(userId, amount);
    }

    throw new Error('No valid user ID found for balance update');
  },
};

// Test connection function
export const testAPIConnection = async (): Promise<boolean> => {
  try {
    const response = await api.get('/auth/health');
    console.log('✅ API Connection successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ API Connection failed:', error);
    return false;
  }
};

// Initialize API connection on import
if (typeof window !== 'undefined') {
  testAPIConnection();
}

export default api;
// services/api.ts - UPDATED WITH FIXED WALLET ENDPOINTS
import axios from 'axios';
import { Game, User, BingoCard, WinnerInfo, GameStats } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
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

// services/api.ts - UPDATE authAPI methods
export const authAPI = {
  // Telegram WebApp authentication
  telegramLogin: (initData: string) => 
    axios.post('/api/auth/telegram', { initData }),
  // Quick authentication
  quickAuth: (telegramId: string) =>
    api.post('/auth/quick-auth', { telegramId }),
  // Get user profile by ID (accepts both MongoDB ID and Telegram ID)
  getProfile: (userId: string) => 
    axios.get(`/api/auth/profile/${userId}`),

  // Verify endpoint for manual verification
  verify: (initData: string) =>
    axios.post('/api/auth/verify', { initData }),

  // Get user stats
  getStats: (userId: string) =>
    axios.get(`/api/auth/stats/${userId}`),
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
  // Balance - include userId in query params instead of headers
  getBalance: (userId: string) =>
    api.get<{ success: boolean; balance: number }>(`/wallet/balance`, {
      params: { userId }
    }),
  
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
};

// Convenience methods that automatically get userId from localStorage
export const walletAPIAuto = {
  getBalance: () => {
    const userId = getUserId();
    if (!userId) throw new Error('User ID not found');
    return walletAPI.getBalance(userId);
  },
  
  getTransactions: (limit?: number, page?: number) => {
    const userId = getUserId();
    if (!userId) throw new Error('User ID not found');
    return walletAPI.getTransactions(userId, limit, page);
  },
  
  createDeposit: (data: { amount: number; receiptImage: string; reference: string; description?: string }) => {
    const userId = getUserId();
    if (!userId) throw new Error('User ID not found');
    return walletAPI.createDeposit(userId, data);
  },
};

export default api;
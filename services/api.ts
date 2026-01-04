/* eslint-disable @typescript-eslint/no-explicit-any */
// services/api.ts - UPDATED TO MATCH BACKEND ROUTES
import axios from 'axios';
import { Game, User, BingoCard, WinnerInfo, GameStats } from '../types';

// Use your Render backend URL directly
const API_BASE_URL = 'https://telegram-bingo-bot-opj9.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000, // 20 second timeout for better reliability
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

// Types for card selection
export interface CardSelectionResponse {
  success: boolean;
  message: string;
  action?: 'CREATED' | 'UPDATED'; // Add this line
  cardId?: string; // Add this line
  error?: string; // Add this line for error responses
}

export interface AvailableCardsResponse {
  success: boolean;
  cards: Array<{
    cardIndex: number;
    numbers: (number | string)[][];
    preview: any;
  }>;
  count: number;
}
export interface CallNumberResponse {
  success: boolean;
  number: number;
  calledNumbers: number[];
  totalCalled: number;
  letter?: string;
}
export interface CardSelectionStatusResponse {
  success: boolean;
  gameId: string;
  totalPlayers: number;
  playersWithCards: number;
  playersWithoutCards: number;
  canStart: boolean;
  minPlayersRequired: number;
  playersWithCardsList: Array<{
    userId: string;
    cardIndex?: number;
    cardNumber?: number;
    username?: string;
  }>; // Make this more specific
  playersWithoutCardsList: any[];
}

export interface HasCardResponse {
  success: boolean;
  hasCard: boolean;
  bingoCard: BingoCard | null;
}

// FIXED: All endpoints now match the backend routes exactly
export const authAPI = {
  // Telegram WebApp authentication
  telegramLogin: (initData: string) => 
    api.post('/auth/telegram', { initData }),

  // // Quick authentication
  // quickAuth: (telegramId: string) =>
  //   api.post('/auth/quick-auth', { telegramId }),

  // // Play endpoint - for auto user creation
  // play: (telegramId: string, initData?: string) =>
  //   api.post('/auth/play', { telegramId, initData }),

  // Get user profile by ID (accepts both MongoDB ID and Telegram ID)
  getProfile: (userId: string) => 
    api.get(`/auth/profile/${userId}`),

  // Get user profile by Telegram ID specifically
  getProfileByTelegramId: (telegramId: string) =>
    api.get(`/auth/profile/telegram/${telegramId}`),

  // Verify endpoint for manual verification
  verify: (initData: string) =>
    api.post('/auth/verify', { initData }),

  // Get user stats
  getStats: (userId: string) =>
    api.get(`/auth/stats/${userId}`),

  // Create default user - for testing
  createDefaultUser: () =>
    api.get('/auth/create-default-user'),
  
};

export const gameAPI = {
//==  socket
 getSyncState: (gameId: string, clientSequence?: number) =>
    api.get<{
      success: boolean;
      syncState: any;
      needsFullSync: boolean;
      serverTime: number;
    }>(`/games/${gameId}/sync`, {
      params: { clientSequence }
    }),
  
  getSyncHealth: (gameId: string) =>
    api.get<{
      success: boolean;
      game: any;
      serverState: any;
      clients: any;
      syncInfo: any;
    }>(`/games/${gameId}/sync-health`),
  // ==================== CARD SELECTION ROUTES ====================
  getAvailableCards: (gameId: string, userId: string, count: number = 400) =>
    api.get<AvailableCardsResponse>(`/games/${gameId}/available-cards/${userId}`, {
      params: { count }
    }),
  
  selectCard: (gameId: string, userId: string, cardNumbers: (number | string)[][]) =>
    api.post<CardSelectionResponse>(`/games/${gameId}/select-card`, {
      userId,
      cardNumbers
    }),
  
  hasCard: (gameId: string, userId: string) =>
    api.get<HasCardResponse>(`/games/${gameId}/has-card/${userId}`),
  
  getCardSelectionStatus: (gameId: string) =>
    api.get<CardSelectionStatusResponse>(`/games/${gameId}/card-selection-status`),

  // ==================== GAME MANAGEMENT ====================
  joinGame: (code: string, userId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${code}/join`, { userId }),
  
  joinGameWithWallet: (code: string, userId: string, entryFee: number = 10) =>
    api.post<{ success: boolean; game: Game }>(`/games/${code}/join-with-wallet`, { userId, entryFee }),
  
  startGame: (gameId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${gameId}/start`),
  
  // callNumber: (gameId: string) =>
  //   api.post<{ success: boolean; number: number; calledNumbers: number[]; totalCalled: number }>(`/games/${gameId}/call-number`),
   callNumber: (gameId: string) =>
    api.post<CallNumberResponse>(`/games/${gameId}/call-number`),
// In services/api.ts - markNumber endpoint
markNumber: (gameId: string, userId: string, number: number) =>
  api.post<{ success: boolean; bingoCard: BingoCard; isWinner: boolean; }>(
    `/games/${gameId}/mark-number`, 
    { userId, number }
  ),
  // ==================== GAME QUERIES ====================
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
  
  // ==================== GAME ACTIONS ====================
  leaveGame: (gameId: string, userId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${gameId}/leave`, { userId }),
   getGameParticipants: (gameId: string) =>
    api.get<{
      success: boolean;
      participants: Array<{
        _id: string;
        userId: string;
        username: string;
        firstName: string;
        telegramId?: string;
        hasCard: boolean;
        cardNumber?: number;
        cardIndex?: number;
        joinedAt: string;
      }>;
    }>(`/games/${gameId}/participants`),
  endGame: (gameId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${gameId}/end`),
  
  checkForWin: (gameId: string, userId: string) =>
    api.post<{ success: boolean; isWinner: boolean; bingoCard: BingoCard; winningPattern?: string }>(`/games/${gameId}/check-win`, { userId }),
  
  // ==================== GAME INFO ====================
  getWinnerInfo: (gameId: string) =>
    api.get<{ success: boolean; winnerInfo: WinnerInfo }>(`/games/${gameId}/winner`),
  
  getGameStats: (gameId: string) =>
    api.get<{ success: boolean; stats: GameStats }>(`/games/${gameId}/stats`),
  
  // ==================== USER GAMES ====================
  getUserActiveGames: (userId: string) =>
    api.get<{ success: boolean; games: Game[] }>(`/games/user/${userId}/active`),
  
  getUserGameHistory: (userId: string, limit?: number, page?: number) =>
    api.get<{ success: boolean; games: Game[]; pagination: any }>(`/games/user/${userId}/history`, {
      params: { limit, page }
    }),
  
  getUserGameRole: (gameId: string, userId: string) =>
    api.get<{ success: boolean; role: any }>(`/games/user/${userId}/role/${gameId}`),
 // NEW: Get real-time taken cards
  getTakenCards: (gameId: string) =>
    api.get<{ success: boolean; takenCards: Array<{cardNumber: number; userId: string}>; count: number }>(`/games/${gameId}/taken-cards`),
// NEW: Select card with specific card number
  selectCardWithNumber: (gameId: string, data: { userId: string; cardNumbers: (number | string)[][]; cardNumber: number }) =>
    api.post<CardSelectionResponse>(`/games/${gameId}/select-card-with-number`, data),
  // ==================== HEALTH CHECK ====================
  healthCheck: () =>
    api.get<{ status: string; timestamp: string; database: string }>('/health'),
  //====== auto check
  // checkAutoStart: (gameId: string) =>
claimBingo: (gameId: string, userId: string, patternType?: string) =>
    api.post<{ 
      success: boolean; 
      message: string; 
      patternType?: string;
      winningPositions?: number[];
      prizeAmount?: number;
      error?: string;
    }>(`/games/${gameId}/claim-bingo`, { userId, patternType }),

  //   api.post<{ success: boolean; gameStarted: boolean; game?: Game }>(`/games/${gameId}/check-auto-start`),
 checkAutoStart: (gameId: string) =>
    api.post<{ 
      success: boolean; 
      gameStarted: boolean; 
      game?: Game;
      autoStartInfo?: {
        willAutoStart: boolean;
        timeRemaining: number;
        autoStartEndTime?: string;
        playersWithCards: number;
        minPlayersRequired: number;
        playersNeeded?: number;
      }
    }>(`/games/${gameId}/check-auto-start`),
    
  // ==================== GAMES HEALTH CHECK ====================
  gamesHealthCheck: () =>
    api.get<{ success: boolean; status: string; activeGames: number; waitingGames: number; timestamp: string }>('/games/health/status')

  

};

export const walletAPI = {
  // Balance - include userId in query params
  getBalance: (userId: string) =>
    api.get<{ success: boolean; balance: number; user?: any }>(`/wallet/balance`, {
      params: { userId }
    }),
  
  // Update balance - for adding/removing funds
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

// Enhanced convenience methods with proper ID handling
export const walletAPIAuto = {
  getBalance: async () => {
    try {
      // Try multiple sources for user ID with better error handling
      const telegramId = getTelegramId();
      const userId = getUserId();

      console.log('💰 Wallet balance request - Available IDs:', { 
        telegramId, 
        userId,
        telegramIdValid: telegramId && telegramId.match(/^\d+$/),
        userIdValid: userId && userId.match(/^[0-9a-fA-F]{24}$/)
      });

      // Strategy 1: Try Telegram ID first (preferred)
      if (telegramId && telegramId.match(/^\d+$/)) {
        console.log('💰 Strategy 1: Using Telegram ID:', telegramId);
        try {
          const response = await walletAPI.getBalance(telegramId);
          console.log('💰 Telegram ID balance response:', response.data);
          return response;
        } catch (error: any) {
          console.warn('💰 Telegram ID strategy failed:', error.message);
        }
      }

      // Strategy 2: Try MongoDB ID
      if (userId && userId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('💰 Strategy 2: Using MongoDB ID:', userId);
        try {
          const response = await walletAPI.getBalance(userId);
          console.log('💰 MongoDB ID balance response:', response.data);
          return response;
        } catch (error: any) {
          console.warn('💰 MongoDB ID strategy failed:', error.message);
        }
      }

    //  Strategy 3: Try direct API call with fallback
      // console.log('💰 Strategy 3: Trying direct balance endpoint');
      // try {
      //   // Use a generic endpoint that handles both ID types
      //   const response = await api.get('/wallet/balance');
      //   console.log('💰 Direct balance response:', response.data);
      //   return { data: response.data };
      // } catch (error: any) {
      //   console.warn('💰 Direct balance strategy failed:', error.message);
      // }

      throw new Error('No valid user ID found for wallet balance');
    } catch (error) {
      console.error('💰 All wallet balance strategies failed:', error);
      throw error;
    }
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

// Enhanced API connection test with detailed diagnostics
export const testAPIConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    const response = await api.get('/health');
    console.log('✅ API Connection successful:', response.data);
    return {
      success: true,
      message: 'API connection successful',
      details: response.data
    };
  } catch (error: any) {
    console.error('❌ API Connection failed:', error);
    return {
      success: false,
      message: error.message || 'API connection failed',
      details: {
        status: error.response?.status,
        data: error.response?.data
      }
    };
  }
};

// Test card selection endpoints specifically
export const testCardSelectionAPI = async (gameId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    const response = await gameAPI.getCardSelectionStatus(gameId);
    console.log('✅ Card Selection API test successful:', response.data);
    return {
      success: true,
      message: 'Card selection API working',
      details: response.data
    };
  } catch (error: any) {
    console.error('❌ Card Selection API test failed:', error);
    return {
      success: false,
      message: error.message || 'Card selection API failed',
      details: {
        status: error.response?.status,
        data: error.response?.data
      }
    };
  }
};

// Initialize API connection on import
if (typeof window !== 'undefined') {
  // Test connection but don't block the app
  setTimeout(() => {
    testAPIConnection().then(result => {
      if (!result.success) {
        console.warn('⚠️ API connection test failed on startup');
      }
    });
  }, 1000);
}

// Export utility functions for external use
export const apiUtils = {
  getUserId,
  getTelegramId,
  testAPIConnection,
  testCardSelectionAPI
};

export default api;
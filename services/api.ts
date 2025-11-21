// services/api.ts - UPDATED
import axios from 'axios';
import { Game, User, BingoCard, WinnerInfo, GameStats } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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
        // Optional: redirect to login
        // window.location.href = '/';
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

export const authAPI = {
  telegramLogin: (initData: string) => 
    api.post<{ success: boolean; token: string; user: User }>('/auth/telegram', { initData }),
  
  getProfile: (userId: string) =>
    api.get<{ success: boolean; user: User }>(`/auth/profile/${userId}`),
  
  getStats: (userId: string) =>
    api.get<{ success: boolean; stats: any }>(`/auth/stats/${userId}`),
};

export const gameAPI = {
  // Game management
  joinGame: (code: string, userId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${code}/join`, { userId }),
  
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

export default api;
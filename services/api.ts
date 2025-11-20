// services/api.ts
import axios from 'axios';
import { Game, User, BingoCard } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const authAPI = {
  telegramLogin: (initData: string) => 
    api.post<{ success: boolean; token: string; user: User }>('/auth/telegram', { initData }),
};

export const gameAPI = {
  createGame: (hostId: string, maxPlayers?: number, isPrivate?: boolean) =>
    api.post<{ success: boolean; game: Game }>('/games', { hostId, maxPlayers, isPrivate }),
  
  joinGame: (code: string, userId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${code}/join`, { userId }),
  
  startGame: (gameId: string, hostId: string) =>
    api.post<{ success: boolean; game: Game }>(`/games/${gameId}/start`, { hostId }),
  
  callNumber: (gameId: string, callerId?: string) =>
    api.post<{ success: boolean; number: number; calledNumbers: number[] }>(`/games/${gameId}/call-number`, { callerId }),
  
  markNumber: (gameId: string, userId: string, number: number) =>
    api.post<{ success: boolean; bingoCard: BingoCard; isWinner: boolean }>(`/games/${gameId}/mark-number`, { userId, number }),
  
  getActiveGames: () =>
    api.get<{ success: boolean; games: Game[] }>('/games/active'),
  
  getGame: (gameId: string) =>
    api.get<{ success: boolean; game: Game }>(`/games/${gameId}`),
  
  getGameByCode: (code: string) =>
    api.get<{ success: boolean; game: Game }>(`/games/code/${code}`),
};

export default api;
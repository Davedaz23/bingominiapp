// services/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  // Only access localStorage in browser environment
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
    api.post('/auth/telegram', { initData }),
};

export const gameAPI = {
  createGame: (hostId: string, maxPlayers?: number, isPrivate?: boolean) =>
    api.post('/games', { hostId, maxPlayers, isPrivate }),
  
  joinGame: (code: string, userId: string) =>
    api.post(`/games/${code}/join`, { userId }),
  
  startGame: (gameId: string, hostId: string) =>
    api.post(`/games/${gameId}/start`, { hostId }),
  
  callNumber: (gameId: string) =>
    api.post(`/games/${gameId}/call-number`),
  
  markNumber: (gameId: string, userId: string, number: number) =>
    api.post(`/games/${gameId}/mark-number`, { userId, number }),
  
  getActiveGames: () =>
    api.get('/games/active'),
  
  getGame: (gameId: string) =>
    api.get(`/games/${gameId}`),
};

export default api;
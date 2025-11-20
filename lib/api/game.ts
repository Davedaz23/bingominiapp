import { apiClient } from './client';
import { Game, User, BingoCard } from '../../types';

export const authAPI = {
  telegramLogin: (initData: string) => 
    apiClient.post<{ success: boolean; token: string; user: User }>('/auth/telegram', { initData }),
};

export const gameAPI = {
  createGame: (hostId: string, maxPlayers?: number, isPrivate?: boolean) =>
    apiClient.post<{ success: boolean; game: Game }>('/games', { hostId, maxPlayers, isPrivate }),
  
  joinGame: (code: string, userId: string) =>
    apiClient.post<{ success: boolean; game: Game }>(`/games/${code}/join`, { userId }),
  
  startGame: (gameId: string, hostId: string) =>
    apiClient.post<{ success: boolean; game: Game }>(`/games/${gameId}/start`, { hostId }),
  
  callNumber: (gameId: string) =>
    apiClient.post<{ success: boolean; number: number; calledNumbers: number[] }>(`/games/${gameId}/call-number`),
  
  markNumber: (gameId: string, userId: string, number: number) =>
    apiClient.post<{ success: boolean; bingoCard: BingoCard; isWinner: boolean }>(`/games/${gameId}/mark-number`, { userId, number }),
  
  getActiveGames: () =>
    apiClient.get<{ success: boolean; games: Game[] }>('/games/active'),
  
  getGame: (gameId: string) =>
    apiClient.get<{ success: boolean; game: Game }>(`/games/${gameId}`),
};
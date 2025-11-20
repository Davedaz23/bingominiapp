export interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  createdAt: string;
}

export interface GamePlayerUser {
  id: string; // Add this missing property
  username?: string;
  firstName?: string;
}

export interface GamePlayer {
  userId: string;
  user: GamePlayerUser; // Use the new interface with id
  isReady: boolean;
  joinedAt: string;
}

export interface Game {
  id: string;
  code: string;
  hostId: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  maxPlayers: number;
  currentPlayers: number;
  numbersCalled: number[];
  winnerId?: string;
  isPrivate: boolean;
  host: GamePlayerUser; // Use the same interface for host
  players: GamePlayer[];
  bingoCards?: BingoCard[];
  createdAt: string;
  updatedAt: string;
}

export interface BingoCard {
  id: string;
  userId: string;
  gameId: string;
  numbers: number[][];
  markedPositions: number[];
  isWinner: boolean;
  createdAt: string;
}

export interface GameState {
  currentNumber?: number;
  calledNumbers: number[];
  timeRemaining: number;
  isPlaying: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
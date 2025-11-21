// types/index.ts
export interface User {
  _id: string;
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
  _id: string;
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface GamePlayer {
  _id: string;
  userId: string;
  user: GamePlayerUser;
  isReady: boolean;
  joinedAt: string;
  playerType?: 'PLAYER' | 'SPECTATOR'; // ADD THIS
}

export interface Game {
  _id: string;
  id: string;
  code: string;
  hostId: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  maxPlayers: number;
  currentPlayers: number;
  numbersCalled: number[];
  winnerId?: string;
  isPrivate: boolean;
  host: GamePlayerUser;
  players: GamePlayer[];
  bingoCards?: BingoCard[];
  createdAt: string;
  updatedAt: string;
  isAutoCreated?: boolean; // ADD THIS for system games
}

export interface BingoCard {
  _id: string;
  id: string;
  userId: string;
  gameId: string;
  numbers: number[][];
  markedPositions: number[];
  isWinner: boolean;
  createdAt: string;
  user?: GamePlayerUser;
  isSpectator?: boolean; // ADD THIS for spectator cards
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
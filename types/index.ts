// types/index.ts - UNIFIED TYPES
export interface User {
  id: string;
  _id?: string;
  telegramId: string;
  username: string;
  firstName: string;
  lastName?: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BingoCard {
  id: string;
  _id?: string;
  numbers: number[][];
  selected: boolean[][];
  markedPositions?: number[];
  owner: string;
  userId?: string;
  gameId?: string;
  isWinner?: boolean;
  createdAt?: string;
  user?: User;
}

export interface GameState {
  isStarted: boolean;
  calledNumbers: number[];
  currentNumber: number | null;
  players: number;
  potAmount: number;
  timeRemaining: number;
  gameEnded: boolean;
  status?: 'WAITING' | 'ACTIVE' | 'FINISHED';
  currentPlayers?: number;
}

export interface WalletInfo {
  balance: number;
  betAmount: number;
  potentialWin: number;
}

export interface Game {
  _id: string;
  id?: string;
  code: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  calledNumbers: number[];
  currentNumber: number | null;
  players: any[];
  potAmount: number;
  timeRemaining: number;
  entryFee?: number;
  maxPlayers?: number;
  currentPlayers?: number;
  winnerId?: string;
  isPrivate?: boolean;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WinnerInfo {
  winnerId: string;
  winnerName: string;
  prizeAmount: number;
  winningPattern: string;
  winner?: User;
  gameCode?: string;
  totalPlayers?: number;
  numbersCalled?: number;
  endedAt?: string;
}

export interface GameStats {
  totalGames: number;
  activeGames: number;
  waitingGames: number;
  totalPlayers: number;
  totalPrizePool: number;
}
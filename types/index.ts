// types/index.ts - UPDATED WITH PROPER TYPES
export type UserRole = 'admin' | 'moderator' | 'user';

export interface User {
  id: string;
  _id?: string;
  telegramId: string;
  username: string;
  firstName: string;
  lastName?: string;
  role?: UserRole;
  isAdmin?: boolean;
  isModerator?: boolean;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  walletBalance?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  telegramUsername?: string;
  photoUrl?: string;
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

export interface GamePlayerUser {
  _id: string;
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  telegramId?: string;
  role?: UserRole;
}

export interface GamePlayer {
  _id: string;
  userId: string;
  user?: GamePlayerUser;
  isReady: boolean;
  joinedAt: string;
  playerType?: 'PLAYER' | 'SPECTATOR';
  isLateJoiner?: boolean;
  numbersCalledAtJoin?: number[];
}

export interface Game {
  isAutoCreated: boolean;
  winner: boolean;
  numbersCalled: any;
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

export interface AdminStats {
  totalUsers: number;
  totalGames: number;
  totalTransactions: number;
  totalBalance: number;
  activeGames: number;
  pendingDeposits: number;
}

// Remove duplicate Permission type declaration from here
// and keep it only in AuthContext
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  markedNumbers?: number[]; // Flat array of marked numbers
}

export interface GameState {
  isStarted: boolean;
  calledNumbers: number[];
  currentNumber: number | null;
  players: number;
  potAmount: number;
  timeRemaining: number;
  gameEnded: boolean;
  status?: 'WAITING' | 'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'CANCELLED' | 'CARD_SELECTION' | 'COOLDOWN';
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

// UPDATED Game interface with all possible status values
export interface Game {
  isAutoCreated: boolean;
  winner: boolean;
  numbersCalled: any;
  _id: string;
  id?: string;
  code: string;
  status: 'WAITING' | 'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'CANCELLED' | 'CARD_SELECTION' | 'COOLDOWN'|'NO_WINNER';
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
  
  // Add these new properties for auto-start timer
  hasAutoStartTimer?: boolean;
  autoStartTimeRemaining?: number;
  autoStartEndTime?: string;
  
  // Add card selection properties
  selectedCards?: Record<string, string>;
  cardSelectionEndTime?: string;
  isCardSelectionActive?: boolean;
  
  // Add restart cooldown properties
  hasRestartCooldown?: boolean;
  restartCooldownRemaining?: number;
  cooldownEndTime?: string;   // For cooldown/restart timer
  // Add game statistics properties
  playersWithCards?: number;
  minPlayersRequired?: number;
  canStart?: boolean;
  playersNeeded?: number;
  cardsNeeded?: number;
  acceptsLateJoiners?: boolean;
  numbersCalledCount?: number;
  totalParticipants?: number;
  activePlayers?: number;
  spectators?: number;
  
  // Add auto-start properties
  autoStartTimerEndTime?: string;
  autoStartTimerRemaining?: number;
  
  // Add winner properties
  winnerInfo?: {
    winner: {
      _id: string;
      username: string;
      firstName: string;
      telegramId?: string;
    };
    gameCode: string;
    endedAt: string;
    totalPlayers: number;
    numbersCalled: number;
    winningPattern?: string;
    winningCard?: {
      cardNumber: number;
      numbers: (number | string)[][];
      markedPositions: number[];
      winningPatternPositions?: number[];
    };
  };
   cardSelectionStartTime?: string;
  cardSelectionTimeRemaining?: number;  // This is used in your implementation
  cardSelectionTotalDuration?: number;  // For percentage calculation
  hasCardSelectionTimer?: boolean;      // Flag for card selection timer
  noWinner?: boolean;                   // Used in your game service
  refunded?: boolean;                   // Used in your game service
  refundedAt?: string;                  // Used in your game service
  totalRefunded?: number;               // Used in your game service
  uniquePlayersRefunded?: number;       // Used in your game service
  archived?: boolean;                   // Used in your game service
  archivedAt?: string;                  // Used in your game service

  winningAmount?: number;               // Prize amount for winner
  previousGameId?: string;              // For game lineage tracking
  message?: string;                     // Status message from formatGameForFrontend
  serverTime?: string;                  // For time synchronization
  isValidActiveGame?: boolean;          // For validation
  canSelectCard?: boolean;              // From formatGameForFrontend
  canJoin?: boolean;                    // From formatGameForFrontend
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
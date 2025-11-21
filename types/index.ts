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

// types/index.ts - CORRECTED
export interface GamePlayer {
  _id: string;
  userId: string; // This should be string, not GamePlayerUser
  user?: GamePlayerUser; // This is populated by Mongoose
  isReady: boolean;
  joinedAt: string;
  playerType?: 'PLAYER' | 'SPECTATOR';
}

export interface Game {
  _id: string;
  code: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  maxPlayers: number;
  currentPlayers: number;
  numbersCalled: number[];
  winnerId?: string;
  winner?: GamePlayerUser;
  isPrivate: boolean;
  players: GamePlayer[];
  isAutoCreated?: boolean;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastCalledAt?: string; // Optional: if you want to track this on backend too
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
    isSpectator?: boolean;
  }

 export interface GameState {
  currentNumber?: number;
  calledNumbers: number[];
  timeRemaining: number;
  isPlaying: boolean;
  lastCalledAt: Date | null; // Add this line
}

  export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
  }

  // ADDED: Winner information interface
  export interface WinnerInfo {
    winner: GamePlayerUser;
    gameCode: string;
    totalPlayers: number;
    numbersCalled: number;
    endedAt?: string;
  }

  // ADDED: Game statistics interface
  export interface GameStats {
    gameId: string;
    totalPlayers: number;
    totalNumbersCalled: number;
    averageMarkedPerPlayer: number;
    cardsWithBingo: number;
    gameDuration: number;
    numbersByLetter: {
      B: number;
      I: number;
      N: number;
      G: number;
      O: number;
    };
  }
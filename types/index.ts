// types/index.ts - UPDATED with late joiner support
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
  updatedAt?: string;
}

export interface GamePlayerUser {
  _id: string;
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  telegramId?: string; // Added for better user identification
}

export interface GamePlayer {
  _id: string;
  userId: string; // This should be string, not GamePlayerUser
  user?: GamePlayerUser; // This is populated by Mongoose
  isReady: boolean;
  joinedAt: string;
  playerType?: 'PLAYER' | 'SPECTATOR';
  isLateJoiner?: boolean; // Added: Track if player joined after game started
  numbersCalledAtJoin?: number[]; // Added: Numbers called when player joined
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
  // Added: Game settings and metadata
  settings?: {
    autoStart?: boolean;
    allowLateJoiners?: boolean;
    maxNumbers?: number;
  };
  // Added: Game statistics
  stats?: {
    totalNumbersCalled: number;
    averageMarkedPerPlayer?: number;
    gameDuration?: number;
  };
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
  isLateJoiner?: boolean; // Added: Track if this card belongs to a late joiner
  numbersCalledAtJoin?: number[]; // Added: Numbers that were called when this card was created
  joinedAt?: string; // Added: When the player joined the game
  // Added: Enhanced bingo card stats
  stats?: {
    totalMarked: number;
    markedPercentage: number;
    lastMarkedAt?: string;
    winningPattern?: number[]; // Pattern that resulted in win
  };
}

export interface GameState {
  currentNumber?: number;
  calledNumbers: number[];
  timeRemaining: number;
  isPlaying: boolean;
  lastCalledAt: Date | null;
  // Added: Enhanced game state for frontend
  timeSinceLastNumber?: string; // Calculated time string
  isLateJoiner?: boolean; // Whether current user is a late joiner
  numbersCalledAtJoin?: number[]; // Numbers called before current user joined
  // Added: Game progress
  progress?: {
    totalNumbers: number;
    calledNumbers: number;
    percentage: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string; // Added: Optional message for additional info
  timestamp?: string; // Added: When the response was generated
}

// ADDED: Winner information interface
export interface WinnerInfo {
  winner: GamePlayerUser;
  gameCode: string;
  totalPlayers: number;
  numbersCalled: number;
  endedAt?: string;
  // Added: Enhanced winner info
  winType?: 'LINE' | 'FULL_HOUSE' | 'PATTERN'; // Type of win
  winTime?: string; // How long it took to win
  isLateJoiner?: boolean; // Whether winner was a late joiner
  markedNumbers?: number[]; // Numbers that were marked for the win
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
  // Added: Enhanced stats
  lateJoiners?: number; // Number of players who joined late
  spectators?: number; // Number of spectators
  winRate?: number; // Percentage of players who won
  averageGameDuration?: number; // Average duration across games
}

// ADDED: Game creation and join interfaces
export interface CreateGameRequest {
  maxPlayers?: number;
  isPrivate?: boolean;
  settings?: {
    autoStart?: boolean;
    allowLateJoiners?: boolean;
  };
}

export interface JoinGameRequest {
  userId: string;
  playerType?: 'PLAYER' | 'SPECTATOR';
}

export interface MarkNumberRequest {
  userId: string;
  number: number;
}

export interface MarkNumberResponse {
  success: boolean;
  bingoCard: BingoCard;
  isWinner: boolean;
  isSpectator?: boolean;
  markedNumbers?: number[];
  winningPattern?: number[];
}

// ADDED: User game history interface
export interface UserGameHistory {
  game: Game;
  bingoCard?: BingoCard;
  userStats?: {
    markedNumbers: number;
    wasWinner: boolean;
    joinType: 'EARLY' | 'LATE' | 'SPECTATOR';
    gameDuration?: number;
  };
}

// ADDED: Real-time game events
export interface GameEvent {
  type: 'NUMBER_CALLED' | 'PLAYER_JOINED' | 'PLAYER_LEFT' | 'GAME_STARTED' | 'GAME_ENDED' | 'BINGO';
  data: any;
  timestamp: string;
  gameId: string;
}

// ADDED: Bingo patterns for win detection
export interface BingoPattern {
  name: string;
  pattern: number[]; // Positions that need to be marked
  description: string;
}

// ADDED: Enhanced user stats
export interface UserStats {
  userId: string;
  totalGames: number;
  gamesWon: number;
  winRate: number;
  averageScore: number;
  favoritePattern?: string;
  lateJoinerWins: number;
  quickestWin?: number; // Time in seconds
  longestGame?: number; // Time in seconds
  currentStreak?: number;
  bestStreak?: number;
}

// ADDED: Game lobby state
export interface LobbyState {
  game: Game;
  currentUser?: {
    userId: string;
    playerType: 'PLAYER' | 'SPECTATOR';
    isReady: boolean;
    isLateJoiner?: boolean;
  };
  canStart: boolean;
  autoStartCountdown?: number;
}

// ADDED: Number call information
export interface NumberCall {
  number: number;
  letter: string;
  calledAt: string;
  calledBy?: string; // If you track who called the number
  sequence: number; // Order in which it was called
}

// ADDED: Enhanced bingo card with rendering info
export interface BingoCardWithRender extends BingoCard {
  renderInfo?: {
    isMarked: (position: number) => boolean;
    isCalled: (number: number) => boolean;
    isPreCalled?: (number: number) => boolean; // For late joiners
    getCellState: (row: number, col: number) => 'EMPTY' | 'CALLED' | 'MARKED' | 'PRE_CALLED' | 'WINNING';
  };
}
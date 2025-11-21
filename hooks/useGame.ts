// hooks/useGame.ts - UPDATED with late joiner support
import { useState, useEffect, useCallback, useRef } from 'react';
import { Game, BingoCard, GameState } from '../types';
import { gameAPI } from '../services/api';

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}

interface UseGameReturn {
  // State
  game: Game | null;
  bingoCard: BingoCard | null;
  gameState: GameState & {
    timeSinceLastNumber: string;
    isLateJoiner?: boolean;
    numbersCalledAtJoin?: number[];
  };
  isLoading: boolean;
  error: string | null;
  
  // Actions
  markNumber: (number: number) => Promise<boolean>;
  refreshGame: () => void;
  manualCallNumber: () => Promise<number>;
  getWinnerInfo: () => Promise<any>;
  
  // User info
  isUserInGame: boolean;
  userRole: 'PLAYER' | 'SPECTATOR' | null;
  userId: string | null;
  
  // Late joiner info
  isLateJoiner: boolean;
  numbersCalledAtJoin: number[];
  
  // Utilities
  stopPolling: () => void;
  startPolling: () => void;
}

export const useGame = (gameId: string): UseGameReturn => {
  const [game, setGame] = useState<Game | null>(null);
  const [bingoCard, setBingoCard] = useState<BingoCard | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    currentNumber: undefined,
    calledNumbers: [],
    timeRemaining: 0,
    isPlaying: false,
    lastCalledAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to avoid stale closures
  const gameRef = useRef<Game | null>(null);
  const bingoCardRef = useRef<BingoCard | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Update refs when state changes
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    bingoCardRef.current = bingoCard;
  }, [bingoCard]);

  // Set mounted flag
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, []);

  // Get current user ID
  const getCurrentUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('user_id');
  };

  // Enhanced bingo card fetching with late joiner support
  const fetchBingoCard = useCallback(async (gameId: string, userId: string) => {
    try {
      const cardResponse = await gameAPI.getUserBingoCard(gameId, userId);
      if (isMountedRef.current && cardResponse.data.bingoCard) {
        const cardData = cardResponse.data.bingoCard;
        setBingoCard(cardData);
        
        // Log late joiner status for debugging
        if (cardData.isLateJoiner) {
          console.log(`🎯 User ${userId} is a late joiner. Pre-called numbers:`, cardData.numbersCalledAtJoin?.length || 0);
        }
        
        return cardData;
      }
    } catch (cardError) {
      // Silent fail - user might not have joined yet or card not found
      console.log('Bingo card not found or user not joined yet');
    }
    return null;
  }, []);

  // Enhanced game fetching with late joiner support
  const fetchGame = useCallback(async (silent: boolean = false) => {
    if (!gameId || !isMountedRef.current) return;

    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      
      const response = await gameAPI.getGame(gameId);
      const gameData = response.data.game;
      
      if (!isMountedRef.current) return;
      
      setGame(gameData);
      
      // Update game state with enhanced late joiner support
      const calledNumbers = gameData.numbersCalled || [];
      const latestNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : undefined;
      
      setGameState(prev => {
        const isNewNumber = latestNumber && latestNumber !== prev.currentNumber;
        
        return {
          ...prev,
          currentNumber: latestNumber,
          calledNumbers: calledNumbers,
          isPlaying: gameData.status === 'ACTIVE',
          lastCalledAt: isNewNumber ? new Date() : prev.lastCalledAt,
        };
      });

      // Fetch user's bingo card with enhanced error handling
      const userId = getCurrentUserId();
      if (userId && gameData.status !== 'FINISHED') {
        await fetchBingoCard(gameId, userId);
      }

    } catch (err) {
      if (!isMountedRef.current) return;
      
      console.error('Error fetching game:', err);
      const apiError = err as ApiError;
      
      if (!silent) {
        setError(apiError.response?.data?.error || apiError.message || 'Failed to load game');
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [gameId, fetchBingoCard]);

  // Smart polling system with adaptive intervals
  const startPolling = useCallback(() => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const currentGame = gameRef.current;
    if (!currentGame) return;

    // Determine polling interval based on game status and activity
    let interval = 10000; // Default: 10 seconds
    
    if (currentGame.status === 'ACTIVE') {
      // Faster polling for active games with recent activity
      const lastCalled = gameState.lastCalledAt;
      const now = new Date();
      const timeSinceLastCall = lastCalled ? now.getTime() - lastCalled.getTime() : Infinity;
      
      if (timeSinceLastCall < 30000) { // 30 seconds
        interval = 3000; // 3 seconds for very active games
      } else {
        interval = 5000; // 5 seconds for less active games
      }
    } else if (currentGame.status === 'WAITING') {
      interval = 8000; // 8 seconds for waiting games
    } else if (currentGame.status === 'FINISHED') {
      interval = 15000; // 15 seconds for finished games
    }

    console.log(`🔄 Starting polling every ${interval}ms for game status: ${currentGame.status}`);
    
    pollingIntervalRef.current = setInterval(() => {
      fetchGame(true);
    }, interval);

  }, [fetchGame, gameState.lastCalledAt]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 Stopped polling');
    }
  }, []);

  // Enhanced mark number function with late joiner support
  const markNumber = useCallback(async (number: number): Promise<boolean> => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      console.log(`🎯 Marking number: ${number}`);
      const response = await gameAPI.markNumber(gameId, userId, number);
      
      // Update bingo card immediately with optimistic update
      const updatedCard = response.data.bingoCard;
      setBingoCard(updatedCard);
      
      if (response.data.isWinner) {
        console.log('🎉 BINGO! User won!');
        
        // Special logging for late joiners
        if (updatedCard.isLateJoiner) {
          console.log('🏆 LATE JOINER VICTORY! User won with pre-called numbers!');
        }
        
        // Refresh game to get final state
        await fetchGame(true);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error marking number:', err);
      const apiError = err as ApiError;
      
      // Enhanced error messages for late joiners
      const errorMessage = apiError.response?.data?.error || apiError.message || 'Failed to mark number';
      
      if (errorMessage.includes('called before you joined')) {
        throw new Error('This number was called before you joined. All numbers count towards your bingo automatically!');
      }
      
      throw new Error(errorMessage);
    }
  }, [gameId, fetchGame]);

  // Manual number calling for debugging
  const manualCallNumber = useCallback(async (): Promise<number> => {
    try {
      console.log('🎯 Manually calling number...');
      const response = await gameAPI.callNumber(gameId);
      
      // Update state immediately for better UX
      setGameState(prev => ({
        ...prev,
        currentNumber: response.data.number,
        calledNumbers: response.data.calledNumbers,
        lastCalledAt: new Date(),
      }));
      
      // Refresh full game state
      setTimeout(() => fetchGame(true), 500);
      
      return response.data.number;
    } catch (err) {
      console.error('Manual call failed:', err);
      const apiError = err as ApiError;
      throw new Error(apiError.response?.data?.error || apiError.message || 'Failed to call number');
    }
  }, [gameId, fetchGame]);

  // Get winner information
  const getWinnerInfo = useCallback(async () => {
    try {
      const response = await gameAPI.getWinnerInfo(gameId);
      return response.data.winnerInfo;
    } catch (err) {
      console.error('Error getting winner info:', err);
      return null;
    }
  }, [gameId]);

  // Check if user is in the game
  const isUserInGame = useCallback((): boolean => {
    if (!game?.players || !getCurrentUserId()) return false;
    return game.players.some(player => player.userId === getCurrentUserId());
  }, [game]);

  // Get current user's role in the game
  const getUserRole = useCallback((): 'PLAYER' | 'SPECTATOR' | null => {
    if (!game?.players || !getCurrentUserId()) return null;
    const player = game.players.find(p => p.userId === getCurrentUserId());
    return player?.playerType || 'PLAYER';
  }, [game]);

  // Get time since last number
  const getTimeSinceLastNumber = useCallback((): string => {
    if (!gameState.lastCalledAt) return 'Waiting for first number...';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - gameState.lastCalledAt.getTime()) / 1000);
    
    if (diffInSeconds < 5) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  }, [gameState.lastCalledAt]);

  // Late joiner information
  const isLateJoiner = bingoCard?.isLateJoiner || false;
  const numbersCalledAtJoin = bingoCard?.numbersCalledAtJoin || [];

  // Enhanced game state with late joiner info
  const enhancedGameState = {
    ...gameState,
    timeSinceLastNumber: getTimeSinceLastNumber(),
    isLateJoiner,
    numbersCalledAtJoin,
  };

  // Main effect - initialize game and polling
  useEffect(() => {
    if (!gameId) return;

    console.log('🎮 Initializing game hook for:', gameId);
    
    // Initial fetch
    fetchGame();

    // Start polling management with adaptive intervals
    const pollingCheckInterval = setInterval(() => {
      startPolling();
    }, 10000); // Check every 10 seconds to adjust polling

    return () => {
      console.log('🧹 Cleaning up game hook');
      stopPolling();
      clearInterval(pollingCheckInterval);
    };
  }, [gameId, fetchGame, startPolling, stopPolling]);

  // Effect to adjust polling when game status changes
  useEffect(() => {
    if (game) {
      console.log(`🔄 Game status changed to: ${game.status}, adjusting polling`);
      startPolling();
    }
  }, [game?.status, startPolling]);

  // Debug effect for number calls and late joiner status
  useEffect(() => {
    if (gameState.currentNumber && gameState.lastCalledAt) {
      console.log(`🔢 New number detected: ${gameState.currentNumber}, Total called: ${gameState.calledNumbers.length}, Time: ${gameState.lastCalledAt.toLocaleTimeString()}`);
    }
    
    // Log late joiner status changes
    if (bingoCard?.isLateJoiner && !bingoCardRef.current?.isLateJoiner) {
      console.log(`🎯 User identified as late joiner with ${bingoCard.numbersCalledAtJoin?.length || 0} pre-called numbers`);
    }
  }, [gameState.currentNumber, gameState.calledNumbers.length, gameState.lastCalledAt, bingoCard]);

  return {
    // State
    game,
    bingoCard,
    gameState: enhancedGameState,
    isLoading,
    error,
    
    // Actions
    markNumber,
    refreshGame: () => fetchGame(false),
    manualCallNumber,
    getWinnerInfo,
    
    // User info
    isUserInGame: isUserInGame(),
    userRole: getUserRole(),
    userId: getCurrentUserId(),
    
    // Late joiner info
    isLateJoiner,
    numbersCalledAtJoin,
    
    // Utilities
    stopPolling,
    startPolling,
  };
};
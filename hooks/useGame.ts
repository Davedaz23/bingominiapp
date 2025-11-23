// hooks/useGame.ts - FIXED VERSION
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
  
  // Use refs to avoid stale closures and track changes
  const gameRef = useRef<Game | null>(null);
  const bingoCardRef = useRef<BingoCard | null>(null);
  const gameStateRef = useRef(gameState);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const lastSuccessfulFetchRef = useRef<number>(Date.now());

  // Update refs when state changes
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    bingoCardRef.current = bingoCard;
  }, [bingoCard]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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

  // Enhanced bingo card fetching with better error handling and timeout management
  const fetchBingoCard = useCallback(async (gameId: string, userId: string): Promise<BingoCard | null> => {
    if (!gameId || !userId) return null;

    try {
      console.log(`🃏 Fetching bingo card for user ${userId}`);
      const cardResponse = await gameAPI.getUserBingoCard(gameId, userId);
      
      if (isMountedRef.current && cardResponse.data.bingoCard) {
        const cardData = cardResponse.data.bingoCard;
        
        // Only update if card actually changed
        if (JSON.stringify(bingoCardRef.current) !== JSON.stringify(cardData)) {
          setBingoCard(cardData);
          
          // Log late joiner status for debugging
          if (cardData.isLateJoiner) {
            console.log(`🎯 User ${userId} is a late joiner. Pre-called numbers:`, cardData.numbersCalledAtJoin?.length || 0);
          }
        }
        
        consecutiveErrorsRef.current = 0; // Reset error counter on success
        return cardData;
      }
    } catch (cardError) {
      consecutiveErrorsRef.current++;
      console.warn('Bingo card not found or user not joined yet:', cardError);
      
      // If we have too many consecutive errors, stop trying to fetch the card
      if (consecutiveErrorsRef.current > 3) {
        console.log('🃏 Too many card fetch errors, stopping card polling');
      }
    }
    return null;
  }, []);

  // Smart game state update - only update when data actually changes
  const updateGameState = useCallback((gameData: Game) => {
    const calledNumbers = gameData.numbersCalled || [];
    const latestNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : undefined;
    
    setGameState(prev => {
      const isNewNumber = latestNumber && latestNumber !== prev.currentNumber;
      const calledNumbersChanged = JSON.stringify(prev.calledNumbers) !== JSON.stringify(calledNumbers);
      
      // Only update if something actually changed
      if (!isNewNumber && !calledNumbersChanged && prev.isPlaying === (gameData.status === 'ACTIVE')) {
        return prev;
      }
      
      return {
        ...prev,
        currentNumber: latestNumber,
        calledNumbers: calledNumbers,
        isPlaying: gameData.status === 'ACTIVE',
        lastCalledAt: isNewNumber ? new Date() : prev.lastCalledAt,
      };
    });
  }, []);

  // Enhanced game fetching with optimized updates and better error handling
  const fetchGame = useCallback(async (silent: boolean = false) => {
    if (!gameId || !isMountedRef.current) return;

    // If we've had too many recent errors, reduce polling frequency
    const timeSinceLastSuccess = Date.now() - lastSuccessfulFetchRef.current;
    if (consecutiveErrorsRef.current > 2 && timeSinceLastSuccess < 30000) {
      console.log('⏸️ Too many errors, skipping fetch');
      return;
    }

    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      
      console.log(`🎮 Fetching game data for: ${gameId}`);
      const response = await gameAPI.getGame(gameId);
      const gameData = response.data.game;
      
      if (!isMountedRef.current) return;
      
      // Only update game if data actually changed
      if (JSON.stringify(gameRef.current) !== JSON.stringify(gameData)) {
        setGame(gameData);
      }
      
      // Update game state with optimized checks
      updateGameState(gameData);

      // Fetch user's bingo card with enhanced error handling
      const userId = getCurrentUserId();
      if (userId && gameData.status === 'ACTIVE') {
        await fetchBingoCard(gameId, userId);
      }

      // Reset error counter and update last successful fetch time
      consecutiveErrorsRef.current = 0;
      lastSuccessfulFetchRef.current = Date.now();

    } catch (err) {
      if (!isMountedRef.current) return;
      
      consecutiveErrorsRef.current++;
      console.error('Error fetching game:', err);
      const apiError = err as ApiError;
      
      if (!silent) {
        setError(apiError.response?.data?.error || apiError.message || 'Failed to load game');
      }

      // If we're getting consistent timeouts, suggest network issues
      if (consecutiveErrorsRef.current > 3) {
        console.warn('🔴 Multiple consecutive API errors detected. Check network connection.');
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [gameId, fetchBingoCard, updateGameState]);

  // Adaptive polling system with error-based backoff
  const startPolling = useCallback(() => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const currentGame = gameRef.current;
    if (!currentGame) return;

    // Determine polling interval based on game status, activity, and error count
    let baseInterval = 10000; // Default: 10 seconds
    
    if (currentGame.status === 'ACTIVE') {
      // Faster polling for active games with recent activity
      const lastCalled = gameStateRef.current.lastCalledAt;
      const now = new Date();
      const timeSinceLastCall = lastCalled ? now.getTime() - lastCalled.getTime() : Infinity;
      
      if (timeSinceLastCall < 30000) { // 30 seconds
        baseInterval = 3000; // 3 seconds for very active games
      } else {
        baseInterval = 5000; // 5 seconds for less active games
      }
    } else if (currentGame.status === 'WAITING') {
      baseInterval = 8000; // 8 seconds for waiting games
    } else if (currentGame.status === 'FINISHED') {
      baseInterval = 15000; // 15 seconds for finished games
    }

    // Apply error-based backoff
    let finalInterval = baseInterval;
    if (consecutiveErrorsRef.current > 0) {
      finalInterval = Math.min(baseInterval * Math.pow(2, consecutiveErrorsRef.current), 60000); // Max 60 seconds
      console.log(`⚠️ Applying error backoff: ${finalInterval}ms due to ${consecutiveErrorsRef.current} errors`);
    }

    console.log(`🔄 Starting polling every ${finalInterval}ms for game status: ${currentGame.status}`);
    
    pollingIntervalRef.current = setInterval(() => {
      fetchGame(true);
    }, finalInterval);

  }, [fetchGame]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 Stopped polling');
    }
  }, []);

  // Enhanced mark number function with better error handling
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
      
      // FIX: Always update the card to get the latest winner status
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

  // Manual number calling for debugging with timeout handling
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
      
      // Refresh full game state after a short delay
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

  // Check automatic win
  const checkAutomaticWin = useCallback(async (): Promise<boolean> => {
    try {
      const userId = getCurrentUserId();
      if (!userId || !bingoCardRef.current?.isLateJoiner) return false;

      // Only check for automatic wins for late joiners
      const response = await gameAPI.checkForWin(gameId, userId);
      
      if (response.data.isWinner && !bingoCardRef.current?.isWinner) {
        console.log('🎉 AUTOMATIC BINGO DETECTED for late joiner!');
        
        // Update bingo card with winner status
        setBingoCard(prev => prev ? { ...prev, isWinner: true } : null);
        
        // Show win animation
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking automatic win:', error);
      return false;
    }
  }, [gameId]);

  // Main effect - initialize game and polling
  useEffect(() => {
    if (!gameId) return;

    console.log('🎮 Initializing game hook for:', gameId);
    
    // Initial fetch
    fetchGame();

    // Start polling
    startPolling();

    return () => {
      console.log('🧹 Cleaning up game hook');
      stopPolling();
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
  }, [gameState.currentNumber, gameState.calledNumbers.length, gameState.lastCalledAt]);

  // Automatic win checking for late joiners
  useEffect(() => {
    if (bingoCard?.isLateJoiner && !bingoCard.isWinner && gameState.calledNumbers.length > 0) {
      // Debounced automatic win check for late joiners
      const timeoutId = setTimeout(() => {
        checkAutomaticWin();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [gameState.calledNumbers, bingoCard?.isLateJoiner, bingoCard?.isWinner, checkAutomaticWin]);

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
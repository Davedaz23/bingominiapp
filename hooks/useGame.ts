/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useGame.ts - COMPLETE FIXED VERSION (Manual Marking Only)
import { useState, useEffect, useCallback, useRef } from 'react';
import { Game, BingoCard, GameState } from '../types';
import { gameAPI, walletAPIAuto } from '../services/api';

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}

interface MarkNumberResponse {
  success: boolean;
  bingoCard: BingoCard;
  markedCount: number;
  message?: string;
}

// Update the interface to include callNumber
interface UseGameReturn {
  // State
  game: Game | null;
  bingoCard: BingoCard | null;
  gameState: GameState & {
    timeSinceLastNumber: string;
  };
  isLoading: boolean;
  error: string | null;
  walletBalance: number;
  refreshWalletBalance: () => Promise<void>;
  // Actions
  // markNumber: (number: number) => Promise<boolean>;
  refreshGame: () => void;
  manualCallNumber: () => Promise<number>;
  callNumber: () => Promise<number>;
  getWinnerInfo: () => Promise<any>;
  claimBingo: () => Promise<{
    success: boolean;
    message: string;
    patternType?: string;
    prizeAmount?: number;
  }>;
  
  // User info
  isUserInGame: boolean;
  userRole: 'PLAYER' | 'SPECTATOR' | null;
  userId: string | null;
}

export const useGame = (gameId: string): UseGameReturn => {
  const [game, setGame] = useState<Game | null>(null);
  const [bingoCard, setBingoCard] = useState<BingoCard | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    isStarted: false,
    calledNumbers: [],
    currentNumber: null,
    players: 0,
    potAmount: 0,
    timeRemaining: 0,
    gameEnded: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
    const [walletBalance, setWalletBalance] = useState<number>(0);
  // Use refs to avoid stale closures and track changes
  const gameRef = useRef<Game | null>(null);
  const bingoCardRef = useRef<BingoCard | null>(null);
  const gameStateRef = useRef(gameState);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const lastSuccessfulFetchRef = useRef<number>(Date.now());



   const refreshWalletBalance = useCallback(async () => {
    try {
      const walletResponse = await walletAPIAuto.getBalance();
      if (walletResponse.data.success) {
        setWalletBalance(walletResponse.data.balance);
      }
    } catch (error) {
      console.warn('Could not refresh wallet balance:', error);
    }
  }, []);

  // Initial balance load
  useEffect(() => {
    refreshWalletBalance();
  }, [refreshWalletBalance]);
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

  // Stop polling (internal function)
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 Stopped polling');
    }
  }, []);

  // Set mounted flag
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Get current user ID
  const getCurrentUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
  };

  // Enhanced bingo card fetching with better error handling
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
  // Handle both 'calledNumbers' and 'numbersCalled' property names
  const calledNumbers = 
    (gameData as any).calledNumbers || 
    (gameData as any).numbersCalled || 
    [];
  
  const latestNumber = calledNumbers.length > 0 
    ? calledNumbers[calledNumbers.length - 1] 
    : null;
  
  setGameState(prev => {
    const isNewNumber = latestNumber && latestNumber !== prev.currentNumber;
    const calledNumbersChanged = JSON.stringify(prev.calledNumbers) !== JSON.stringify(calledNumbers);
    const isStarted = gameData.status === 'ACTIVE' || gameData.status === 'FINISHED';
    const gameEnded = gameData.status === 'FINISHED';
    
    // Only update if something actually changed
    if (!isNewNumber && !calledNumbersChanged && 
        prev.isStarted === isStarted && 
        prev.gameEnded === gameEnded) {
      return prev;
    }
    
    // Return a proper GameState object
    const newState: GameState = {
      isStarted,
      currentNumber: latestNumber,
      calledNumbers: calledNumbers,
      players: gameData.currentPlayers || gameData.players?.length || 0,
      potAmount: gameData.potAmount || 0,
      timeRemaining: gameData.timeRemaining || 0,
      gameEnded
    };
    
    return newState;
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
      if (userId && (gameData.status === 'ACTIVE' || gameData.status === 'FINISHED')) {
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

  // Adaptive polling system with error-based backoff (internal function)
  const startPolling = useCallback(() => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const currentGame = gameRef.current;
    if (!currentGame) return;

    // DETERMINE POLLING INTERVAL BASED ON GAME STATUS
    let baseInterval = 10000; // Default: 10 seconds
    
    if (currentGame.status === 'ACTIVE') {
      // MUCH FASTER POLLING FOR ACTIVE GAMES - to see called numbers
      baseInterval = 2000; // 2 seconds for active games
    } else if (currentGame.status === 'WAITING') {
      baseInterval = 8000; // 8 seconds for waiting games
    } else if (currentGame.status === 'FINISHED') {
      baseInterval = 15000; // 15 seconds for finished games
    }

    // Apply error-based backoff
    let finalInterval = baseInterval;
    if (consecutiveErrorsRef.current > 0) {
      finalInterval = Math.min(baseInterval * Math.pow(2, consecutiveErrorsRef.current), 60000);
    }

    console.log(`🔄 Starting polling every ${finalInterval}ms for game status: ${currentGame.status}`);
    
    pollingIntervalRef.current = setInterval(() => {
      fetchGame(true);
    }, finalInterval);

  }, [fetchGame]);

  // **FIXED: Manual mark number function (NO AUTO-WIN CHECKING)**
  // const markNumber = useCallback(async (number: number): Promise<boolean> => {
  //   try {
  //     const userId = getCurrentUserId();
  //     if (!userId) {
  //       throw new Error('No user ID found');
  //     }

  //     console.log(`🎯 Marking number: ${number}`);
  //     const response = await gameAPI.markNumber(gameId, userId, number);
      
  //     // MANUAL MODE: Just update the bingo card with the marked position
  //     const updatedCard = response.data.bingoCard;
      
  //     // Update the local bingo card
  //     setBingoCard(updatedCard);
      
  //     console.log(`✅ Number ${number} marked successfully. Marked count: ${updatedCard.markedPositions?.length || 0}`);
      
  //     // In manual mode, markNumber should NEVER check for wins
  //     // The user must click "CLAIM BINGO" separately
  //     return false; // Always return false for manual mode
      
  //   } catch (err) {
  //     console.error('Error marking number:', err);
  //     const apiError = err as ApiError;
      
  //     const errorMessage = apiError.response?.data?.error || apiError.message || 'Failed to mark number';
  //     throw new Error(errorMessage);
  //   }
  // }, [gameId]);

  // Manual Bingo claim function
  const claimBingo = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      console.log(`🏆 Attempting to claim BINGO for user ${userId}`);
      const response = await gameAPI.claimBingo(gameId, userId, 'BINGO');
      
      if (response.data.success) {
        console.log('🎉 BINGO claim successful!');
        
        // Refresh game to show winner
        setTimeout(() => fetchGame(true), 1000);
        
        return {
          success: true,
          message: response.data.message || 'Bingo claimed successfully!',
          patternType: response.data.patternType,
          prizeAmount: response.data.prizeAmount
        };
      } else {
        throw new Error(response.data.message || 'Failed to claim bingo');
      }
    } catch (err) {
      console.error('Error claiming bingo:', err);
      const apiError = err as ApiError;
      
      return {
        success: false,
        message: apiError.response?.data?.error || apiError.message || 'Failed to claim bingo'
      };
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

  // Add the callNumber function (similar to manualCallNumber but for general use)
  const callNumber = useCallback(async (): Promise<number> => {
    try {
      console.log(`🎲 Calling next number for game ${gameId}`);
      const response = await gameAPI.callNumber(gameId);
      
      // Update state immediately for better UX
      setGameState(prev => ({
        ...prev,
        currentNumber: response.data.number,
        calledNumbers: response.data.calledNumbers,
      }));
      
      // Refresh full game state after a short delay
      setTimeout(() => fetchGame(true), 500);
      
      console.log(`✅ Called number: ${response.data.number}, Total called: ${response.data.totalCalled || response.data.calledNumbers?.length || 0}`);
      
      return response.data.number;
    } catch (err) {
      console.error('Error calling number:', err);
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
    return game.players.some((player: any) => player.userId === getCurrentUserId());
  }, [game]);

  // Get current user's role in the game
  const getUserRole = useCallback((): 'PLAYER' | 'SPECTATOR' | null => {
    if (!game?.players || !getCurrentUserId()) return null;
    const player = game.players.find((p: any) => p.userId === getCurrentUserId());
    return player?.playerType || 'PLAYER';
  }, [game]);

  // Get time since last number (simplified since we don't have lastCalledAt)
  const getTimeSinceLastNumber = useCallback((): string => {
    // Since we don't have lastCalledAt in the Game type, we'll use a simple approach
    if (!gameState.currentNumber) return 'Waiting for first number...';
    return 'Active game'; // Simplified since we don't have timestamp data
  }, [gameState.currentNumber]);


  // Enhanced game state with time info
  const enhancedGameState = {
    ...gameState,
    timeSinceLastNumber: getTimeSinceLastNumber(),
  };

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

  // Debug effect for number calls
  useEffect(() => {
    if (gameState.currentNumber) {
      console.log(`🔢 Current number: ${gameState.currentNumber}, Total called: ${gameState.calledNumbers.length}`);
    }
  }, [gameState.currentNumber, gameState.calledNumbers.length]);

  // Debug effect for manual mode testing
  useEffect(() => {
    console.log('🎯 MANUAL MODE ACTIVE - Users must click numbers to mark them');
    console.log('🏆 Users must click "CLAIM BINGO" to win');
    
    // Log initial card state
    if (bingoCard) {
      console.log('🃏 Initial bingo card loaded:', {
        markedPositions: bingoCard.markedPositions?.length || 0,
        numbers: bingoCard.numbers ? 'Loaded' : 'Not loaded'
      });
    }
  }, [bingoCard]);

  return {
    // State
    game,
    bingoCard,
    gameState: enhancedGameState,
    isLoading,
    error,
    
    // Actions
    // markNumber,
    refreshGame: () => fetchGame(false),
    manualCallNumber,
    callNumber,
    getWinnerInfo,
    claimBingo, // Add claimBingo to return object
        walletBalance,
    refreshWalletBalance,
    // User info
    isUserInGame: isUserInGame(),
    userRole: getUserRole(),
    userId: getCurrentUserId(),
  };
};
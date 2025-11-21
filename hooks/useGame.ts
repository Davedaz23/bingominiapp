// hooks/useGame.ts - FULLY CORRECTED VERSION
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

export const useGame = (gameId: string) => {
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Update refs when state changes
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Set mounted flag
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get current user ID
  const getCurrentUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('user_id');
  };

  // Enhanced game fetching
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
      
      // Update game state
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

      // Fetch user's bingo card
      const userId = getCurrentUserId();
      if (userId && gameData.status !== 'FINISHED') {
        try {
          const cardResponse = await gameAPI.getUserBingoCard(gameId, userId);
          if (isMountedRef.current && cardResponse.data.bingoCard) {
            setBingoCard(cardResponse.data.bingoCard);
          }
        } catch (cardError) {
          // Silent fail - user might not have joined yet
        }
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
  }, [gameId]);

  // Smart polling system
  const startPolling = useCallback(() => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const currentGame = gameRef.current;
    if (!currentGame) return;

    // Determine polling interval based on game status
    let interval = 10000; // Default: 10 seconds
    
    if (currentGame.status === 'ACTIVE') {
      interval = 3000; // 3 seconds for active games
    } else if (currentGame.status === 'WAITING') {
      interval = 8000; // 8 seconds for waiting games
    }

    console.log(`🔄 Starting polling every ${interval}ms for game status: ${currentGame.status}`);
    
    pollingIntervalRef.current = setInterval(() => {
      fetchGame(true);
    }, interval);

  }, [fetchGame]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 Stopped polling');
    }
  }, []);

  // Manual number calling for debugging
  const manualCallNumber = useCallback(async () => {
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

  // Mark number function
  const markNumber = useCallback(async (number: number): Promise<boolean> => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      console.log(`🎯 Marking number: ${number}`);
      const response = await gameAPI.markNumber(gameId, userId, number);
      
      // Update bingo card immediately
      setBingoCard(response.data.bingoCard);
      
      if (response.data.isWinner) {
        console.log('🎉 BINGO! User won!');
        // Refresh game to get final state
        await fetchGame(true);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error marking number:', err);
      const apiError = err as ApiError;
      throw new Error(apiError.response?.data?.error || apiError.message || 'Failed to mark number');
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

  // Get time since last number
  const getTimeSinceLastNumber = useCallback((): string => {
    if (!gameState.lastCalledAt) return 'Waiting for first number...';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - gameState.lastCalledAt.getTime()) / 1000);
    
    if (diffInSeconds < 5) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  }, [gameState.lastCalledAt]);

  // Get current user's role in the game
  const getUserRole = useCallback((): 'PLAYER' | 'SPECTATOR' | null => {
    if (!game?.players || !getCurrentUserId()) return null;
    const player = game.players.find(p => p.userId === getCurrentUserId());
    return player?.playerType || 'PLAYER';
  }, [game]);

  // Main effect - initialize game and polling
  useEffect(() => {
    if (!gameId) return;

    console.log('🎮 Initializing game hook for:', gameId);
    
    // Initial fetch
    fetchGame();

    // Start polling management
    const pollingCheckInterval = setInterval(() => {
      startPolling();
    }, 5000);

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

  // Debug effect for number calls
  useEffect(() => {
    if (gameState.currentNumber && gameState.lastCalledAt) {
      console.log(`🔢 New number detected: ${gameState.currentNumber}, Total called: ${gameState.calledNumbers.length}, Time: ${gameState.lastCalledAt.toLocaleTimeString()}`);
    }
  }, [gameState.currentNumber, gameState.calledNumbers.length, gameState.lastCalledAt]);

  return {
    // State
    game,
    bingoCard,
    gameState: {
      ...gameState,
      timeSinceLastNumber: getTimeSinceLastNumber(),
    },
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
    
    // Utilities
    stopPolling,
    startPolling,
  };
};
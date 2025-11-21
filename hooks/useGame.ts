// hooks/useGame.ts
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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to avoid stale closures in intervals
  const gameRef = useRef<Game | null>(null);
  const numberCallIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update refs when state changes
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Get current user ID
  const getCurrentUserId = () => {
    return localStorage.getItem('user_id');
  };

  // REMOVED: isHost function since we don't have hosts anymore

  const fetchGame = useCallback(async () => {
    if (!gameId || gameId === 'active' || gameId === 'waiting') {
      console.error('Invalid gameId:', gameId);
      setError('Invalid game ID');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching game with ID:', gameId);
      
      const gameResponse = await gameAPI.getGame(gameId);
      const gameData = gameResponse.data.game;
      
      setGame(gameData);
      
      // Update game state with the latest numbers
      setGameState(prev => ({
        ...prev,
        currentNumber: gameData.numbersCalled?.[gameData.numbersCalled.length - 1],
        calledNumbers: gameData.numbersCalled || [],
        isPlaying: gameData.status === 'ACTIVE',
      }));

      // Fetch user's bingo card
      const userId = getCurrentUserId();
      if (userId) {
        try {
          const cardResponse = await gameAPI.getUserBingoCard(gameId, userId);
          if (cardResponse.data.bingoCard) {
            setBingoCard(cardResponse.data.bingoCard);
          }
        } catch (cardError) {
          console.log('No bingo card found for user yet');
        }
      }
    } catch (err) {
      console.error('Error fetching game:', err);
      const apiError = err as ApiError;
      // Don't set error for network issues during polling
      if (!apiError.message?.includes('Network Error')) {
        setError(apiError.response?.data?.error || apiError.message || 'Failed to load game');
      }
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // NEW: Check if numbers are being called automatically
  const checkAutoNumberCalling = useCallback(() => {
    const currentGame = gameRef.current;
    if (!currentGame || currentGame.status !== 'ACTIVE') {
      return;
    }

    // Check if numbers are being called (if we have recent numbers)
    const calledNumbers = currentGame.numbersCalled || [];
    const lastCalledTime = currentGame.updatedAt;
    
    if (calledNumbers.length > 0 && lastCalledTime) {
      const lastCalled = new Date(lastCalledTime).getTime();
      const now = new Date().getTime();
      const timeSinceLastCall = now - lastCalled;
      
      // If it's been more than 15 seconds since last number, numbers might not be auto-calling
      if (timeSinceLastCall > 15000) {
        console.log('⚠️ Numbers might not be auto-calling. Last call was', Math.floor(timeSinceLastCall / 1000), 'seconds ago');
      }
    }
  }, []);

  // NEW: Manual number calling for testing/debugging
  const manualCallNumber = useCallback(async () => {
    try {
      console.log('🎯 Manually calling number...');
      await gameAPI.callNumber(gameId);
      
      // Wait a bit then refresh to see the new number
      setTimeout(() => {
        fetchGame();
      }, 1000);
      
    } catch (err) {
      console.error('❌ Manual call failed:', err);
      const apiError = err as ApiError;
      throw new Error(apiError.response?.data?.error || apiError.message || 'Failed to call number');
    }
  }, [gameId, fetchGame]);

  // Main effect for game polling
  useEffect(() => {
    if (!gameId) return;

    let pollInterval: NodeJS.Timeout;
    
    const initializeGame = async () => {
      await fetchGame();
      
      // Start polling
      pollInterval = setInterval(() => {
        fetchGame();
        checkAutoNumberCalling();
      }, 8000); // Poll every 8 seconds
    };

    initializeGame();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      // REMOVED: stopAutoNumberCalling since we don't have host controls
    };
  }, [gameId, fetchGame, checkAutoNumberCalling]);

  // Effect to check auto number calling status
  useEffect(() => {
    if (game?.status === 'ACTIVE') {
      console.log('🎮 Game is ACTIVE - numbers should be called automatically every 10 seconds');
      checkAutoNumberCalling();
    }
  }, [game?.status, checkAutoNumberCalling]);

  const markNumber = async (number: number): Promise<boolean> => {
    if (!bingoCard) {
      console.error('No bingo card available');
      return false;
    }
    
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        console.error('No user ID found');
        return false;
      }

      const response = await gameAPI.markNumber(gameId, userId, number);
      setBingoCard(response.data.bingoCard);
      
      if (response.data.isWinner) {
        await fetchGame();
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error marking number:', err);
      const apiError = err as ApiError;
      throw new Error(apiError.response?.data?.error || apiError.message || 'Failed to mark number');
    }
  };

  // NEW: Get winner information
  const getWinnerInfo = useCallback(async () => {
    try {
      const response = await gameAPI.getWinnerInfo(gameId);
      return response.data.winnerInfo;
    } catch (err) {
      console.error('Error getting winner info:', err);
      return null;
    }
  }, [gameId]);

  // NEW: Check if user is in the game
  const isUserInGame = useCallback((): boolean => {
    if (!game?.players || !getCurrentUserId()) return false;
    return game.players.some(player => player?.user?._id === getCurrentUserId());
  }, [game]);

  // NEW: Get user's role in the game
  const getUserRole = useCallback((): 'PLAYER' | 'SPECTATOR' | null => {
    if (!game?.players || !getCurrentUserId()) return null;
    const player = game.players.find(p => p?.user?._id === getCurrentUserId());
    return player?.playerType || 'PLAYER';
  }, [game]);

  return {
    game,
    bingoCard,
    gameState,
    isLoading,
    error,
    markNumber,
    refreshGame: fetchGame,
    manualCallNumber, // For testing/debugging
    getWinnerInfo,
    isUserInGame: isUserInGame(),
    userRole: getUserRole(),
    // REMOVED: isHost since we don't have hosts
  };
};
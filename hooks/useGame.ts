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
  const isHostRef = useRef<boolean>(false);
  const numberCallIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update refs when state changes
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Get current user ID
  const getCurrentUserId = () => {
    return localStorage.getItem('user_id');
  };

  // Check if current user is host
  const isHost = useCallback(() => {
    if (!game?.host || !getCurrentUserId()) return false;
    return game.host._id === getCurrentUserId();
  }, [game]);

  // Update host ref
  useEffect(() => {
    isHostRef.current = isHost();
  }, [isHost]);

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

  // NEW: Improved automatic number calling
  const startAutoNumberCalling = useCallback(async () => {
    const currentGame = gameRef.current;
    if (!currentGame || !isHostRef.current || currentGame.status !== 'ACTIVE') {
      return;
    }

    console.log('Starting automatic number calling for host');
    
    // Clear any existing interval
    if (numberCallIntervalRef.current) {
      clearInterval(numberCallIntervalRef.current);
    }

    const callNumber = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) return;

        console.log('Calling next number...');
        await gameAPI.callNumber(gameId, userId);
        
        // Wait a bit then refresh to see the new number
        setTimeout(() => {
          fetchGame();
        }, 1000);
        
      } catch (err) {
        console.error('Error calling number:', err);
        const apiError = err as ApiError;
        
        // Stop calling numbers if game is finished or not active
        if (apiError.response?.data?.error?.includes('finished') || 
            apiError.response?.data?.error?.includes('not active')) {
          if (numberCallIntervalRef.current) {
            clearInterval(numberCallIntervalRef.current);
            numberCallIntervalRef.current = null;
          }
        }
      }
    };

    // Call first number immediately, then set interval
    callNumber();
    numberCallIntervalRef.current = setInterval(callNumber, 10000); // Call every 10 seconds

  }, [gameId, fetchGame]);

  // Stop number calling
  const stopAutoNumberCalling = useCallback(() => {
    if (numberCallIntervalRef.current) {
      clearInterval(numberCallIntervalRef.current);
      numberCallIntervalRef.current = null;
    }
  }, []);

  // Main effect for game polling
  useEffect(() => {
    if (!gameId) return;

    let pollInterval: NodeJS.Timeout;
    
    const initializeGame = async () => {
      await fetchGame();
      
      // Start polling
      pollInterval = setInterval(fetchGame, 8000); // Poll every 8 seconds
    };

    initializeGame();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      stopAutoNumberCalling();
    };
  }, [gameId, fetchGame, stopAutoNumberCalling]);

  // Effect for auto number calling
  useEffect(() => {
    if (game?.status === 'ACTIVE' && isHost()) {
      console.log('Game is ACTIVE and user is host, starting number calling');
      startAutoNumberCalling();
    } else {
      console.log('Stopping number calling - game status:', game?.status, 'isHost:', isHost());
      stopAutoNumberCalling();
    }

    return () => {
      stopAutoNumberCalling();
    };
  }, [game?.status, isHost, startAutoNumberCalling, stopAutoNumberCalling]);

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

  return {
    game,
    bingoCard,
    gameState,
    isLoading,
    error,
    markNumber,
    refreshGame: fetchGame,
    isHost: isHost(),
  };
};
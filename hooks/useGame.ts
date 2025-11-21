// hooks/useGame.ts
import { useState, useEffect, useCallback } from 'react';
import { Game, BingoCard, GameState } from '../types';
import { gameAPI } from '../services/api'; // Use your correct API path

// Define error response type
interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}

// hooks/useGame.ts
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
  const [numberCallInterval, setNumberCallInterval] = useState<NodeJS.Timeout | null>(null);

  // Get current user ID
  const getCurrentUserId = () => {
    return localStorage.getItem('user_id');
  };

  // Check if current user is host
  const isHost = useCallback(() => {
    if (!game?.host || !getCurrentUserId()) return false;
    return game.host._id === getCurrentUserId();
  }, [game]);

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
      
      // Fetch game data
      const gameResponse = await gameAPI.getGame(gameId);
      const gameData = gameResponse.data.game;
      
      setGame(gameData);
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        currentNumber: gameData.numbersCalled?.[gameData.numbersCalled.length - 1],
        calledNumbers: gameData.numbersCalled || [],
        isPlaying: gameData.status === 'ACTIVE',
      }));

      // Fetch user's bingo card separately
      const userId = getCurrentUserId();
      if (userId) {
        try {
          const cardResponse = await gameAPI.getUserBingoCard(gameId, userId);
          if (cardResponse.data.bingoCard) {
            setBingoCard(cardResponse.data.bingoCard);
          }
        } catch (cardError) {
          console.log('No bingo card found for user yet');
          // This is normal if user hasn't joined the game
        }
      }
    } catch (err) {
      console.error('Error fetching game:', err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.error || apiError.message || 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // NEW: Automatic number calling function
  const startAutoNumberCalling = useCallback(async () => {
    if (!game || !isHost() || game.status !== 'ACTIVE') {
      return;
    }

    console.log('Starting automatic number calling for host');
    
    // Clear any existing interval
    if (numberCallInterval) {
      clearInterval(numberCallInterval);
    }

    const interval = setInterval(async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) return;

        console.log('Calling next number...');
        await gameAPI.callNumber(gameId, userId);
        
        // Refresh game to get updated numbers
        await fetchGame();
      } catch (err) {
        console.error('Error calling number:', err);
        // If game is finished, stop calling numbers
        if ((err as ApiError).response?.data?.error?.includes('finished') || 
            (err as ApiError).response?.data?.error?.includes('not active')) {
          clearInterval(interval);
        }
      }
    }, 5000); // Call a number every 5 seconds

    setNumberCallInterval(interval);
  }, [game, gameId, isHost, fetchGame]);

  // NEW: Stop number calling
  const stopAutoNumberCalling = useCallback(() => {
    if (numberCallInterval) {
      clearInterval(numberCallInterval);
      setNumberCallInterval(null);
    }
  }, [numberCallInterval]);

  useEffect(() => {
    if (gameId) {
      fetchGame();
      
      // Set up polling for real-time updates
      const pollInterval = setInterval(fetchGame, 5000); // Poll every 5 seconds
      return () => {
        clearInterval(pollInterval);
        stopAutoNumberCalling();
      };
    }
  }, [gameId, fetchGame, stopAutoNumberCalling]);

  // NEW: Start/stop auto number calling based on game status and host role
  useEffect(() => {
    if (game?.status === 'ACTIVE' && isHost()) {
      startAutoNumberCalling();
    } else {
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
        // Refresh game to update status
        await fetchGame();
        return true; // Indicates win
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
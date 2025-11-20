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
      const userId = localStorage.getItem('user_id');
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

  useEffect(() => {
    if (gameId) {
      fetchGame();
      
      // Set up polling for real-time updates
      const interval = setInterval(fetchGame, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [gameId, fetchGame]);

  const markNumber = async (number: number): Promise<boolean> => {
    if (!bingoCard) {
      console.error('No bingo card available');
      return false;
    }
    
    try {
      const userId = localStorage.getItem('user_id');
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
  };
};
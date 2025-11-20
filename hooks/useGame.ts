// hooks/useGame.ts
import { useState, useEffect, useCallback } from 'react';
import { Game, BingoCard, GameState } from '../types';
import { gameAPI } from '../lib/api/game'; // Fixed import path

export const useGame = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [bingoCard, setBingoCard] = useState<BingoCard | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    calledNumbers: [],
    timeRemaining: 0,
    isPlaying: false, // Add the missing property
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchGame = useCallback(async () => {
    try {
      const response = await gameAPI.getGame(gameId);
      const gameData = response.data.game;
      
      setGame(gameData);
      
      // Find user's bingo card
      const userCard = gameData.bingoCards?.find(
        (card: BingoCard) => card.userId === localStorage.getItem('user_id')
      );
      if (userCard) setBingoCard(userCard);
      
      setGameState(prev => ({
        ...prev,
        calledNumbers: gameData.numbersCalled || [],
        isPlaying: gameData.status === 'ACTIVE', // Update isPlaying based on game status
      }));
    } catch (error) {
      console.error('Error fetching game:', error);
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (gameId) {
      fetchGame();
      
      // Set up polling for real-time updates
      const interval = setInterval(fetchGame, 3000);
      return () => clearInterval(interval);
    }
  }, [gameId, fetchGame]);

  const markNumber = async (number: number) => {
    if (!bingoCard) return false;
    
    try {
      const response = await gameAPI.markNumber(
        gameId,
        bingoCard.userId,
        number
      );
      setBingoCard(response.data.bingoCard);
      
      if (response.data.isWinner) {
        // Trigger win celebration
        return true;
      }
    } catch (error) {
      console.error('Error marking number:', error);
    }
    return false;
  };

  return {
    game,
    bingoCard,
    gameState,
    isLoading,
    markNumber,
    refreshGame: fetchGame,
  };
};
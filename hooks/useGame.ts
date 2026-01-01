// hooks/useGame.ts - UPDATED WITH WEB SOCKET
import { useState, useEffect, useCallback, useRef } from 'react';
import { gameAPI } from '../services/api';
import { useWebSocket } from './useWebSocket';

export const useGame = (gameId: string) => {
  const [game, setGame] = useState<any>(null);
  const [bingoCard, setBingoCard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [winnerInfo, setWinnerInfo] = useState<any>(null);
  
  // Get user ID from localStorage
  const userId = typeof window !== 'undefined' ? 
    localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id') : 
    null;

  // Use WebSocket for real-time updates
  const {
    isConnected,
    gameStatus: wsGameStatus,
    calledNumbers: wsCalledNumbers,
    currentNumber: wsCurrentNumber,
    recentCalledNumbers: wsRecentCalledNumbers,
    sendMessage,
    onMessage
  } = useWebSocket(gameId, userId || undefined);

  // Fetch initial game data
  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    
    try {
      setIsLoading(true);
      console.log('🎮 Fetching game data for:', gameId);
      
      const response = await gameAPI.getGame(gameId);
      
      if (response.data.success) {
        const gameData = response.data.game;
        setGame(gameData);
        console.log('✅ Game data loaded:', gameData.code, gameData.status);
        
        // If WebSocket is connected, update with real-time data
        if (isConnected && wsGameStatus) {
          const updatedGame = {
            ...gameData,
            status: wsGameStatus.status || gameData.status,
            numbersCalled: wsCalledNumbers || gameData.numbersCalled || [],
            currentNumber: wsCurrentNumber?.number || gameData.currentNumber
          };
          setGame(updatedGame);
        }
        
        setError('');
      } else {
        setError('Failed to load game');
      }
    } catch (error: any) {
      console.error('❌ Error fetching game:', error);
      setError(error.message || 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [gameId, isConnected, wsGameStatus, wsCalledNumbers, wsCurrentNumber]);

  // Fetch user's bingo card
  const fetchBingoCard = useCallback(async () => {
    if (!gameId || !userId) return;
    
    try {
      console.log('🃏 Fetching bingo card for user', userId);
      
      const response = await gameAPI.getUserBingoCard(gameId, userId);
      
      if (response.data.success) {
        setBingoCard(response.data.bingoCard);
        console.log('✅ Bingo card loaded');
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch bingo card:', error);
      // It's okay if the user doesn't have a card (spectator mode)
    }
  }, [gameId, userId]);

  // Fetch winner info
  const fetchWinnerInfo = useCallback(async () => {
    if (!gameId) return null;
    
    try {
      const response = await gameAPI.getWinnerInfo(gameId);
      
      if (response.data.success) {
        const winnerData = response.data.winnerInfo;
        setWinnerInfo(winnerData);
        return winnerData;
      }
    } catch (error) {
      console.error('Error fetching winner info:', error);
    }
    return null;
  }, [gameId]);

  // Listen for WebSocket game events
  useEffect(() => {
    if (!gameId || !isConnected) return;

    // Listen for game status updates
    const cleanupStatus = onMessage('GAME_STATUS_UPDATE', (data) => {
      console.log('📡 Game status update:', data.status);
      setGame((prev: any) => prev ? {
        ...prev,
        status: data.status,
        currentNumber: data.currentNumber,
        numbersCalled: data.calledNumbers || []
      } : prev);
    });

    // Listen for number called events
    const cleanupNumber = onMessage('NUMBER_CALLED', (data) => {
      console.log('🔢 Number called via WebSocket:', data.number);
      setGame((prev: { numbersCalled: any; }) => prev ? {
        ...prev,
        numbersCalled: [...(prev.numbersCalled || []), data.number],
        currentNumber: data.number
      } : prev);
    });

    // Listen for winner declared
    const cleanupWinner = onMessage('WINNER_DECLARED', (data) => {
      console.log('🏆 Winner declared via WebSocket:', data.winnerId);
      fetchWinnerInfo();
    });

    // Listen for game start
    const cleanupStart = onMessage('GAME_STARTED', (data) => {
      console.log('🚀 Game started via WebSocket:', data.gameCode);
      fetchGame(); // Refresh game data
    });

    return () => {
      cleanupStatus();
      cleanupNumber();
      cleanupWinner();
      cleanupStart();
    };
  }, [gameId, isConnected, onMessage, fetchGame, fetchWinnerInfo]);

  // Initial fetch
  useEffect(() => {
    if (gameId) {
      fetchGame();
      fetchBingoCard();
    }
  }, [gameId, fetchGame, fetchBingoCard]);

  // Get wallet balance (simplified)
  const walletBalance = 0; // You'll need to implement this based on your auth context

  return {
    game,
    bingoCard,
    isLoading,
    error,
    walletBalance,
    getWinnerInfo: fetchWinnerInfo,
    winnerInfo,
    refetchGame: fetchGame,
    refetchBingoCard: fetchBingoCard,
    wsConnected: isConnected,
    wsCurrentNumber,
    wsRecentCalledNumbers,
    wsCalledNumbers
  };
};
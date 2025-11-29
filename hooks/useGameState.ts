import { useState, useEffect } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';

export const useGameState = () => {
  const { user, refreshWalletBalance } = useAuth();
  const [activeGame, setActiveGame] = useState<any>(null);
  const [gameStatus, setGameStatus] = useState<'WAITING' | 'ACTIVE' | 'FINISHED' | 'RESTARTING'>('WAITING');
  const [restartCountdown, setRestartCountdown] = useState<number>(30);
  const [currentPlayers, setCurrentPlayers] = useState<number>(0);
  const [gameData, setGameData] = useState<any>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);

  const checkGameStatus = async () => {
    try {
      console.log('🎮 Checking game status...');
      
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      const activeGamesResponse = await gameAPI.getActiveGames();

      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        const game = activeGamesResponse.data.games[0];
        setGameStatus('ACTIVE');
        setCurrentPlayers(game.currentPlayers || 0);
        setGameData(game);
        setRestartCountdown(0);
        console.log('✅ Active game found:', game._id);
        
      } else if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        setGameStatus('WAITING');
        setCurrentPlayers(game.currentPlayers || 0);
        setGameData(game);
        setRestartCountdown(0);
        console.log('✅ Waiting game found:', game._id);
      } else {
        setGameStatus('FINISHED');
        setRestartCountdown(30);
        setCurrentPlayers(0);
        console.log('✅ No active games, status set to FINISHED');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error checking game status:', error);
      setGameStatus('FINISHED');
      setRestartCountdown(30);
      return false;
    }
  };

  // Handle restart countdown
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    if (gameStatus === 'FINISHED' && restartCountdown > 0) {
      countdownInterval = setInterval(() => {
        setRestartCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setGameStatus('RESTARTING');
            setTimeout(() => checkGameStatus(), 1000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [gameStatus, restartCountdown]);

  // Check game status periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      await checkGameStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const initializeGameState = async () => {
    try {
      setPageLoading(true);
      
      // Refresh wallet balance
      try {
        await refreshWalletBalance();
        console.log('✅ Wallet balance refreshed');
      } catch (balanceError) {
        console.warn('⚠️ Could not refresh wallet balance:', balanceError);
      }

      // Check game status
      await checkGameStatus();
      
      console.log('✅ Game state initialization complete');
      
    } catch (error) {
      console.error('❌ Game state initialization error:', error);
    } finally {
      setPageLoading(false);
    }
  };

  return {
    activeGame,
    gameStatus,
    restartCountdown,
    currentPlayers,
    gameData,
    calledNumbers,
    pageLoading,
    checkGameStatus,
    initializeGameState,
    setGameData,
    setGameStatus
  };
};
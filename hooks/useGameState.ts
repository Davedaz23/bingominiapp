/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';
import { Game } from '@/types';

export const useGameState = () => {
  const { user, refreshWalletBalance } = useAuth();
  const [activeGame, setActiveGame] = useState<any>(null);
  const [gameStatus, setGameStatus] = useState<'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'RESTARTING'>('WAITING_FOR_PLAYERS');
  const [restartCountdown, setRestartCountdown] = useState<number>(30);
  const [currentPlayers, setCurrentPlayers] = useState<number>(0);
  const [gameData, setGameData] = useState<Game | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [autoStartTimeRemaining, setAutoStartTimeRemaining] = useState<number>(0);
  const [hasAutoStartTimer, setHasAutoStartTimer] = useState<boolean>(false);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);

  // Main game status check
  const checkGameStatus = useCallback(async () => {
    try {
      console.log('🎮 Checking game status...');
      
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      const activeGamesResponse = await gameAPI.getActiveGames();

      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        const game: Game = activeGamesResponse.data.games[0];
        setGameStatus('ACTIVE');
        setCurrentPlayers(game.players?.length || 0);
        setGameData(game);
        setRestartCountdown(0);
        console.log('✅ Active game found:', game._id);
        
        // Reset auto-start timer for active games
        setHasAutoStartTimer(false);
        setAutoStartTimeRemaining(0);
        
      } else if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game: Game = waitingGamesResponse.data.games[0];
        setGameStatus('WAITING_FOR_PLAYERS');
        setCurrentPlayers(game.players?.length || 0);
        setGameData(game);
        setRestartCountdown(0);
        console.log('✅ Waiting game found:', game._id);
        
        // Check auto-start status for waiting games
        checkAutoStart(game._id);
        
      } else {
        setGameStatus('FINISHED');
        setRestartCountdown(30);
        setCurrentPlayers(0);
        setHasAutoStartTimer(false);
        setAutoStartTimeRemaining(0);
        console.log('✅ No active games, status set to FINISHED');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error checking game status:', error);
      setGameStatus('FINISHED');
      setRestartCountdown(30);
      setHasAutoStartTimer(false);
      setAutoStartTimeRemaining(0);
      return false;
    }
  }, []);

  // Auto-start check function
  const checkAutoStart = useCallback(async (gameId: string) => {
    try {
      console.log('🔍 Checking auto-start for game:', gameId);
      
      const response = await gameAPI.checkAutoStart(gameId);
      console.log('📦 Auto-start response:', response.data);
      
      if (response.data.success && response.data.autoStartInfo) {
        const { willAutoStart, timeRemaining, playersWithCards } = response.data.autoStartInfo;
        
        setHasAutoStartTimer(willAutoStart);
        setAutoStartTimeRemaining(timeRemaining);
        setPlayersWithCards(playersWithCards);
        
        console.log('📊 Auto-start status:', {
          willAutoStart,
          timeRemaining: `${Math.floor(timeRemaining / 1000)}s`,
          playersWithCards
        });
        
        // If auto-start is scheduled, start countdown
        if (willAutoStart && timeRemaining > 0) {
          console.log('⏰ Auto-start scheduled, starting countdown...');
        }
      } else if (response.data.success && response.data.gameStarted) {
        console.log('✅ Game already started');
        setHasAutoStartTimer(false);
        setAutoStartTimeRemaining(0);
        // Refresh game status since game is active
        setTimeout(() => checkGameStatus(), 1000);
      } else {
        console.log('⏳ Auto-start not scheduled yet');
        setHasAutoStartTimer(false);
        setAutoStartTimeRemaining(0);
      }
    } catch (error: any) {
      console.error('❌ Auto-start check failed:', error.message);
      setHasAutoStartTimer(false);
      setAutoStartTimeRemaining(0);
    }
  }, []);

  // Auto-start timer countdown
  useEffect(() => {
    if (hasAutoStartTimer && autoStartTimeRemaining > 0) {
      console.log('⏱️ Starting auto-start countdown:', autoStartTimeRemaining);
      
      const interval = setInterval(() => {
        setAutoStartTimeRemaining(prev => {
          const newTime = prev - 1000;
          
          if (newTime <= 0) {
            console.log('🎯 Auto-start countdown complete!');
            clearInterval(interval);
            setHasAutoStartTimer(false);
            // Game should start automatically - refresh status
            setTimeout(() => checkGameStatus(), 1000);
            return 0;
          }
          
          // Update every second
          if (newTime % 5000 === 0) {
            console.log(`⏱️ Auto-start in ${Math.floor(newTime / 1000)}s`);
          }
          
          return newTime;
        });
      }, 1000);

      return () => {
        console.log('🛑 Clearing auto-start interval');
        clearInterval(interval);
      };
    }
  }, [hasAutoStartTimer, autoStartTimeRemaining, checkGameStatus]);

  // Poll for auto-start updates when game is WAITING
  useEffect(() => {
    if (gameStatus === 'WAITING_FOR_PLAYERS' && gameData?._id && !hasAutoStartTimer) {
      console.log('🔄 Starting auto-start polling for waiting game');
      
      // Check auto-start every 5 seconds
      const interval = setInterval(() => {
        checkAutoStart(gameData._id);
      }, 5000);

      return () => {
        console.log('🛑 Stopping auto-start polling');
        clearInterval(interval);
      };
    }
  }, [gameStatus, gameData, hasAutoStartTimer, checkAutoStart]);

  // Initial auto-start check when game status changes to WAITING
  useEffect(() => {
    if (gameData?._id && gameStatus === 'WAITING_FOR_PLAYERS') {
      console.log('🔄 Initial auto-start check for waiting game');
      checkAutoStart(gameData._id);
    }
  }, [gameData, gameStatus, checkAutoStart]);

  // Handle restart countdown
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    if (gameStatus === 'FINISHED' && restartCountdown > 0) {
      console.log('🔄 Starting restart countdown:', restartCountdown);
      
      countdownInterval = setInterval(() => {
        setRestartCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setGameStatus('RESTARTING');
            console.log('🔄 Restarting game...');
            setTimeout(() => checkGameStatus(), 1000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval) {
        console.log('🛑 Clearing restart countdown');
        clearInterval(countdownInterval);
      }
    };
  }, [gameStatus, restartCountdown, checkGameStatus]);

  // Game status polling
  useEffect(() => {
    console.log('🔄 Starting game status polling');
    
    const interval = setInterval(async () => {
      await checkGameStatus();
    }, 10000); // Check every 10 seconds

    return () => {
      console.log('🛑 Stopping game status polling');
      clearInterval(interval);
    };
  }, [checkGameStatus]);

  // Manual trigger for testing
  const manualTriggerAutoStart = async () => {
    if (gameData?._id) {
      console.log('🔄 Manual auto-start trigger');
      await checkAutoStart(gameData._id);
    }
  };

  const initializeGameState = async () => {
    try {
      setPageLoading(true);
      console.log('🚀 Initializing game state...');
      
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
    autoStartTimeRemaining,
    hasAutoStartTimer,
    playersWithCards,
    checkGameStatus,
    initializeGameState,
    setGameData,
    setGameStatus,
    manualTriggerAutoStart,
    checkAutoStart // Export for external use
  };
};
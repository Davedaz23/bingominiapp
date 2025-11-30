import { useState, useEffect, useCallback } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';
import { Game } from '@/types';

export const useGameState = () => {
  const { user, refreshWalletBalance } = useAuth();
  const [activeGame, setActiveGame] = useState<any>(null);
  const [gameStatus, setGameStatus] = useState<'WAITING' | 'ACTIVE' | 'FINISHED' | 'RESTARTING'>('WAITING');
  const [restartCountdown, setRestartCountdown] = useState<number>(30);
  const [currentPlayers, setCurrentPlayers] = useState<number>(0);
  const [gameData, setGameData] = useState<Game | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [autoStartTimeRemaining, setAutoStartTimeRemaining] = useState<number>(0);
  const [hasAutoStartTimer, setHasAutoStartTimer] = useState<boolean>(false);
  const [lastAutoStartCheck, setLastAutoStartCheck] = useState<number>(0);

  // Enhanced checkGameStatus with auto-start detection
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
        setGameStatus('WAITING');
        setCurrentPlayers(game.players?.length || 0);
        setGameData(game);
        setRestartCountdown(0);
        console.log('✅ Waiting game found:', game._id);
        
        // Check if we should trigger auto-start - use players array length
        const playerCount = game.players?.length || 0;
        console.log('👥 Auto-start check:', { playerCount, gameId: game._id });
        
        if (playerCount >= 2) {
          // Trigger auto-start immediately when conditions are met
          console.log('🎯 Auto-start conditions met! Triggering auto-start...');
          await triggerAutoStart(game._id);
        } else {
          setHasAutoStartTimer(false);
          setAutoStartTimeRemaining(0);
        }
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

  // NEW: Function to trigger auto-start
  const triggerAutoStart = async (gameId: string) => {
    try {
      console.log('🚀 Triggering auto-start for game:', gameId);
      
      const response = await gameAPI.checkAutoStart(gameId);
      console.log('📦 Auto-start response:', response.data);
      
      if (response.data.success) {
        if (response.data.gameStarted) {
          console.log('✅ Game auto-started successfully!');
          // Game was started, refresh the status
          setTimeout(() => checkGameStatus(), 1000);
        } else {
          console.log('⏳ Auto-start initiated, waiting for game to start...');
          // Show countdown timer
          setHasAutoStartTimer(true);
          setAutoStartTimeRemaining(30000); // 30 seconds countdown
        }
      } else {
        console.log('❌ Auto-start failed:', response.data);
        setHasAutoStartTimer(false);
        setAutoStartTimeRemaining(0);
      }
    } catch (error: any) {
      console.error('❌ Auto-start trigger failed:', error.message);
      setHasAutoStartTimer(false);
      setAutoStartTimeRemaining(0);
    }
  };

  // NEW: Enhanced auto-start polling for waiting games
  const checkAutoStartConditions = useCallback(async () => {
    if (!gameData?._id || gameStatus !== 'WAITING') return;

    try {
      console.log('🔍 Checking auto-start conditions...', {
        gameId: gameData._id,
        currentPlayers,
        lastCheck: lastAutoStartCheck
      });

      // Get fresh game data to check current player count
      const gameResponse = await gameAPI.getGame(gameData._id);
      if (gameResponse.data.success) {
        const freshGame = gameResponse.data.game;
        const playerCount = freshGame.players?.length || 0;
        
        console.log('📊 Current game state:', {
          playerCount,
          required: 2,
          shouldTrigger: playerCount >= 2
        });

        if (playerCount >= 2 && Date.now() - lastAutoStartCheck > 5000) {
          setLastAutoStartCheck(Date.now());
          await triggerAutoStart(gameData._id);
        }
      }
    } catch (error) {
      console.error('❌ Auto-start conditions check failed:', error);
    }
  }, [gameData, gameStatus, currentPlayers, lastAutoStartCheck]);

  // Auto-start timer countdown
  useEffect(() => {
    if (hasAutoStartTimer && autoStartTimeRemaining > 0) {
      const interval = setInterval(() => {
        setAutoStartTimeRemaining(prev => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            setHasAutoStartTimer(false);
            // When timer ends, check if game started
            setTimeout(() => checkGameStatus(), 1000);
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [hasAutoStartTimer, autoStartTimeRemaining, checkGameStatus]);

  // Enhanced polling for auto-start conditions
  useEffect(() => {
    if (gameStatus === 'WAITING' && gameData?._id) {
      console.log('⏰ Starting auto-start condition polling');
      
      const interval = setInterval(() => {
        checkAutoStartConditions();
      }, 3000); // Check every 3 seconds

      return () => {
        console.log('🛑 Stopping auto-start condition polling');
        clearInterval(interval);
      };
    }
  }, [gameStatus, gameData, checkAutoStartConditions]);

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
  }, [gameStatus, restartCountdown, checkGameStatus]);

  // Enhanced game status polling
  useEffect(() => {
    const interval = setInterval(async () => {
      await checkGameStatus();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [checkGameStatus]);

  // NEW: Function to manually trigger auto-start (for testing)
  const manualTriggerAutoStart = async () => {
    if (gameData?._id) {
      console.log('🔄 Manual auto-start trigger');
      await triggerAutoStart(gameData._id);
    }
  };

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
    autoStartTimeRemaining,
    hasAutoStartTimer,
    checkGameStatus,
    initializeGameState,
    setGameData,
    setGameStatus,
    manualTriggerAutoStart // Add this for testing
  };
};
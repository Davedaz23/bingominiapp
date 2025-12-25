/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';
import { Game } from '@/types';

export const useGameState = () => {
  const { user, refreshWalletBalance } = useAuth();
  const [activeGame, setActiveGame] = useState<any>(null);
  const [gameStatus, setGameStatus] = useState<'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'RESTARTING' | 'COOLDOWN' | 'NO_WINNER' | 'CARD_SELECTION'>('WAITING_FOR_PLAYERS');
  const [restartCountdown, setRestartCountdown] = useState<number>(30);
  const [currentPlayers, setCurrentPlayers] = useState<number>(0);
  const [gameData, setGameData] = useState<Game | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [autoStartTimeRemaining, setAutoStartTimeRemaining] = useState<number>(0);
  const [hasAutoStartTimer, setHasAutoStartTimer] = useState<boolean>(false);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [restartCooldownRemaining, setRestartCooldownRemaining] = useState<number>(0);

  // Helper function to fetch and process game data
  const fetchGameData = useCallback(async (game: Game) => {
    // Set basic game data
    setGameData(game);
    setCurrentPlayers(game.currentPlayers || 0);
    
    // Update called numbers
    if (game.numbersCalled) {
      setCalledNumbers(game.numbersCalled);
    }
    
    // Update game status - FIX: Cast the status to the correct type
    const validStatus = game.status as 'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'RESTARTING' | 'COOLDOWN' | 'NO_WINNER' | 'CARD_SELECTION';
    setGameStatus(validStatus);
    
    // Check for cooldown timer
    if (game.status === 'COOLDOWN' && game.cooldownEndTime) {
      const now = new Date();
      const cooldownEnd = new Date(game.cooldownEndTime);
      const remaining = Math.max(0, cooldownEnd.getTime() - now.getTime());
      
      setHasRestartCooldown(true);
      setRestartCooldownRemaining(remaining);
      setRestartCountdown(Math.ceil(remaining / 1000));
      
      console.log(`⏳ Cooldown timer: ${Math.ceil(remaining/1000)}s remaining`);
    } else if (game.status === 'FINISHED') {
      // Check for finished game with cooldown
      if (game.cooldownEndTime) {
        const now = new Date();
        const cooldownEnd = new Date(game.cooldownEndTime);
        const remaining = Math.max(0, cooldownEnd.getTime() - now.getTime());
        
        setHasRestartCooldown(true);
        setRestartCooldownRemaining(remaining);
        setRestartCountdown(Math.ceil(remaining / 1000));
        
        console.log(`⏳ Next game starts in: ${Math.ceil(remaining/1000)}s`);
      } else {
        // Default to 30 seconds if no cooldown time is set
        setHasRestartCooldown(true);
        setRestartCooldownRemaining(30000);
        setRestartCountdown(30);
        console.log('⏳ Default 30s cooldown for next game');
      }
    } else {
      setHasRestartCooldown(false);
      setRestartCooldownRemaining(0);
    }
    
    // Check for auto-start timer
    if (game.hasAutoStartTimer && game.autoStartTimeRemaining) {
      setHasAutoStartTimer(true);
      setAutoStartTimeRemaining(game.autoStartTimeRemaining);
      console.log(`⏰ Auto-start timer: ${Math.ceil(game.autoStartTimeRemaining/1000)}s`);
    } else {
      setHasAutoStartTimer(false);
      setAutoStartTimeRemaining(0);
    }
    
    // Update players with cards count
    if (game.playersWithCards !== undefined) {
      setPlayersWithCards(game.playersWithCards);
    }
  }, []);

  // Main game status check
  const checkGameStatus = useCallback(async () => {
    try {
      console.log('🎮 Checking game status...');
      
      // Try to get active games first
      const activeGamesResponse = await gameAPI.getActiveGames();
      console.log("Active Game Data", activeGamesResponse);
      
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        const game: Game = activeGamesResponse.data.games[0];
        // FIX: Set game status correctly
        const status = game.status as 'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'RESTARTING' | 'COOLDOWN' | 'NO_WINNER' | 'CARD_SELECTION';
        setGameStatus(status);
        await fetchGameData(game);
        console.log('✅ Game found (active check):', game._id, 'status:', status);
        return true;
      }
      
      // If no active games, try waiting games
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game: Game = waitingGamesResponse.data.games[0];
        const status = game.status as 'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'RESTARTING' | 'COOLDOWN' | 'NO_WINNER' | 'CARD_SELECTION';
        setGameStatus(status);
        await fetchGameData(game);
        console.log('✅ Game found (waiting check):', game?._id, 'status:', status);
        
        // Check auto-start status
        if (game._id) {
          checkAutoStart(game._id);
        }
        return true;
      }
      
      // No games found at all
      console.log('🎮 No games found, creating default state');
      setGameStatus('FINISHED');
      setRestartCountdown(30);
      setCurrentPlayers(0);
      setHasAutoStartTimer(false);
      setAutoStartTimeRemaining(0);
      setHasRestartCooldown(true);
      setRestartCooldownRemaining(30000);
      setGameData(null);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error checking game status:', error);
      setGameStatus('FINISHED');
      setRestartCountdown(30);
      setHasAutoStartTimer(false);
      setAutoStartTimeRemaining(0);
      setHasRestartCooldown(true);
      setRestartCooldownRemaining(30000);
      return false;
    }
  }, [fetchGameData]);

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
  }, [checkGameStatus]);

  // Real-time countdown for restart cooldown
  useEffect(() => {
    if (!hasRestartCooldown || restartCooldownRemaining <= 0) return;
    
    const intervalId = setInterval(() => {
      setRestartCooldownRemaining(prev => {
        const newValue = prev - 1000;
        if (newValue <= 0) {
          clearInterval(intervalId);
          setHasRestartCooldown(false);
          setRestartCountdown(0);
          // Refresh game status when cooldown ends
          checkGameStatus();
          return 0;
        }
        // Update restartCountdown in seconds
        setRestartCountdown(Math.ceil(newValue / 1000));
        return newValue;
      });
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [hasRestartCooldown, restartCooldownRemaining, checkGameStatus]);

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
      }, 20000);

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

  // Function to get a game by ID (for manual refresh)
  const refreshGameById = async (gameId: string) => {
    try {
      console.log(`🔄 Refreshing game by ID: ${gameId}`);
      const response = await gameAPI.getGame(gameId);
      if (response.data.success && response.data.game) {
        const game: Game = response.data.game;
        const status = game.status as 'WAITING_FOR_PLAYERS' | 'ACTIVE' | 'FINISHED' | 'RESTARTING' | 'COOLDOWN' | 'NO_WINNER' | 'CARD_SELECTION';
        setGameStatus(status);
        await fetchGameData(game);
        return game;
      }
      return null;
    } catch (error) {
      console.error('❌ Error refreshing game:', error);
      return null;
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
    hasRestartCooldown,
    restartCooldownRemaining,
    checkGameStatus,
    initializeGameState,
    refreshGameById,
    setGameData,
    setGameStatus,
    checkAutoStart
  };
};
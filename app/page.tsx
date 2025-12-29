/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, Check, AlertCircle } from 'lucide-react';
import { CardSelectionGrid } from '../components/bingo/CardSelectionGrid';
import { UserInfoDisplay } from '../components/user/UserInfoDisplay';

// Constants for throttling - INCREASED INTERVALS
const PLAYER_CHECK_INTERVAL = 300000; // 5 minutes for player status
const MIN_REDIRECT_DELAY = 3000; // 3 seconds minimum before redirect
const REQUEST_TIMEOUT = 10000; // 10 seconds timeout for API calls

export default function Home() {
  const { 
    user, 
    isAuthenticated, 
    isLoading: authLoading, 
    userRole, 
    walletBalance,
  } = useAuth();

  const router = useRouter();
  
  // Game state - MINIMAL usage
  const {
    gameStatus,
    gameData,
    pageLoading,
    initializeGameState,
  } = useGameState();

  // Card selection
  const {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    handleCardSelect,
  } = useCardSelection(gameData, gameStatus);

  // Local states
  const [autoRedirected, setAutoRedirected] = useState<boolean>(false);
  const [hasCardInActiveGame, setHasCardInActiveGame] = useState<boolean>(false);
  const [playerCardNumber, setPlayerCardNumber] = useState<number | null>(null);
  const [playerGameStatus, setPlayerGameStatus] = useState<string | null>(null);
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [pendingSelection, setPendingSelection] = useState<number | null>(null);

  // Refs for tracking - prevent reloads
  const isCheckingPlayerStatusRef = useRef<boolean>(false);
  const lastPlayerCheckRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const redirectAttemptedRef = useRef<boolean>(false);
  const gameStatusRef = useRef<string>('');
  const hasCardRef = useRef<boolean>(false);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationQueue = useRef<(() => Promise<void>)[]>([]);
  const isProcessingQueue = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || initializationQueue.current.length === 0) return;
    
    isProcessingQueue.current = true;
    
    // Process one item at a time with delay
    while (initializationQueue.current.length > 0) {
      const task = initializationQueue.current.shift();
      if (task) {
        try {
          await task();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between tasks
        } catch (error) {
          console.error('Queue task failed:', error);
        }
      }
    }
    
    initializationQueue.current = [];
    isProcessingQueue.current = false;
  }, []);

  // Sync refs with state
  useEffect(() => {
    gameStatusRef.current = gameStatus;
    hasCardRef.current = hasCardInActiveGame;
  }, [gameStatus, hasCardInActiveGame]);

  // Wrap handleCardSelect to add pending state
  const handleCardSelectWithPending = useCallback(async (cardNumber: number) => {
    setPendingSelection(cardNumber);
    try {
      await handleCardSelect(cardNumber);
      // Refresh player status after successful card selection
      await checkPlayerCardInActiveGame(true);
    } catch (error) {
      console.error('Card selection failed:', error);
    } finally {
      setPendingSelection(null);
    }
  }, [handleCardSelect]);

  // Check player card status - WITH TIMEOUT PROTECTION
  const checkPlayerCardInActiveGame = useCallback(async (force = false) => {
    if (!user?.id || isCheckingPlayerStatusRef.current) return false;
    
    const now = Date.now();
    const timeSinceLastCheck = now - lastPlayerCheckRef.current;
    
    // Throttle checks - min 5 minutes between checks
    if (!force && timeSinceLastCheck < PLAYER_CHECK_INTERVAL) {
      console.log(`⏸️ Skipping player check - ${Math.floor(timeSinceLastCheck/1000)}s since last check`);
      return hasCardRef.current;
    }

    try {
      isCheckingPlayerStatusRef.current = true;
      lastPlayerCheckRef.current = now;
      setLastCheckTime(now);
      setCheckError(null);
      
      console.log('🔍 Checking player card status...');
      
      // Set a timeout for the request
      const timeoutPromise = new Promise((_, reject) => {
        requestTimeoutRef.current = setTimeout(() => {
          reject(new Error('Request timeout - server taking too long'));
        }, REQUEST_TIMEOUT);
      });

      // Single API call with minimal data - race against timeout
      const activeGamesPromise = gameAPI.getActiveGames();
      
      const response = await Promise.race([activeGamesPromise, timeoutPromise]) as any;
      
      if (response.data.success && response.data.games.length > 0) {
        const game = response.data.games[0];
        
        if (game.status === 'ACTIVE' || game.status === 'WAITING_FOR_PLAYERS' || game.status === 'CARD_SELECTION') {
          // Get participants with timeout protection
          try {
            const participantsPromise = gameAPI.getGameParticipants(game._id);
            const participantsResponse = await Promise.race([participantsPromise, timeoutPromise]) as any;
            
            if (participantsResponse.data.success) {
              const participants = participantsResponse.data.participants || [];
              const playerParticipant = participants.find((p: any) => p.userId === user.id);
              
              if (playerParticipant?.hasCard) {
                console.log(`✅ Player has card #${playerParticipant.cardNumber} in game status: ${game.status}`);
                setHasCardInActiveGame(true);
                setPlayerCardNumber(playerParticipant.cardNumber || 0);
                setPlayerGameStatus(game.status);
                return true;
              }
            }
          } catch (error) {
            console.warn('⚠️ Could not fetch participants:', error);
            // Continue without participants data
          }
        }
      }
      
      console.log('ℹ️ No active card found for player');
      setHasCardInActiveGame(false);
      setPlayerCardNumber(null);
      setPlayerGameStatus(null);
      return false;
      
    } catch (error: any) {
      console.error('❌ Error checking player card:', error.message);
      setCheckError(`Check failed: ${error.message}`);
      
      // Don't reset state on timeout - keep existing state
      if (!error.message.includes('timeout')) {
        setHasCardInActiveGame(false);
        setPlayerCardNumber(null);
        setPlayerGameStatus(null);
      }
      return hasCardRef.current;
    } finally {
      isCheckingPlayerStatusRef.current = false;
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
    }
  }, [user?.id]);

  // Check for active game and redirect - SIMPLIFIED
  useEffect(() => {
    if (authLoading || pageLoading || autoRedirected || redirectAttemptedRef.current) return;
    
    const shouldRedirect = gameStatusRef.current === 'ACTIVE' || 
                          (hasCardRef.current && playerGameStatus === 'ACTIVE');
    
    if (shouldRedirect) {
      redirectAttemptedRef.current = true;
      
      // Clear any existing timer
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      
      console.log(`⏳ Will redirect in ${MIN_REDIRECT_DELAY}ms...`);
      
      // Add delay to prevent rapid redirects
      redirectTimerRef.current = setTimeout(() => {
        setAutoRedirected(true);
        const gameId = gameData?._id || 'active';
        const query = hasCardRef.current ? '' : '?spectator=true';
        console.log(`🚀 Redirecting to game: ${gameId}${query}`);
        router.push(`/game/${gameId}${query}`);
      }, MIN_REDIRECT_DELAY);
    }
    
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [gameStatus, playerGameStatus, gameData, authLoading, pageLoading, autoRedirected, router]);

  // Initialize - ONE TIME ONLY with memory
  useEffect(() => {
    if (authLoading || isInitializedRef.current) return;

    const init = async () => {
      isInitializedRef.current = true;
      console.log('🔧 Initializing page (one-time) with queue...');
      
      // Add tasks to queue with delays
      initializationQueue.current.push(async () => {
        console.log('🎮 Task 1: Initializing game state...');
        await initializeGameState();
      });
      
      if (isAuthenticated && user) {
        initializationQueue.current.push(async () => {
          console.log('⏳ Waiting 3 seconds before checking player status...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        });
        
        initializationQueue.current.push(async () => {
          console.log('👤 Task 2: Checking player card status...');
          await checkPlayerCardInActiveGame(true);
        });
      }
      
      // Start processing queue
      setTimeout(() => processQueue(), 1000);
    };

    init();
  }, [authLoading, isAuthenticated, user, initializeGameState, checkPlayerCardInActiveGame, processQueue]);

  // Set up periodic checks - VERY INFREQUENT
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    console.log('⏰ Setting up INFREQUENT periodic checks (5min)...');
    
    // Player check every 5 minutes
    const playerCheckInterval = setInterval(() => {
      checkPlayerCardInActiveGame();
    }, PLAYER_CHECK_INTERVAL);

    return () => {
      clearInterval(playerCheckInterval);
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
      }
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [isAuthenticated, user, checkPlayerCardInActiveGame]);

  // Show redirect loading
  if ((hasCardInActiveGame && playerGameStatus === 'ACTIVE' && !autoRedirected) ||
      (gameStatus === 'ACTIVE' && !hasCardInActiveGame && !autoRedirected)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">
            {hasCardInActiveGame 
              ? `Redirecting to your game (Card #${playerCardNumber})...`
              : 'Game in progress. Redirecting to watch...'
            }
          </p>
          <p className="text-sm opacity-75 mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  // Show loading
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Simple status message
  const getStatusMessage = () => {
    if (hasCardInActiveGame) {
      return playerGameStatus === 'ACTIVE' 
        ? `You have card #${playerCardNumber} in active game`
        : `You have card #${playerCardNumber} - Waiting for game`;
    }
    
    if (gameStatus === 'ACTIVE') {
      return 'Game in progress';
    }
    
    if (gameStatus === 'WAITING_FOR_PLAYERS') {
      return 'Waiting for players';
    }
    
    if (gameStatus === 'CARD_SELECTION') {
      return 'Card selection phase - Select a card to play';
    }
    
    if (gameStatus === 'FINISHED') {
      return 'Game finished - Next game soon';
    }
    
    return 'Select your card to play';
  };

  // Get time since last check
  const getTimeSinceLastCheck = () => {
    if (lastCheckTime === 0) return 'Never';
    const seconds = Math.floor((Date.now() - lastCheckTime) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      {/* Navbar */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white font-bold text-xl">Bingo Game</h1>
            <p className="text-white/60 text-sm">
              {getStatusMessage()}
            </p>
          </div>
          
          <UserInfoDisplay 
            user={user} 
            userRole={userRole} 
          />
          
          {/* Debug info - remove in production */}
          <div className="hidden md:block text-xs opacity-50 text-white">
            <p>Last check: {getTimeSinceLastCheck()}</p>
            <p>Balance: {walletBalance} ብር</p>
          </div>
        </div>
      </div>

      {/* Check error notification */}
      {checkError && (
        <motion.div 
          className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-3 mb-4 border border-red-500/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-300" />
            <p className="text-red-300 text-sm">Check failed: {checkError}</p>
          </div>
        </motion.div>
      )}

      {/* Player status notification */}
      {hasCardInActiveGame && (
        <motion.div 
          className={`backdrop-blur-lg rounded-2xl p-4 mb-4 border ${
            playerGameStatus === 'ACTIVE' 
              ? 'bg-green-500/20 border-green-500/30' 
              : 'bg-yellow-500/20 border-yellow-500/30'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            {playerGameStatus === 'ACTIVE' ? (
              <Check className="w-5 h-5 text-green-300" />
            ) : (
              <Clock className="w-5 h-5 text-yellow-300" />
            )}
            <div className="flex-1">
              <p className={`font-bold text-sm ${
                playerGameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'
              }`}>
                {playerGameStatus === 'ACTIVE' 
                  ? 'Active Game - Redirecting...' 
                  : 'Waiting for game to start'}
              </p>
              <p className="text-xs opacity-75">
                Card #{playerCardNumber} • Last updated: {getTimeSinceLastCheck()}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Game active notification */}
      {gameStatus === 'ACTIVE' && !hasCardInActiveGame && (
        <motion.div 
          className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-3 mb-4 border border-blue-500/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center justify-between">
            <p className="text-blue-300 text-sm">Game in progress...</p>
            <p className="text-blue-200 text-xs">Redirecting to watch...</p>
          </div>
        </motion.div>
      )}

      {/* Balance warning */}
      {!hasCardInActiveGame && walletBalance < 10 && gameStatus !== 'ACTIVE' && (
        <motion.div 
          className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-red-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-300" />
            <div className="flex-1">
              <p className="text-red-300 font-bold text-sm">Insufficient Balance</p>
              <p className="text-red-200 text-xs">
                Need 10 ብር to play (Current: {walletBalance} ብር)
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Card selection grid - Only for non-active states */}
      {(gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION') && !hasCardInActiveGame && (
        <>
          <CardSelectionGrid
            availableCards={availableCards}
            takenCards={takenCards}
            selectedNumber={selectedNumber}
            walletBalance={walletBalance}
            gameStatus={gameStatus}
            onCardSelect={handleCardSelectWithPending}
            pendingSelection={pendingSelection}
            userId={user?.id}
          />
          
          {/* Selected card preview */}
          {selectedNumber && bingoCard && (
            <motion.div
              className="mb-6 mt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
                <h3 className="text-white font-bold text-sm mb-3 text-center">Card #{selectedNumber}</h3>
                
                <div className="grid grid-cols-5 gap-1">
                  {bingoCard.map((column, colIndex) => (
                    <div key={colIndex} className="space-y-1">
                      <div className="text-telegram-button font-bold text-center text-sm">
                        {['B', 'I', 'N', 'G', 'O'][colIndex]}
                      </div>
                      {column.map((number, rowIndex) => (
                        <div
                          key={`${colIndex}-${rowIndex}`}
                          className={`text-center py-2 rounded text-sm ${
                            number === 'FREE' 
                              ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white' 
                              : 'bg-white/20 text-white'
                          }`}
                        >
                          {number}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Game status info */}
      {gameStatus === 'FINISHED' && (
        <motion.div 
          className="bg-purple-500/20 backdrop-blur-lg rounded-2xl p-4 border border-purple-500/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center">
            <p className="text-purple-300 font-bold text-sm">Game Finished</p>
            <p className="text-purple-200 text-xs">Next game starting soon...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
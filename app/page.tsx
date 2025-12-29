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

// Constants for throttling
const BALANCE_CHECK_INTERVAL = 120000; // 2 minutes in milliseconds
const PLAYER_CHECK_INTERVAL = 180000; // 3 minutes for player status
const MIN_REDIRECT_DELAY = 5000; // 5 seconds minimum before redirect

export default function Home() {
  const { 
    user, 
    isAuthenticated, 
    isLoading: authLoading, 
    isAdmin, 
    isModerator, 
    userRole, 
    walletBalance,
    // refreshBalance // Add this to your AuthContext if not exists
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
  const [lastBalanceCheck, setLastBalanceCheck] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);

  // Refs for tracking - prevent reloads
  const isCheckingPlayerStatusRef = useRef<boolean>(false);
  const lastPlayerCheckRef = useRef<number>(0);
  const lastBalanceCheckRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const redirectAttemptedRef = useRef<boolean>(false);
  const gameStatusRef = useRef<string>('');
  const hasCardRef = useRef<boolean>(false);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const balanceCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs with state
  useEffect(() => {
    gameStatusRef.current = gameStatus;
    hasCardRef.current = hasCardInActiveGame;
  }, [gameStatus, hasCardInActiveGame]);


  // Check player card status - ULTRA OPTIMIZED with better throttling
  const checkPlayerCardInActiveGame = useCallback(async (force = false) => {
    if (!user?.id || isCheckingPlayerStatusRef.current) return false;
    
    const now = Date.now();
    const timeSinceLastCheck = now - lastPlayerCheckRef.current;
    
    // Throttle checks - min 3 minutes between checks
    if (!force && timeSinceLastCheck < PLAYER_CHECK_INTERVAL) {
      console.log(`Skipping player check - ${Math.floor(timeSinceLastCheck/1000)}s since last check`);
      return hasCardRef.current;
    }

    try {
      isCheckingPlayerStatusRef.current = true;
      lastPlayerCheckRef.current = now;
      
      console.log('Checking player card status...');
      
      // Single API call with minimal data
      const response = await gameAPI.getActiveGames();
      
      if (response.data.success && response.data.games.length > 0) {
        const game = response.data.games[0];
        
        if (game.status === 'ACTIVE' || game.status === 'WAITING_FOR_PLAYERS') {
          const participantsResponse = await gameAPI.getGameParticipants(game._id);
          
          if (participantsResponse.data.success) {
            const participants = participantsResponse.data.participants || [];
            const playerParticipant = participants.find((p: any) => p.userId === user.id);
            
            if (playerParticipant?.hasCard) {
              console.log(`Player has card #${playerParticipant.cardNumber} in game status: ${game.status}`);
              setHasCardInActiveGame(true);
              setPlayerCardNumber(playerParticipant.cardNumber || 0);
              setPlayerGameStatus(game.status);
              isCheckingPlayerStatusRef.current = false;
              return true;
            }
          }
        }
      }
      
      console.log('No active card found for player');
      setHasCardInActiveGame(false);
      setPlayerCardNumber(null);
      setPlayerGameStatus(null);
      return false;
      
    } catch (error) {
      console.error('Error checking player card:', error);
      return hasCardRef.current;
    } finally {
      isCheckingPlayerStatusRef.current = false;
    }
  }, [user?.id]);

  // Check for active game and redirect - WITH DELAY to prevent rapid redirects
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
      
      // Add delay to prevent rapid redirects
      redirectTimerRef.current = setTimeout(() => {
        setAutoRedirected(true);
        const gameId = gameData?._id || 'active';
        const query = hasCardRef.current ? '' : '?spectator=true';
        console.log(`Redirecting to game: ${gameId}${query}`);
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
      console.log('Initializing page (one-time)...');
      
      // Initialize game state once
      await initializeGameState();
      
      // Set cooldown from initial gameData
      if (gameData?.hasRestartCooldown) {
        setHasRestartCooldown(true);
      }
      
      // Check player status only if authenticated
      if (isAuthenticated && user) {
        // Wait 3 seconds before first check
        setTimeout(() => {
          checkPlayerCardInActiveGame(true);
        }, 3000);
        
       
      }
    };

    init();
  }, [authLoading, isAuthenticated, user, initializeGameState, checkPlayerCardInActiveGame, gameData]);

  // Set up periodic checks - INFREQUENT
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    console.log('Setting up periodic checks...');
    
    // Player check every 3 minutes
    const playerCheckInterval = setInterval(() => {
      checkPlayerCardInActiveGame();
    }, PLAYER_CHECK_INTERVAL);
    


    return () => {
      clearInterval(playerCheckInterval);
      // clearInterval(balanceCheckInterval);
      if (balanceCheckTimerRef.current) {
        clearTimeout(balanceCheckTimerRef.current);
      }
    };
  }, [isAuthenticated, user, checkPlayerCardInActiveGame]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      if (balanceCheckTimerRef.current) {
        clearTimeout(balanceCheckTimerRef.current);
      }
    };
  }, []);

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
    
    if (gameStatus === 'FINISHED') {
      return 'Game finished - Next game soon';
    }
    
    return 'Select your card to play';
  };

  // Get time since last balance check
  const getTimeSinceLastBalanceCheck = () => {
    if (lastBalanceCheck === 0) return 'Never';
    const seconds = Math.floor((Date.now() - lastBalanceCheck) / 1000);
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
          
       
          
          {/* Debug info - remove in production */}
          <div className="hidden md:block text-xs opacity-50 text-white">
            <p>Balance checked: {getTimeSinceLastBalanceCheck()}</p>
            <p>Player checked: {lastPlayerCheckRef.current ? 
              `${Math.floor((Date.now() - lastPlayerCheckRef.current) / 1000)}s ago` : 
              'Never'}
            </p>
          </div>
        </div>
      </div>

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
                Card #{playerCardNumber} • Next check in {Math.floor((PLAYER_CHECK_INTERVAL - (Date.now() - lastPlayerCheckRef.current)) / 1000)}s
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
                Need 10 ብር to play (Current: {walletBalance} ብር) • 
                Last updated: {getTimeSinceLastBalanceCheck()}
              </p>
           
            </div>
          </div>
        </motion.div>
      )}

      {/* Card selection grid - Only for non-active states */}
      {gameStatus !== 'ACTIVE' && (!hasCardInActiveGame || playerGameStatus !== 'ACTIVE') && (
        <>
          <CardSelectionGrid
            availableCards={availableCards}
            takenCards={takenCards}
            selectedNumber={selectedNumber}
            walletBalance={walletBalance}
            gameStatus={gameStatus}
            onCardSelect={handleCardSelect}
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

      {/* Simple footer with minimal info */}
      {gameStatus !== 'ACTIVE' && (
        <motion.div 
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center">
            <p className="text-white font-bold mb-2">How to Play</p>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <p className="text-white text-sm">1. Select Card</p>
                <p className="text-white/60 text-xs">Pick a number 1-75</p>
              </div>
              <div>
                <p className="text-white text-sm">2. Wait for Game</p>
                <p className="text-white/60 text-xs">Minimum 2 players</p>
              </div>
              <div>
                <p className="text-white text-sm">3. Play Bingo</p>
                <p className="text-white/60 text-xs">Match numbers to win</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-6 mt-3">
              <div className="text-center">
                <p className="text-white font-bold">10 ብር</p>
                <p className="text-white/60 text-xs">Entry Fee</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold">
                  {hasRestartCooldown ? '60s' : 'Auto'}
                </p>
                <p className="text-white/60 text-xs">
                  {hasRestartCooldown ? 'Cooldown' : 'Start'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold">
                  {balanceLoading ? '...' : '2m'}
                </p>
                <p className="text-white/60 text-xs">
                  Balance Refresh
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
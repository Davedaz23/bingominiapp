/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { CardSelectionGrid } from '../components/bingo/CardSelectionGrid';
import { UserInfoDisplay } from '../components/user/UserInfoDisplay';
import { AdminControls } from '../components/admin/AdminControls';
import { ModeratorControls } from '../components/admin/ModeratorControls';
import { GameStatusDisplay } from '../components/game/GameStatusDisplay';

export default function Home() {
  const { 
    user, 
    isAuthenticated, 
    isLoading: authLoading, 
    isAdmin, 
    isModerator, 
    userRole, 
    walletBalance
  } = useAuth();

  const router = useRouter();
  
  // Game state
  const {
    gameStatus,
    restartCountdown,
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
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);
  const [hasCardInActiveGame, setHasCardInActiveGame] = useState<boolean>(false);
  const [playerCardNumber, setPlayerCardNumber] = useState<number | null>(null);
  const [playerGameStatus, setPlayerGameStatus] = useState<string | null>(null);
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [restartCooldownRemaining, setRestartCooldownRemaining] = useState<number>(0);

  // Refs for tracking
  const isCheckingPlayerStatusRef = useRef<boolean>(false);
  const lastPlayerCheckRef = useRef<number>(0);
  const playerCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check player card status - HEAVILY OPTIMIZED
  const checkPlayerCardInActiveGame = useCallback(async (force = false) => {
    if (!user?.id || isCheckingPlayerStatusRef.current) return false;
    
    // Throttle checks - min 30 seconds between checks
    const now = Date.now();
    if (!force && now - lastPlayerCheckRef.current < 30000) {
      return hasCardInActiveGame;
    }

    try {
      isCheckingPlayerStatusRef.current = true;
      lastPlayerCheckRef.current = now;
      
      console.log('🔄 Checking player card status...');
      
      // Single API call approach
      const response = await gameAPI.getActiveGames();
      
      if (response.data.success && response.data.games.length > 0) {
        const game = response.data.games[0];
        
        if (game.status === 'ACTIVE' || game.status === 'WAITING_FOR_PLAYERS') {
          const participantsResponse = await gameAPI.getGameParticipants(game._id);
          
          if (participantsResponse.data.success) {
            const participants = participantsResponse.data.participants || [];
            const playerParticipant = participants.find((p: any) => p.userId === user.id);
            
            if (playerParticipant?.hasCard) {
              console.log(`✅ Player has card #${playerParticipant.cardNumber}`);
              setHasCardInActiveGame(true);
              setPlayerCardNumber(playerParticipant.cardNumber||0);
              setPlayerGameStatus(game.status);
              isCheckingPlayerStatusRef.current = false;
              return true;
            }
          }
        }
      }
      
      // No card found
      setHasCardInActiveGame(false);
      setPlayerCardNumber(null);
      setPlayerGameStatus(null);
      return false;
      
    } catch (error) {
      console.error('❌ Error checking player card:', error);
      // Don't change state on error
      return hasCardInActiveGame;
    } finally {
      isCheckingPlayerStatusRef.current = false;
    }
  }, [user?.id, hasCardInActiveGame]);

  // Check for active game and redirect - SIMPLIFIED
  useEffect(() => {
    if (authLoading || pageLoading || autoRedirected) return;
    
    const shouldRedirect = gameStatus === 'ACTIVE' || 
                          (hasCardInActiveGame && playerGameStatus === 'ACTIVE');
    
    if (shouldRedirect) {
      console.log('🚨 Redirecting to game...');
      setAutoRedirected(true);
      
      // Use gameData ID if available, otherwise use a placeholder
      const gameId = gameData?._id || 'active';
      const query = hasCardInActiveGame ? '' : '?spectator=true';
      
      router.push(`/game/${gameId}${query}`);
    }
  }, [gameStatus, hasCardInActiveGame, playerGameStatus, gameData, authLoading, pageLoading, autoRedirected, router]);

  // Initialize - ONE TIME ONLY
  useEffect(() => {
    if (authLoading) return;

    const init = async () => {
      console.log('🚀 Initializing page...');
      await initializeGameState();
      
      if (isAuthenticated && user) {
        // Wait 5 seconds before checking player status to avoid immediate flooding
        playerCheckTimeoutRef.current = setTimeout(() => {
          checkPlayerCardInActiveGame(true);
        }, 5000);
      }
    };

    init();

    return () => {
      if (playerCheckTimeoutRef.current) {
        clearTimeout(playerCheckTimeoutRef.current);
      }
    };
  }, [authLoading, isAuthenticated, user, initializeGameState, checkPlayerCardInActiveGame]);

  // Periodic player check - VERY INFREQUENT
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Check every 2 minutes
    const interval = setInterval(() => {
      checkPlayerCardInActiveGame();
    }, 120000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user, checkPlayerCardInActiveGame]);

  // Update cooldown from gameData
  useEffect(() => {
    if (gameData) {
      const cooldown = gameData.hasRestartCooldown || false;
      const cooldownRemaining = gameData.restartCooldownRemaining || 0;
      
      setHasRestartCooldown(cooldown);
      setRestartCooldownRemaining(cooldownRemaining);
    }
  }, [gameData]);

  // Get players with cards from gameData
  useEffect(() => {
    if (gameData?.playersWithCards !== undefined) {
      setPlayersWithCards(gameData.playersWithCards);
    }
  }, [gameData]);

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
              : 'Game in progress. Redirecting...'
            }
          </p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      {/* Navbar */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white font-bold text-xl">Bingo Game</h1>
            <p className="text-white/60 text-sm">
              {hasCardInActiveGame 
                ? `Card #${playerCardNumber} - ${playerGameStatus === 'ACTIVE' ? 'Active' : 'Waiting'}`
                : 'Select your card number'
              }
            </p>
          </div>
          
          <UserInfoDisplay user={user} userRole={userRole} />
        </div>
      </div>

      {/* Admin/Moderator Controls */}
      {/* {isAdmin && <AdminControls />}
      {isModerator && !isAdmin && <ModeratorControls />} */}

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
                  ? 'You are in an active game!' 
                  : 'Waiting for game to start'}
              </p>
              <p className="text-xs opacity-75">
                Card #{playerCardNumber} • {playerGameStatus}
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
            <p className="text-blue-200 text-xs">Redirecting...</p>
          </div>
        </motion.div>
      )}

      {/* Balance warning */}
      {!hasCardInActiveGame && walletBalance < 10 && (
        <motion.div 
          className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-red-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-300" />
            <div className="flex-1">
              <p className="text-red-300 font-bold text-sm">Insufficient Balance</p>
              <p className="text-red-200 text-xs">Need 10 ብር to play</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Game status display */}
      {/* {!hasCardInActiveGame && gameStatus !== 'ACTIVE' && (
        <GameStatusDisplay 
          gameStatus={gameStatus}
          currentPlayers={playersWithCards}
          restartCountdown={restartCountdown}
          selectedNumber={selectedNumber}
          walletBalance={walletBalance}
        />
      )} */}

      {/* Card selection grid - Only for non-active states */}
      {gameStatus !== 'ACTIVE' && (!hasCardInActiveGame || playerGameStatus !== 'ACTIVE') && (
        <CardSelectionGrid
          availableCards={availableCards}
          takenCards={takenCards}
          selectedNumber={selectedNumber}
          walletBalance={walletBalance}
          gameStatus={gameStatus}
          onCardSelect={handleCardSelect}
        />
      )}

      {/* Selected card preview */}
      {!hasCardInActiveGame && selectedNumber && gameStatus !== 'ACTIVE' && bingoCard && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mt-4 border border-white/20">
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

      {/* Footer */}
      <motion.div 
        className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white font-bold">10 ብር</p>
              <p className="text-white/60 text-xs">Entry Fee</p>
            </div>
            <div>
              <p className="text-white font-bold">
                {hasRestartCooldown ? formatTime(restartCountdown) : 'Auto'}
              </p>
              <p className="text-white/60 text-xs">
                {hasRestartCooldown ? 'Next Game' : 'Auto Start'}
              </p>
            </div>
          </div>
          
          <p className="text-white/60 text-xs">
            Minimum 2 players required to start
          </p>
        </div>
      </motion.div>
    </div>
  );
}
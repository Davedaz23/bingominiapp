/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, Check, AlertCircle, Eye } from 'lucide-react';
import { CardSelectionGrid } from '../components/bingo/CardSelectionGrid';

// Constants for throttling
const PLAYER_CHECK_INTERVAL = 180000; // 3 minutes for player status

export default function Home() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    walletBalance,
  } = useAuth();

  const router = useRouter();
  const pathname = usePathname();

  // Game state
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
  const [hasCardInActiveGame, setHasCardInActiveGame] = useState<boolean>(false);
  const [playerCardNumber, setPlayerCardNumber] = useState<number | null>(null);
  const [playerGameStatus, setPlayerGameStatus] = useState<string | null>(null);
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [lastBalanceCheck, setLastBalanceCheck] = useState<number>(0);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [showActiveGameNotification, setShowActiveGameNotification] = useState<boolean>(false);

  // Refs for tracking
  const isCheckingPlayerStatusRef = useRef<boolean>(false);
  const lastPlayerCheckRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const redirectAttemptedRef = useRef<boolean>(false);
  const gameStatusRef = useRef<string>('');
  const hasCardRef = useRef<boolean>(false);
  const activeGameNotificationShownRef = useRef<boolean>(false);

  // Sync refs with state
  useEffect(() => {
    gameStatusRef.current = gameStatus;
    hasCardRef.current = hasCardInActiveGame;
  }, [gameStatus, hasCardInActiveGame]);

  // Check player card status
  const checkPlayerCardInActiveGame = useCallback(async (force = false) => {
    if (!user?.id || isCheckingPlayerStatusRef.current) return false;

    const now = Date.now();
    const timeSinceLastCheck = now - lastPlayerCheckRef.current;

    // Throttle checks
    if (!force && timeSinceLastCheck < PLAYER_CHECK_INTERVAL) {
      return hasCardRef.current;
    }

    try {
      isCheckingPlayerStatusRef.current = true;
      lastPlayerCheckRef.current = now;

      const response = await gameAPI.getActiveGames();

      if (response.data.success && response.data.games.length > 0) {
        const game = response.data.games[0];

        if (game.status === 'ACTIVE' || game.status === 'WAITING_FOR_PLAYERS') {
          const participantsResponse = await gameAPI.getGameParticipants(game._id);

          if (participantsResponse.data.success) {
            const participants = participantsResponse.data.participants || [];
            const playerParticipant = participants.find((p: any) => p.userId === user.id);

            if (playerParticipant?.hasCard) {
              setHasCardInActiveGame(true);
              setPlayerCardNumber(playerParticipant.cardNumber || 0);
              setPlayerGameStatus(game.status);
              isCheckingPlayerStatusRef.current = false;
              return true;
            }
          }
        }
      }

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

  // Handle manual redirect to active game
  const handleRedirectToActiveGame = useCallback(() => {
    if (redirectAttemptedRef.current || isRedirecting) return;

    setIsRedirecting(true);
    redirectAttemptedRef.current = true;

    const gameId = gameData?._id || 'active';
    const query = hasCardRef.current ? '' : '?spectator=true';

    console.log(`Manual redirect to game: ${gameId}${query}`);

    // Small delay for better UX
    setTimeout(() => {
      router.push(`/game/${gameId}${query}`);
    }, 300);
  }, [gameData, router, isRedirecting]);

  // Check for active game and show notification instead of auto-redirect
  useEffect(() => {
    if (authLoading || pageLoading || redirectAttemptedRef.current) return;

    const hasActiveCard = hasCardRef.current && playerGameStatus === 'ACTIVE';
    const isGameActive = gameStatusRef.current === 'ACTIVE';

    // Only show notification for active game, don't auto-redirect
    if (isGameActive && !activeGameNotificationShownRef.current) {
      setShowActiveGameNotification(true);
      activeGameNotificationShownRef.current = true;
    }

    // Auto-redirect ONLY if user has a card in active game
    if (hasActiveCard && !redirectAttemptedRef.current) {
      handleRedirectToActiveGame();
    }
  }, [gameStatus, playerGameStatus, authLoading, pageLoading, handleRedirectToActiveGame]);

  // Initialize
  useEffect(() => {
    if (authLoading || isInitializedRef.current) return;

    const init = async () => {
      isInitializedRef.current = true;
      console.log('Initializing page...');

      await initializeGameState();

      if (gameData?.hasRestartCooldown) {
        setHasRestartCooldown(true);
      }

      if (isAuthenticated && user) {
        // Small delay before checking player status
        setTimeout(() => {
          checkPlayerCardInActiveGame(true);
        }, 1500);
      }
    };

    init();
  }, [authLoading, isAuthenticated, user, initializeGameState, checkPlayerCardInActiveGame, gameData]);

  // Set up periodic checks
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const playerCheckInterval = setInterval(() => {
      if (!redirectAttemptedRef.current) {
        checkPlayerCardInActiveGame();
      }
    }, PLAYER_CHECK_INTERVAL);

    return () => {
      clearInterval(playerCheckInterval);
    };
  }, [isAuthenticated, user, checkPlayerCardInActiveGame]);

  // Show loading during auth or page loading
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

  // Show redirecting state
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">
            {hasCardInActiveGame
              ? `Redirecting to your game (Card #${playerCardNumber})...`
              : 'Redirecting to watch game...'
            }
          </p>
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

    if (gameStatus === 'WAITING_FOR_PLAYERS') {
      return 'Waiting for players';
    }

    if (gameStatus === 'FINISHED') {
      return 'Game finished - Next game soon';
    }

    return 'Select your card to play';
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
        </div>
      </div>

     

      {/* Player status notification */}
      {hasCardInActiveGame && (
        <motion.div
          className={`backdrop-blur-lg rounded-2xl p-4 mb-4 border ${playerGameStatus === 'ACTIVE'
              ? 'bg-green-500/20 border-green-500/30'
              : 'bg-yellow-500/20 border-yellow-500/30'
            }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {playerGameStatus === 'ACTIVE' ? (
                <Check className="w-5 h-5 text-green-300" />
              ) : (
                <Clock className="w-5 h-5 text-yellow-300" />
              )}
              <div>
                <p className={`font-bold text-sm ${playerGameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'
                  }`}>
                  {playerGameStatus === 'ACTIVE'
                    ? 'Active Game - Ready to Play!'
                    : 'Waiting for game to start'}
                </p>
                <p className="text-xs opacity-75">
                  Card #{playerCardNumber}
                </p>
              </div>
            </div>
            {playerGameStatus === 'ACTIVE' && (
              <button
                onClick={handleRedirectToActiveGame}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg text-xs hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                Join Game
              </button>
            )}
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

      {/* Card selection grid - Only when game is in selectable state */}
      {(gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION' || gameStatus === 'FINISHED') &&
        (!hasCardInActiveGame || playerGameStatus !== 'ACTIVE') && (
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
      
      {/* Display card exactly as shown in your expected format */}
      <div className="space-y-2">
        {['B', 'I', 'N', 'G', 'O'].map((letter, colIndex) => (
          <div key={letter} className="flex items-center">
            <div className="w-8 text-telegram-button font-bold text-sm">{letter}</div>
            <div className="flex-1 grid grid-cols-5 gap-1">
              {bingoCard[colIndex]?.map((number, rowIndex) => (
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
          </div>
        ))}
      </div>
    </div>
  </motion.div>
)}
          </>
        )}



    </div>
  );
}
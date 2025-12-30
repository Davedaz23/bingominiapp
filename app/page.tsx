/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, Check, AlertCircle, Eye, Loader2, X, Info } from 'lucide-react';
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

  // Card selection - We'll implement our own handleCardSelect
  const {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    // Remove handleCardSelect from hook import since we're implementing our own
  } = useCardSelection(gameData, gameStatus);

  // Local states
  const [hasCardInActiveGame, setHasCardInActiveGame] = useState<boolean>(false);
  const [playerCardNumber, setPlayerCardNumber] = useState<number | null>(null);
  const [playerGameStatus, setPlayerGameStatus] = useState<string | null>(null);
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [lastBalanceCheck, setLastBalanceCheck] = useState<number>(0);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [showActiveGameNotification, setShowActiveGameNotification] = useState<boolean>(false);
  
  // NEW: State for immediate UI feedback
  const [locallyTakenCards, setLocallyTakenCards] = useState<Set<number>>(new Set());
  const [processingCards, setProcessingCards] = useState<Set<number>>(new Set());
  const [selectionResult, setSelectionResult] = useState<{
    success: boolean;
    message: string;
    cardNumber?: number;
  } | null>(null);
  const [lastSelectedCard, setLastSelectedCard] = useState<number | null>(null);

  // Refs for tracking
  const isCheckingPlayerStatusRef = useRef<boolean>(false);
  const lastPlayerCheckRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const redirectAttemptedRef = useRef<boolean>(false);
  const gameStatusRef = useRef<string>('');
  const hasCardRef = useRef<boolean>(false);
  const activeGameNotificationShownRef = useRef<boolean>(false);
  const selectionResultTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameDataRef = useRef<any>(null);

  // Sync refs with state
  useEffect(() => {
    gameStatusRef.current = gameStatus;
    hasCardRef.current = hasCardInActiveGame;
    gameDataRef.current = gameData;
  }, [gameStatus, hasCardInActiveGame, gameData]);

  // NEW: Get combined taken cards (server + local)
  const getCombinedTakenCards = useCallback(() => {
    const serverTakenCards = [...takenCards];
    
    // Add locally taken cards that aren't already in server list
    locallyTakenCards.forEach(cardNumber => {
      if (!takenCards.some(card => card.cardNumber === cardNumber)) {
        serverTakenCards.push({
          cardNumber,
          userId: 'local', // Temporary marker
        });
      }
    });
    
    return serverTakenCards;
  }, [takenCards, locallyTakenCards]);

  // NEW: Check if a card is selectable
  const isCardSelectable = useCallback((cardNumber: number): boolean => {
    // Check if card is available
    const isAvailable = availableCards.some(card => card.cardIndex === cardNumber);
    
    // Check if card is taken (server or local)
    const isTaken = takenCards.some(card => card.cardNumber === cardNumber) || 
                    locallyTakenCards.has(cardNumber);
    
    // Check if card is currently processing
    const isProcessing = processingCards.has(cardNumber);
    
    // Check if user has enough balance
    const hasBalance = walletBalance >= 10;
    
    // Check game status - only allow selection in specific states
    const isGameSelectable = gameStatus === 'WAITING_FOR_PLAYERS' || 
                             gameStatus === 'CARD_SELECTION';
    
    return isAvailable && !isTaken && !isProcessing && hasBalance && isGameSelectable;
  }, [availableCards, takenCards, locallyTakenCards, processingCards, walletBalance, gameStatus]);

  // NEW: Handle card selection with immediate UI feedback
  const handleCardSelect = async (cardNumber: number): Promise<boolean> => {
    // Validate selection
    if (!isCardSelectable(cardNumber)) {
      console.warn(`Card ${cardNumber} is not selectable`);
      return false;
    }

    // Clear any previous result
    if (selectionResultTimeoutRef.current) {
      clearTimeout(selectionResultTimeoutRef.current);
      selectionResultTimeoutRef.current = null;
    }
    setSelectionResult(null);

    // IMMEDIATE UI UPDATE: Add to processing set
    setProcessingCards(prev => new Set(prev).add(cardNumber));
    setLastSelectedCard(cardNumber);

    try {
      // Get user ID
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) {
        throw new Error('User ID not found. Please log in.');
      }

      // Get game ID
      const gameId = gameData?._id;
      if (!gameId) {
        throw new Error('No active game found.');
      }

      // Find the selected card data
      const selectedCardData = availableCards.find(card => card.cardIndex === cardNumber);
      if (!selectedCardData) {
        throw new Error('Card data not found.');
      }

      console.log(`🎯 Selecting card ${cardNumber} for user ${userId} in game ${gameId}`);

      // Call the API to select the card with specific number
      const response = await gameAPI.selectCardWithNumber(gameId, {
        userId,
        cardNumbers: selectedCardData.numbers,
        cardNumber: cardNumber
      });

      if (response.data.success) {
        // SUCCESS: Mark as locally taken (permanent until server sync)
        setLocallyTakenCards(prev => {
          const newSet = new Set(prev);
          newSet.add(cardNumber);
          return newSet;
        });

        // Show success message
        setSelectionResult({
          success: true,
          message: `🎉 Card #${cardNumber} selected successfully!`,
          cardNumber
        });

        console.log(`✅ Card ${cardNumber} selected successfully`, response.data);

        // Auto-redirect after successful selection
        setTimeout(() => {
          if (gameStatus === 'ACTIVE' || gameStatus === 'WAITING_FOR_PLAYERS') {
            handleRedirectToActiveGame();
          }
        }, 2000);

        return true;
      } else {
        // API returned success: false
        throw new Error(response.data.message || 'Card selection failed');
      }

    } catch (error: any) {
      console.error('❌ Card selection failed:', error);
      
      // REVERT UI: Remove from locally taken cards
      setLocallyTakenCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardNumber);
        return newSet;
      });

      // Show error message
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to select card. Please try again.';
      
      setSelectionResult({
        success: false,
        message: errorMessage,
        cardNumber
      });

      return false;

    } finally {
      // Remove from processing after delay (for visual feedback)
      setTimeout(() => {
        setProcessingCards(prev => {
          const newSet = new Set(prev);
          newSet.delete(cardNumber);
          return newSet;
        });
      }, 1500);

      // Auto-clear result message after 5 seconds
      selectionResultTimeoutRef.current = setTimeout(() => {
        setSelectionResult(null);
      }, 5000);
    }
  };

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

  // Check for active game and auto-redirect IMMEDIATELY
  useEffect(() => {
    if (authLoading || pageLoading || redirectAttemptedRef.current) return;

    const hasActiveCard = hasCardRef.current && playerGameStatus === 'ACTIVE';
    const isGameActive = gameStatusRef.current === 'ACTIVE';

    // IMMEDIATE REDIRECT: If game is active, redirect immediately
    if (isGameActive && !redirectAttemptedRef.current) {
      console.log('Game is ACTIVE - Immediate redirect to game page');
      handleRedirectToActiveGame();
      return;
    }

    // Also redirect if user has a card in active game
    if (hasActiveCard && !redirectAttemptedRef.current) {
      console.log('User has card in active game - Immediate redirect');
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (selectionResultTimeoutRef.current) {
        clearTimeout(selectionResultTimeoutRef.current);
      }
    };
  }, []);

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

  // Show redirecting state - This will be shown briefly before redirect
  if (isRedirecting || gameStatus === 'ACTIVE') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">
            {hasCardInActiveGame
              ? `Redirecting to your game (Card #${playerCardNumber})...`
              : 'Game is active - Redirecting...'
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-bold text-sm">{walletBalance} ብር</p>
              <p className="text-white/60 text-xs">Balance</p>
            </div>
            {processingCards.size > 0 && (
              <div className="flex items-center gap-2 text-white/70 text-sm bg-white/10 px-3 py-1.5 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing {Array.from(processingCards).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selection result notification */}
      {selectionResult && (
        <motion.div
          className={`backdrop-blur-lg rounded-2xl p-4 mb-4 border ${
            selectionResult.success
              ? 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/30'
              : 'bg-gradient-to-r from-red-500/20 to-rose-600/20 border-red-500/30'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectionResult.success ? (
                <Check className="w-5 h-5 text-green-300" />
              ) : (
                <X className="w-5 h-5 text-red-300" />
              )}
              <div>
                <p className={`font-bold text-sm ${
                  selectionResult.success ? 'text-green-300' : 'text-red-300'
                }`}>
                  {selectionResult.success ? 'Success!' : 'Failed'}
                </p>
                <p className="text-xs opacity-75">
                  {selectionResult.message}
                </p>
              </div>
            </div>
            {selectionResult.success && selectionResult.cardNumber && (
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs">Card #{selectionResult.cardNumber}</span>
                <button
                  onClick={handleRedirectToActiveGame}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs hover:from-green-600 hover:to-emerald-700 transition-all"
                >
                  Go to Game
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Player status notification */}
      {hasCardInActiveGame && (
        <motion.div
          className={`backdrop-blur-lg rounded-2xl p-4 mb-4 border ${
            playerGameStatus === 'ACTIVE'
              ? 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/30'
              : 'bg-gradient-to-r from-yellow-500/20 to-amber-600/20 border-yellow-500/30'
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
                <p className={`font-bold text-sm ${
                  playerGameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'
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
      {walletBalance < 10 && (gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION') && (
        <motion.div
          className="bg-gradient-to-r from-red-500/20 to-rose-600/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-red-500/30"
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

      {/* Game status info */}
      {(gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION') && (
        <motion.div
          className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-blue-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-300" />
              <div>
                <p className="text-blue-300 font-bold text-sm">
                  {gameStatus === 'CARD_SELECTION' ? 'Card Selection Phase' : 'Waiting for Players'}
                </p>
                <p className="text-blue-200 text-xs">
                  {gameStatus === 'CARD_SELECTION' 
                    ? 'Select your card before the game starts'
                    : 'Game will start when enough players join'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white text-sm font-bold">{availableCards.length} available</p>
              <p className="text-white/60 text-xs">cards remaining</p>
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
              takenCards={getCombinedTakenCards()} // Use combined taken cards
              selectedNumber={selectedNumber}
              walletBalance={walletBalance}
              gameStatus={gameStatus}
              onCardSelect={handleCardSelect} // Pass our custom handler
            />

            {/* Processing overlay */}
            {processingCards.size > 0 && (
              <motion.div 
                className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="bg-gradient-to-br from-purple-800 to-blue-900 rounded-2xl p-6 text-center max-w-sm w-full border-2 border-purple-500/50">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                  <h3 className="text-white font-bold text-lg mb-2">Selecting Card...</h3>
                  <p className="text-white/80 text-sm mb-4">
                    Card #{Array.from(processingCards).join(', ')}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span>Updating UI immediately</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Sending to server</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                      <span>Confirming selection</span>
                    </div>
                  </div>
                  <p className="text-white/40 text-xs mt-4">
                    Please don't close the app
                  </p>
                </div>
              </motion.div>
            )}

            {/* Selected card preview */}
            {lastSelectedCard && bingoCard && (
              <motion.div
                className="mb-6 mt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="bg-gradient-to-br from-purple-500/20 to-blue-600/20 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold text-sm">Your Selected Card</h3>
                    <span className="text-telegram-button text-sm font-bold">
                      Card #{lastSelectedCard}
                    </span>
                  </div>
                  
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
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => selectionResult?.success && handleRedirectToActiveGame()}
                      className={`flex-1 text-center py-2 rounded-lg text-sm font-medium ${
                        selectionResult?.success
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                          : 'bg-white/10 text-white/50 cursor-not-allowed'
                      }`}
                      disabled={!selectionResult?.success}
                    >
                      {selectionResult?.success ? 'Go to Game' : 'Waiting for confirmation...'}
                    </button>
                    <button
                      onClick={() => setLastSelectedCard(null)}
                      className="px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm hover:bg-white/20 transition-all"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

      {/* Footer info */}
      {gameStatus === 'FINISHED' && (
        <motion.div
          className="bg-gradient-to-r from-gray-700/20 to-gray-900/20 backdrop-blur-lg rounded-2xl p-4 mt-6 border border-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center">
            <h3 className="text-white font-bold text-sm mb-2">Game Finished</h3>
            <p className="text-white/60 text-xs">
              The previous game has ended. A new game will start soon.
            </p>
            <p className="text-white/40 text-xs mt-2">
              Check back in a few minutes to select a card for the next game.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, Check, AlertCircle, Loader2, Info } from 'lucide-react';
import { CardSelectionGrid } from '../components/bingo/CardSelectionGrid';
import { useWebSocket } from '../hooks/useWebSocket'; // Import WebSocket hook

// Constants for throttling
const PLAYER_CHECK_INTERVAL = 5000; // 5 seconds for player status

export default function Home() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    walletBalance,
  } = useAuth();

  const router = useRouter();

  // Game state
  const {
    gameStatus,
    gameData,
    pageLoading,
    initializeGameState,
  } = useGameState();

  // WebSocket connection for real-time updates
  const {
    isConnected: wsConnected,
    takenCards: wsTakenCards,
    availableCards: wsAvailableCards,
    error: wsError,
    sendMessage,
    requestCardAvailability,
  } = useWebSocket(
    gameData?._id,
    user?.id,
    // Callback for card availability updates
    (data) => {
      console.log('🔔 Real-time card update received:', data);
      // Update UI state with real-time data
      setRealtimeTakenCards(data.takenCards || []);
      setRealtimeAvailableCards(data.availableCards || []);
      
      // Show notification if cards were just taken
      if (data.totalTakenCards > 0) {
        showCardTakenNotification(data.totalTakenCards);
      }
    }
  );

  // Card selection - Use the hook's handleCardSelect
  const {
    selectedNumber,
    bingoCard,
    availableCards: apiAvailableCards,
    takenCards: apiTakenCards,
    clearSelectedCard,
    handleCardSelect,
    cardSelectionError,
    shouldEnableCardSelection,
  } = useCardSelection(gameData, gameStatus);

  // Local states
  const [hasCardInActiveGame, setHasCardInActiveGame] = useState<boolean>(false);
  const [playerCardNumber, setPlayerCardNumber] = useState<number | null>(null);
  const [playerGameStatus, setPlayerGameStatus] = useState<string | null>(null);
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  
  // State for immediate UI feedback
  const [locallyTakenCards, setLocallyTakenCards] = useState<Set<number>>(new Set());
  const [processingCards, setProcessingCards] = useState<Set<number>>(new Set());
  const [realtimeTakenCards, setRealtimeTakenCards] = useState<any[]>([]);
  const [realtimeAvailableCards, setRealtimeAvailableCards] = useState<number[]>([]);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<{id: string, message: string}[]>([]);

  // Refs for tracking
  const isCheckingPlayerStatusRef = useRef<boolean>(false);
  const lastPlayerCheckRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const redirectAttemptedRef = useRef<boolean>(false);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs with state
  useEffect(() => {
    // Update total players from gameData
    if (gameData?.currentPlayers) {
      setTotalPlayers(gameData.currentPlayers);
    }
  }, [gameData]);

  // Combine all sources of taken cards
const getCombinedTakenCards = useCallback(() => {
  // Start with WebSocket real-time cards (most up-to-date)
  const allTakenCards = [
    ...realtimeTakenCards, // WebSocket real-time updates
    ...apiTakenCards,      // API data as fallback
    ...Array.from(locallyTakenCards).map(cardNumber => ({
      cardNumber,
      userId: user?.id || 'local',
      timestamp: new Date().toISOString()
    }))
  ];
  
  // Create a map to remove duplicates, keeping the most recent
  const cardMap = new Map();
  
  allTakenCards.forEach(card => {
    if (!cardMap.has(card.cardNumber) || 
        new Date(card.timestamp || 0) > new Date(cardMap.get(card.cardNumber).timestamp || 0)) {
      cardMap.set(card.cardNumber, card);
    }
  });
  
  return Array.from(cardMap.values());
}, [realtimeTakenCards, apiTakenCards, locallyTakenCards, user?.id]);

  // Get combined available cards
  const getCombinedAvailableCards = useCallback(() => {
    // Start with all possible cards (1-400)
    const allCards = Array.from({ length: 400 }, (_, i) => i + 1);
    
    // Get taken card numbers
    const takenCards = getCombinedTakenCards();
    const takenCardNumbers = new Set(takenCards.map((card: { cardNumber: any; }) => card.cardNumber));
    
    // Filter out taken cards
    const available = allCards.filter(card => !takenCardNumbers.has(card));
    
    // If we have WebSocket available cards, prioritize them
    if (realtimeAvailableCards.length > 0) {
      // Intersect with realtime data
      const realtimeSet = new Set(realtimeAvailableCards);
      return available.filter(card => realtimeSet.has(card));
    }
    
    return available;
  }, [getCombinedTakenCards, realtimeAvailableCards]);

  // Calculate statistics
  const cardStats = useMemo(() => {
    const takenCards = getCombinedTakenCards();
    const availableCards = getCombinedAvailableCards();
    
    return {
      totalTaken: takenCards.length,
      totalAvailable: availableCards.length,
      totalInactive: 400 - (takenCards.length + availableCards.length),
      takenByOthers: takenCards.filter((card: { userId: string | undefined; }) => card.userId !== user?.id).length,
    };
  }, [getCombinedTakenCards, getCombinedAvailableCards, user?.id]);

  // Show notification for card taken events
  const showCardTakenNotification = useCallback((count: number) => {
    const id = Date.now().toString();
    const message = `${count} card${count > 1 ? 's were' : ' was'} just taken by other players`;
    
    setNotifications(prev => [...prev, { id, message }]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Check if game has minimum players (at least 2)
  const hasMinimumPlayers = useCallback(() => {
    return totalPlayers >= 2;
  }, [totalPlayers]);

  // Immediate redirect function
  const handleImmediateRedirect = useCallback(() => {
    if (redirectAttemptedRef.current || isRedirecting) return;

    const gameId = gameData?._id;
    if (!gameId) {
      console.warn('No game ID available for redirect');
      return;
    }

    console.log(`🚀 IMMEDIATE REDIRECT to game: ${gameId}`);
    redirectAttemptedRef.current = true;
    
    // IMMEDIATE redirect - no delay
    router.push(`/game/${gameId}`);
  }, [gameData, router, isRedirecting]);

  // Wrapper function for card selection with immediate UI feedback
  const handleCardSelectWithFeedback = useCallback(async (cardNumber: number): Promise<boolean> => {
    // Clear any previous timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }

    // Remove previous selected card
    if (selectedNumber && selectedNumber !== cardNumber) {
      if (clearSelectedCard) {
        clearSelectedCard();
      }
      setLocallyTakenCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedNumber);
        return newSet;
      });
    }

    // Immediate UI update
    setProcessingCards(prev => new Set(prev).add(cardNumber));

    try {
      const result = await handleCardSelect(cardNumber);
      const success = typeof result === 'boolean' ? result : true;
      
      if (success) {
        // Mark as locally taken
        setLocallyTakenCards(prev => {
          const newSet = new Set(prev);
          newSet.add(cardNumber);
          return newSet;
        });

        console.log(`✅ Card ${cardNumber} selected successfully`);
        
        // Request updated card availability via WebSocket
        if (wsConnected) {
          sendMessage({
            type: 'GET_CARD_AVAILABILITY',
            gameId: gameData?._id
          });
        }

        // If game is ACTIVE, redirect IMMEDIATELY
        if (gameStatus === 'ACTIVE') {
          console.log('Game is ACTIVE - Immediate redirect after card selection');
          handleImmediateRedirect();
        }

        return true;
      } else {
        return false;
      }

    } catch (error: any) {
      console.error('❌ Card selection failed:', error);
      
      // Revert UI
      setLocallyTakenCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardNumber);
        return newSet;
      });

      return false;
    } finally {
      // Remove from processing after delay
      processingTimeoutRef.current = setTimeout(() => {
        setProcessingCards(prev => {
          const newSet = new Set(prev);
          newSet.delete(cardNumber);
          return newSet;
        });
      }, 1500);
    }
  }, [
    handleCardSelect, 
    gameStatus, 
    selectedNumber, 
    clearSelectedCard, 
    wsConnected, 
    sendMessage, 
    gameData, 
    handleImmediateRedirect
  ]);

  // Check player card status
  const checkPlayerCardInActiveGame = useCallback(async (force = false) => {
    if (!user?.id || isCheckingPlayerStatusRef.current) return false;

    const now = Date.now();
    const timeSinceLastCheck = now - lastPlayerCheckRef.current;

    if (!force && timeSinceLastCheck < PLAYER_CHECK_INTERVAL) {
      return hasCardInActiveGame;
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
              
              // If game is ACTIVE, redirect IMMEDIATELY
              if (game.status === 'ACTIVE' && !redirectAttemptedRef.current) {
                console.log('Player has card in ACTIVE game - Immediate redirect');
                handleImmediateRedirect();
              }
              
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
      return hasCardInActiveGame;
    } finally {
      isCheckingPlayerStatusRef.current = false;
    }
  }, [user?.id, hasCardInActiveGame, handleImmediateRedirect]);

  // Handle manual redirect
  const handleManualRedirect = useCallback(() => {
    handleImmediateRedirect();
  }, [handleImmediateRedirect]);

  // Auto-redirect when game is ACTIVE
  useEffect(() => {
    if (authLoading || pageLoading || redirectAttemptedRef.current) return;
    
    // If game is ACTIVE, redirect immediately
    if (gameStatus === 'ACTIVE') {
      console.log('🚀 Game is ACTIVE - Immediate auto-redirect');
      handleImmediateRedirect();
      return;
    }
  }, [gameStatus, authLoading, pageLoading, handleImmediateRedirect]);

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
        setTimeout(() => {
          checkPlayerCardInActiveGame(true);
        }, 1000);
      }
    };

    init();
  }, [authLoading, isAuthenticated, user, initializeGameState, checkPlayerCardInActiveGame, gameData]);

  // Set up periodic checks
  useEffect(() => {
    if (!isAuthenticated || !user || redirectAttemptedRef.current) return;

    const playerCheckInterval = setInterval(() => {
      checkPlayerCardInActiveGame();
    }, PLAYER_CHECK_INTERVAL);

    return () => {
      clearInterval(playerCheckInterval);
    };
  }, [isAuthenticated, user, checkPlayerCardInActiveGame]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

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

  // Check if game is ACTIVE - redirect immediately
  if (gameStatus === 'ACTIVE' && !redirectAttemptedRef.current) {
    console.log('Game is active - immediate redirect');
    handleImmediateRedirect();
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Game is active - Redirecting...</p>
        </div>
      </div>
    );
  }

  // Get status message
  const getStatusMessage = () => {
    if (hasCardInActiveGame) {
      return `You have card #${playerCardNumber}`;
    }

    if (gameStatus === 'WAITING_FOR_PLAYERS') {
      return `Waiting for players (${totalPlayers}/2)`;
    }

    if (gameStatus === 'FINISHED') {
      return 'Game finished - Next game soon';
    }

    if (gameStatus === 'CARD_SELECTION') {
      return 'Select your card to play';
    }

    if (gameStatus === 'ACTIVE') {
      return 'Game is active - Redirecting...';
    }

    return 'Loading game...';
  };

  // Show card selection logic
  const showCardSelection = (
    (gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION' || gameStatus === 'FINISHED') &&
    !hasCardInActiveGame
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      {/* WebSocket Connection Status */}
      {!wsConnected && showCardSelection && (
        <div className="fixed top-4 right-4 bg-yellow-500/20 backdrop-blur-lg rounded-lg p-2 border border-yellow-500/30 z-50">
          <div className="flex items-center gap-2 text-white text-xs">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span>Connecting to real-time updates...</span>
          </div>
        </div>
      )}

      {/* Real-time Notifications */}
      <div className="fixed top-20 right-4 space-y-2 z-50 max-w-xs">
        {notifications.map(notification => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="bg-gradient-to-r from-red-500/20 to-rose-600/20 backdrop-blur-lg rounded-xl p-3 border border-red-500/30"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <p className="text-white text-xs font-medium">{notification.message}</p>
            </div>
          </motion.div>
        ))}
      </div>

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
            {/* WebSocket status indicator */}
            <div className={`px-3 py-1 rounded-lg text-xs ${wsConnected ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
              {wsConnected ? '🟢 Live' : '🟡 Connecting...'}
            </div>
            
            <div className="text-right">
              <p className="text-white font-bold text-sm">{walletBalance} ብር</p>
              <p className="text-white/60 text-xs">Balance</p>
            </div>
            {processingCards.size > 0 && (
              <div className="flex items-center gap-2 text-white/70 text-sm bg-white/10 px-3 py-1.5 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Selecting {Array.from(processingCards).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time card stats */}
      {showCardSelection && wsConnected && (
        <motion.div
          className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-green-400 font-bold text-lg">{cardStats.totalAvailable}</div>
              <div className="text-white/60 text-xs">Available</div>
            </div>
            <div className="text-center">
              <div className="text-red-400 font-bold text-lg">{cardStats.totalTaken}</div>
              <div className="text-white/60 text-xs">Taken</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-400 font-bold text-lg">{cardStats.takenByOthers}</div>
              <div className="text-white/60 text-xs">Taken by Others</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-bold text-lg">{processingCards.size}</div>
              <div className="text-white/60 text-xs">Selecting Now</div>
            </div>
          </div>
          <div className="text-center mt-2">
            <div className="text-white/40 text-xs">
              Updates in real-time • {wsConnected ? 'Live' : 'Refreshing every 5s'}
            </div>
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
                onClick={handleManualRedirect}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg text-xs hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                Join Game Now
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
                    : hasMinimumPlayers()
                      ? `Ready to start (${totalPlayers}/2 players)`
                      : `Need ${2 - totalPlayers} more players to start`
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white text-sm font-bold">{cardStats.totalAvailable} available</p>
              <p className="text-white/60 text-xs">cards remaining</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Card selection grid */}
      {showCardSelection && (
        <>
          <CardSelectionGrid
  availableCards={getCombinedAvailableCards().map(cardNumber => ({
    cardIndex: cardNumber,
    numbers: [] // This should be populated with actual card data
  }))}
  takenCards={getCombinedTakenCards()}
  selectedNumber={selectedNumber}
  walletBalance={walletBalance}
  gameStatus={gameStatus}
  onCardSelect={handleCardSelectWithFeedback}
  processingCards={processingCards}
  locallyTakenCards={locallyTakenCards}
  wsConnected={wsConnected}
  currentUserId={user?.id} // ADD THIS LINE
/>

          {/* Selected card preview */}
          {selectedNumber && bingoCard && (
            <motion.div
              className="mb-6 mt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="bg-gradient-to-br from-purple-500/20 to-blue-600/20 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold text-sm">Your Selected Card</h3>
                  <span className="text-telegram-button text-sm font-bold">
                    Card #{selectedNumber}
                  </span>
                </div>
                
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
                
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => {
                      if (clearSelectedCard) {
                        clearSelectedCard();
                      }
                      if (selectedNumber) {
                        setLocallyTakenCards(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(selectedNumber);
                          return newSet;
                        });
                      }
                    }}
                    className="px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm hover:bg-white/20 transition-all"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Footer info */}
      {gameStatus === 'FINISHED' && !showCardSelection && (
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
//* eslint-disable @typescript-eslint/no-explicit-any */
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
import { useWebSocket } from '../hooks/useWebSocket';

// Constants for throttling
const PLAYER_CHECK_INTERVAL = 5000;
const REDIRECT_DEBOUNCE = 1000;

// Track if component has mounted on client
let didHydrate = false;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  
  // Only run client-side after hydration
  useEffect(() => {
    setMounted(true);
    didHydrate = true;
  }, []);

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
    setGameStatus: setGlobalGameStatus,
  } = useGameState();

  // WebSocket connection for real-time updates - only initialize after mount
  const {
    isConnected: wsConnected,
    takenCards: wsTakenCards,
    gameStatus: wsGameStatus,
    calledNumbers: wsCalledNumbers,
    currentNumber: wsCurrentNumber,
    recentCalledNumbers: wsRecentCalledNumbers,
    sendMessage,
    requestCardAvailability,
    onMessage: wsOnMessage,
  } = useWebSocket(
    mounted ? gameData?._id : undefined, // Only pass gameId after mount
    mounted ? user?.id : undefined // Only pass userId after mount
  );

  // Combined game status with WebSocket priority
  const [effectiveGameStatus, setEffectiveGameStatus] = useState<string>('LOADING');
  
  // Track the last valid game status to prevent flickering
  const lastValidStatusRef = useRef<string>('LOADING');

  // FIX: Add state to track actual redirect
  const [hasRedirected, setHasRedirected] = useState<boolean>(false);
  const [redirectError, setRedirectError] = useState<string>('');

  // Sync game status from WebSocket with debouncing - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    if (wsGameStatus?.status) {
      console.log('📡 WebSocket game status update:', wsGameStatus.status);
      
      // Update effective status immediately
      setEffectiveGameStatus(wsGameStatus.status);
      lastValidStatusRef.current = wsGameStatus.status;
      
      // Update global game state context
      if (setGlobalGameStatus) {
        setGlobalGameStatus(wsGameStatus.status);
      }
    }
  }, [wsGameStatus?.status, setGlobalGameStatus, mounted]);

  // Sync with API game status when WebSocket is not available - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    if (gameStatus && (!wsGameStatus?.status || wsGameStatus.status === 'LOADING')) {
      console.log('📊 Using API game status:', gameStatus);
      
      // Only update if different and not transitioning too frequently
      if (gameStatus !== effectiveGameStatus) {
        const now = Date.now();
        const lastUpdate = statusUpdateTimeRef.current;
        
        // Debounce status updates to prevent flickering
        if (now - lastUpdate > 1000) {
          setEffectiveGameStatus(gameStatus);
          lastValidStatusRef.current = gameStatus;
          statusUpdateTimeRef.current = now;
        }
      }
    }
  }, [gameStatus, wsGameStatus?.status, effectiveGameStatus, mounted]);

  // Listen for card released events - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    const cleanup = wsOnMessage('CARD_RELEASED', (data) => {
      console.log('🗑️ WebSocket: CARD_RELEASED event received:', data.cardNumber);
      
      if (gameData?._id === data.gameId) {
        // Remove from locally taken cards if it's not our card
        if (data.userId !== user?.id) {
          setLocallyTakenCards(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.cardNumber);
            return newSet;
          });
        }
      }
    });

    return cleanup;
  }, [wsOnMessage, gameData?._id, user?.id, mounted]);

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
    wsConnected: cardSelectionWsConnected,
  } = useCardSelection(
    mounted ? gameData : null, // Only pass gameData after mount
    mounted ? effectiveGameStatus : 'LOADING' // Only pass status after mount
  );

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
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusUpdateTimeRef = useRef<number>(Date.now());
  const lastCardSyncRef = useRef<number>(0);
  const cardSyncCooldownRef = useRef<boolean>(false);

  // CRITICAL: Listen for game started events - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    const cleanup = wsOnMessage('GAME_STARTED', (data) => {
      console.log('🚀 WebSocket: GAME_STARTED event received:', data);
      if (gameData?._id === data.gameId) {
        // Update status immediately
        setEffectiveGameStatus('ACTIVE');
        lastValidStatusRef.current = 'ACTIVE';
        
        // Force immediate redirect for ALL users
        console.log('🎮 Game just started - forcing redirect for all users');
        handleImmediateRedirect();
      }
    });

    return cleanup;
  }, [wsOnMessage, gameData?._id, mounted]);

  // CRITICAL: Listen for number called events (to show game is active) - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    const cleanup = wsOnMessage('NUMBER_CALLED', (data) => {
      console.log('🔢 WebSocket: NUMBER_CALLED event received:', data.number);
      
      // If we receive a number called event, the game is definitely active
      if (gameData?._id === data.gameId) {
        console.log('🎮 Number called - updating game status to ACTIVE');
        setEffectiveGameStatus('ACTIVE');
        lastValidStatusRef.current = 'ACTIVE';
        
        // Force immediate redirect
        handleImmediateRedirect();
      }
    });

    return cleanup;
  }, [wsOnMessage, gameData?._id, mounted]);

  // Listen for card selection started - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    const cleanup = wsOnMessage('CARD_SELECTION_STARTED', (data) => {
      console.log('🎲 WebSocket: CARD_SELECTION_STARTED event received:', data);
      if (gameData?._id === data.gameId) {
        // Update status immediately
        setEffectiveGameStatus('CARD_SELECTION');
        lastValidStatusRef.current = 'CARD_SELECTION';
      }
    });

    return cleanup;
  }, [wsOnMessage, gameData?._id, mounted]);

  // Listen for card availability updates - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    const cleanup = wsOnMessage('TAKEN_CARDS_UPDATE', (data) => {
      console.log('🔄 WebSocket: TAKEN_CARDS_UPDATE received:', data.takenCards?.length, 'cards');
      
      if (gameData?._id === data.gameId) {
        // Update taken cards immediately
        setRealtimeTakenCards(data.takenCards || []);
        
        // Store the timestamp
        lastCardSyncRef.current = Date.now();
      }
    });

    return cleanup;
  }, [wsOnMessage, gameData?._id, mounted]);

  // Listen for individual card selections - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    const cleanup = wsOnMessage('CARD_SELECTED', (data) => {
      console.log('🎯 WebSocket: CARD_SELECTED event received:', data.cardNumber);
      
      if (gameData?._id === data.gameId) {
        // Immediately update locally taken cards to reflect others' selections
        if (data.cardNumber && data.userId !== user?.id) {
          setLocallyTakenCards(prev => {
            const newSet = new Set(prev);
            newSet.add(data.cardNumber);
            return newSet;
          });
        }
      }
    });

    return cleanup;
  }, [wsOnMessage, gameData?._id, user?.id, mounted]);

  // Combine all sources of taken cards
  const getCombinedTakenCards = useCallback(() => {
    const allTakenCards = [
      ...realtimeTakenCards,
      ...(wsTakenCards || []),
      ...apiTakenCards,
      ...Array.from(locallyTakenCards).map(cardNumber => ({
        cardNumber,
        userId: user?.id || 'local',
        timestamp: new Date().toISOString()
      }))
    ];
    
    // Create a map to deduplicate by cardNumber, keeping the latest
    const cardMap = new Map();
    
    allTakenCards.forEach(card => {
      const existing = cardMap.get(card.cardNumber);
      const currentTimestamp = new Date(card.timestamp || 0).getTime();
      const existingTimestamp = existing ? new Date(existing.timestamp || 0).getTime() : 0;
      
      // Keep the latest entry
      if (!existing || currentTimestamp > existingTimestamp) {
        cardMap.set(card.cardNumber, card);
      }
    });
    
    return Array.from(cardMap.values());
  }, [realtimeTakenCards, wsTakenCards, apiTakenCards, locallyTakenCards, user?.id]);

  // Get combined available cards
  const getCombinedAvailableCards = useCallback(() => {
    const allCards = Array.from({ length: 400 }, (_, i) => i + 1);
    const takenCards = getCombinedTakenCards();
    const takenCardNumbers = new Set(takenCards.map((card: { cardNumber: any; }) => card.cardNumber));
    
    // Filter out taken cards
    const available = allCards.filter(card => !takenCardNumbers.has(card));
    
    // If we have realtime available cards from WebSocket, intersect with them
    if (realtimeAvailableCards.length > 0) {
      const realtimeSet = new Set(realtimeAvailableCards);
      return available.filter(card => realtimeSet.has(card));
    }
    
    return available;
  }, [getCombinedTakenCards, realtimeAvailableCards]);

  // Calculate statistics
  const cardStats = useMemo(() => {
    const takenCards = getCombinedTakenCards();
    const availableCards = getCombinedAvailableCards();
    
    // Count cards taken by others (not current user)
    const takenByOthers = takenCards.filter((card: { userId: string | undefined; }) => {
      if (!user?.id) return true;
      return card.userId !== user.id;
    }).length;
    
    // Count cards taken by current user
    const takenByUser = takenCards.filter((card: { userId: string | undefined; }) => {
      if (!user?.id) return false;
      return card.userId === user.id;
    }).length;
    
    return {
      totalTaken: takenCards.length,
      totalAvailable: availableCards.length,
      totalInactive: 400 - (takenCards.length + availableCards.length),
      takenByOthers,
      takenByUser,
    };
  }, [getCombinedTakenCards, getCombinedAvailableCards, user?.id]);

  // Check if game has minimum players
  const hasMinimumPlayers = useCallback(() => {
    return totalPlayers >= 2;
  }, [totalPlayers]);

  // FIXED: Immediate redirect function with proper error handling
  const handleImmediateRedirect = useCallback(() => {
    // Don't redirect if not mounted or already redirected
    if (!mounted || hasRedirected) {
      console.log('✅ Already redirected or not mounted, skipping');
      return;
    }

    const gameId = gameData?._id;
    if (!gameId) {
      console.warn('No game ID available for redirect');
      setRedirectError('No game ID found');
      return;
    }

    console.log(`🚀 FORCE REDIRECT to game: ${gameId}, status: ${effectiveGameStatus}`);
    
    // Set redirecting state
    setIsRedirecting(true);
    
    // Use a timeout to ensure redirect happens
    setTimeout(() => {
      try {
        console.log(`📍 Redirecting to /game/${gameId}`);
        router.replace(`/game/${gameId}`);
        setHasRedirected(true);
      } catch (error) {
        console.error('❌ Redirect failed:', error);
        setRedirectError('Redirect failed. Please try again.');
        setIsRedirecting(false);
      }
    }, REDIRECT_DEBOUNCE);
  }, [gameData, router, effectiveGameStatus, hasRedirected, mounted]);

  // Wrapper function for card selection with immediate UI feedback
  const handleCardSelectWithFeedback = useCallback(async (cardNumber: number): Promise<boolean> => {
    if (!mounted) return false;
    
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

        // CRITICAL: If game is ACTIVE, redirect IMMEDIATELY
        if (effectiveGameStatus === 'ACTIVE') {
          console.log('Game is ACTIVE - Immediate redirect after card selection');
          handleImmediateRedirect();
        }

        return true;
      } else {
        // Show error notification
        setNotifications(prev => [...prev, {
          id: Date.now().toString(),
          message: `Failed to select card ${cardNumber}. Please try again.`
        }]);
        
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== Date.now().toString()));
        }, 5000);
        
        return false;
      }

    } catch (error: any) {
      console.error('❌ Card selection failed:', error);
      
      setLocallyTakenCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardNumber);
        return newSet;
      });

      // Show error notification
      setNotifications(prev => [...prev, {
        id: Date.now().toString(),
        message: error.message || 'Failed to select card. Please try again.'
      }]);
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== Date.now().toString()));
      }, 5000);

      return false;
    } finally {
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
    effectiveGameStatus, 
    selectedNumber, 
    clearSelectedCard, 
    wsConnected, 
    sendMessage, 
    gameData, 
    handleImmediateRedirect,
    mounted
  ]);

  // Check player card status
  const checkPlayerCardInActiveGame = useCallback(async (force = false) => {
    if (!user?.id || isCheckingPlayerStatusRef.current || !mounted) return false;

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

        if (game.status === 'ACTIVE' || game.status === 'WAITING_FOR_PLAYERS' || game.status === 'CARD_SELECTION') {
          const participantsResponse = await gameAPI.getGameParticipants(game._id);

          if (participantsResponse.data.success) {
            const participants = participantsResponse.data.participants || [];
            const playerParticipant = participants.find((p: any) => p.userId === user.id);

            if (playerParticipant?.hasCard) {
              setHasCardInActiveGame(true);
              setPlayerCardNumber(playerParticipant.cardNumber || 0);
              setPlayerGameStatus(game.status);
              
              // CRITICAL: If game is ACTIVE, redirect IMMEDIATELY
              if (game.status === 'ACTIVE' && !hasRedirected) {
                console.log('Player has card in ACTIVE game - Force redirect');
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
  }, [user?.id, hasCardInActiveGame, handleImmediateRedirect, hasRedirected, mounted]);

  // FIXED: Auto-redirect when game is ACTIVE - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    // Don't redirect if already redirected or still loading
    if (authLoading || pageLoading || hasRedirected || isRedirecting) return;
    
    // Redirect if game is ACTIVE
    if (effectiveGameStatus === 'ACTIVE') {
      console.log('🚀 Game is ACTIVE - FORCING immediate redirect for everyone');
      handleImmediateRedirect();
    }
  }, [effectiveGameStatus, authLoading, pageLoading, handleImmediateRedirect, hasRedirected, isRedirecting, mounted]);

  // Update total players when game data changes
  useEffect(() => {
    if (gameData?.currentPlayers) {
      setTotalPlayers(gameData.currentPlayers);
    }
  }, [gameData?.currentPlayers]);

  // Initialize - only after mount
  useEffect(() => {
    if (!mounted || authLoading || isInitializedRef.current) return;

    const init = async () => {
      isInitializedRef.current = true;
      console.log('Initializing page...');

      await initializeGameState();

      if (gameData?.hasRestartCooldown) {
        setHasRestartCooldown(true);
      }

      // CRITICAL: Check if game is already ACTIVE on initialization
      if (gameData?.status === 'ACTIVE' && !hasRedirected) {
        console.log('Game is already ACTIVE on initialization - Force redirect');
        setTimeout(() => {
          handleImmediateRedirect();
        }, 500);
      }

      if (isAuthenticated && user) {
        setTimeout(() => {
          checkPlayerCardInActiveGame(true);
        }, 1000);
      }
    };

    init();
  }, [authLoading, isAuthenticated, user, initializeGameState, checkPlayerCardInActiveGame, gameData, handleImmediateRedirect, hasRedirected, mounted]);

  // Set up periodic checks - only after mount
  useEffect(() => {
    if (!mounted || !isAuthenticated || !user || hasRedirected) return;

    const playerCheckInterval = setInterval(() => {
      checkPlayerCardInActiveGame();
    }, PLAYER_CHECK_INTERVAL);

    return () => {
      clearInterval(playerCheckInterval);
    };
  }, [isAuthenticated, user, checkPlayerCardInActiveGame, hasRedirected, mounted]);

  // Request card availability when WebSocket connects - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    if (wsConnected && gameData?._id && !cardSyncCooldownRef.current) {
      cardSyncCooldownRef.current = true;
      
      sendMessage({
        type: 'GET_CARD_AVAILABILITY',
        gameId: gameData._id
      });
      
      // Reset cooldown after 2 seconds
      setTimeout(() => {
        cardSyncCooldownRef.current = false;
      }, 2000);
    }
  }, [wsConnected, gameData?._id, sendMessage, mounted]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // FIXED: Add timeout for redirect - only after mount
  useEffect(() => {
    if (!mounted) return;
    
    if (effectiveGameStatus === 'ACTIVE' && !hasRedirected && !isRedirecting) {
      const redirectTimeout = setTimeout(() => {
        console.log('🕒 Redirect timeout - forcing redirect');
        handleImmediateRedirect();
      }, 3000); // 3 second timeout

      return () => clearTimeout(redirectTimeout);
    }
  }, [effectiveGameStatus, hasRedirected, isRedirecting, handleImmediateRedirect, mounted]);

  // Get status message
  const getStatusMessage = () => {
    if (hasCardInActiveGame) {
      return `You have card #${playerCardNumber}`;
    }

    if (effectiveGameStatus === 'WAITING_FOR_PLAYERS') {
      return `Waiting for players (${totalPlayers}/2)`;
    }

    if (effectiveGameStatus === 'FINISHED') {
      return 'Game finished - Next game soon';
    }

    if (effectiveGameStatus === 'CARD_SELECTION') {
      const takenCount = cardStats.totalTaken;
      const needed = Math.max(0, 2 - totalPlayers);
      return `Select your card to play (${takenCount} taken, ${needed} more players needed)`;
    }

    if (effectiveGameStatus === 'NO_WINNER') {
      return 'No winner - Next game soon';
    }

    return 'Loading game...';
  };

  // CRITICAL: Show card selection ONLY when NOT ACTIVE
  const showCardSelection = mounted && (
    (effectiveGameStatus === 'WAITING_FOR_PLAYERS' || 
     effectiveGameStatus === 'CARD_SELECTION' || 
     effectiveGameStatus === 'FINISHED' ||
     effectiveGameStatus === 'NO_WINNER') &&
    !hasCardInActiveGame
  ) && shouldEnableCardSelection;

  // Show WebSocket connection status
  const getConnectionStatus = () => {
    if (!mounted) return { text: 'Loading...', color: 'bg-gray-500/20 text-gray-300' };
    
    if (!wsConnected) {
      return { text: 'Connecting...', color: 'bg-yellow-500/20 text-yellow-300' };
    }
    
    // Check if WebSocket has recent data
    const hasRecentData = wsGameStatus || (wsTakenCards && wsTakenCards.length > 0);
    
    if (hasRecentData) {
      return { text: 'Live Updates', color: 'bg-green-500/20 text-green-300' };
    } else {
      return { text: 'Connected', color: 'bg-blue-500/20 text-blue-300' };
    }
  };

  const connectionStatus = getConnectionStatus();

  // If we've redirected or game is active, don't render the normal page
  if (hasRedirected || (mounted && effectiveGameStatus === 'ACTIVE')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Redirecting to game...</p>
          {gameData?._id && (
            <button
              onClick={() => router.replace(`/game/${gameData._id}`)}
              className="mt-4 bg-white text-purple-600 px-6 py-2 rounded-lg font-medium hover:bg-purple-50 transition-all"
            >
              Click here if not redirected
            </button>
          )}
        </div>
      </div>
    );
  }

  // FIXED: Show loading or redirect - with manual fallback button
  if (!mounted || authLoading || pageLoading || isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">
            {!mounted 
              ? 'Loading...' 
              : effectiveGameStatus === 'ACTIVE' 
                ? 'Game is active - Redirecting to game...' 
                : isRedirecting 
                  ? 'Redirecting to game...' 
                  : 'Loading...'}
          </p>
          {mounted && effectiveGameStatus === 'ACTIVE' && (
            <div className="mt-4">
              <p className="text-white/60 text-sm mb-2">
                You will be redirected automatically
              </p>
              
              {/* Manual redirect button as fallback */}
              {gameData?._id && (
                <button
                  onClick={() => router.replace(`/game/${gameData._id}`)}
                  className="mt-4 bg-white text-purple-600 px-6 py-2 rounded-lg font-medium hover:bg-purple-50 transition-all"
                >
                  Click here if not redirected
                </button>
              )}
              
              {/* Show error if any */}
              {redirectError && (
                <p className="text-red-300 text-sm mt-2">{redirectError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
     
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
              {mounted && wsGameStatus?.status && wsGameStatus.status !== effectiveGameStatus && (
                <span className="ml-2 text-xs text-yellow-300">
                  (Live: {wsGameStatus.status})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* WebSocket status indicator */}
            {mounted && (
              <div className={`px-3 py-1 rounded-lg text-xs ${connectionStatus.color}`}>
                {wsConnected ? '🟢' : '🟡'} {connectionStatus.text}
              </div>
            )}
            
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

      {/* Game status info with WebSocket indicator - commented out as in original */}

      {/* Balance warning */}
      {mounted && walletBalance < 10 && (effectiveGameStatus === 'WAITING_FOR_PLAYERS' || effectiveGameStatus === 'CARD_SELECTION') && (
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

      {/* Card selection grid - ONLY show when NOT ACTIVE */}
      {showCardSelection && (
        <>
          <CardSelectionGrid
            availableCards={getCombinedAvailableCards().map(cardNumber => ({
              cardIndex: cardNumber,
              numbers: []
            }))}
            takenCards={getCombinedTakenCards()}
            selectedNumber={selectedNumber}
            walletBalance={walletBalance}
            gameStatus={effectiveGameStatus}
            onCardSelect={handleCardSelectWithFeedback}
            processingCards={processingCards}
            locallyTakenCards={locallyTakenCards}
            wsConnected={wsConnected}
            currentUserId={user?.id}
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
    </div>
  );
}
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx - UPDATED (Redirect for ACTIVE games with or without card)
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI, walletAPIAuto } from '../services/api';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

// Import all components
import { BingoCardPreview } from '../components/bingo/BingoCardPreview';
import { CardSelectionGrid } from '../components/bingo/CardSelectionGrid';
import { UserInfoDisplay } from '../components/user/UserInfoDisplay';
import { AdminControls } from '../components/admin/AdminControls';
import { ModeratorControls } from '../components/admin/ModeratorControls';
import { GameStatusDisplay } from '../components/game/GameStatusDisplay';

// Import hooks
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, Check, Rocket, AlertCircle, RefreshCw, Users } from 'lucide-react';

export default function Home() {
  const { 
    user, 
    isAuthenticated, 
    isLoading: authLoading, 
    isAdmin, 
    isModerator, 
    userRole, 
    walletBalance,
    refreshWalletBalance
  } = useAuth();

  const router = useRouter();
  
  // Use custom hooks
  const {
    gameStatus,
    restartCountdown,
    currentPlayers,
    gameData,
    calledNumbers,
    pageLoading,
    checkGameStatus,
    initializeGameState,
    autoStartTimeRemaining,
    hasAutoStartTimer
  } = useGameState();

  const {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    cardSelectionStatus,
    cardSelectionError,
    shouldEnableCardSelection,
    handleCardSelect,
    handleCardRelease,
    setCardSelectionError,
  } = useCardSelection(gameData, gameStatus);

  const [joinError, setJoinError] = useState<string>('');
  const [autoRedirected, setAutoRedirected] = useState<boolean>(false);
  const [gameParticipants, setGameParticipants] = useState<any[]>([]);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [loadingActiveGames, setLoadingActiveGames] = useState<boolean>(false);

  // NEW STATES FOR PLAYER'S CARD IN ACTIVE GAME
  const [hasCardInActiveGame, setHasCardInActiveGame] = useState<boolean>(false);
  const [playerGameId, setPlayerGameId] = useState<string | null>(null);
  const [playerCardNumber, setPlayerCardNumber] = useState<number | null>(null);
  const [playerGameStatus, setPlayerGameStatus] = useState<string | null>(null);
  const [isCheckingPlayerStatus, setIsCheckingPlayerStatus] = useState<boolean>(false);

  // Balance refresh states
  const [localWalletBalance, setLocalWalletBalance] = useState<number>(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);

  // Restart cooldown states
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [restartCooldownRemaining, setRestartCooldownRemaining] = useState<number>(0);
//remaining
const [cardSelectionTimeRemaining, setCardSelectionTimeRemaining] = useState<number>(0);
const [cardSelectionTotalDuration, setCardSelectionTotalDuration] = useState<number>(0);

  // ==================== CHECK IF USER HAS CARD IN ACTIVE GAME ====================
  const checkPlayerCardInActiveGame = async () => {
    if (!user?.id) return false;
    
    try {
      setIsCheckingPlayerStatus(true);
      console.log('🔄 Checking if player has card in active game...');
      
      // Get all waiting games (which includes WAITING_FOR_PLAYERS status)
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const waitingGame = waitingGamesResponse.data.games[0];
        console.log('🎯 Found waiting game with status:', waitingGame.status);
        
        // Check if user is a participant in this waiting game
        const participantsResponse = await gameAPI.getGameParticipants(waitingGame._id);
        console.log("Participate", participantsResponse);
        if (participantsResponse.data.success) {
          const participants = participantsResponse.data.participants || [];
          const playerParticipant = participants.find((p: any) => p.userId === user.id);
          
          if (playerParticipant && playerParticipant.hasCard) {
            console.log(`✅ Player has card #${playerParticipant.cardNumber} in game with status: ${waitingGame.status}`);
            setHasCardInActiveGame(true);
            setPlayerGameId(waitingGame._id);
            setPlayerCardNumber(playerParticipant.cardNumber || 0);
            setPlayerGameStatus(waitingGame.status);
            return true;
          }
        }
      }
      
      // Also check truly active games
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        const activeGame = activeGamesResponse.data.games[0];
        
        // Check if user is a participant in this active game
        const participantsResponse = await gameAPI.getGameParticipants(activeGame._id);
        if (participantsResponse.data.success) {
          const participants = participantsResponse.data.participants || [];
          const playerParticipant = participants.find((p: any) => p.userId === user.id);
          
          if (playerParticipant && playerParticipant.hasCard) {
            console.log(`✅ Player has card #${playerParticipant.cardNumber} in game with status: ${activeGame.status}`);
            setHasCardInActiveGame(true);
            setPlayerGameId(activeGame._id);
            setPlayerCardNumber(playerParticipant.cardNumber || 0);
            setPlayerGameStatus(activeGame.status);
            return true;
          }
        }
      }
      
      // If we get here, player doesn't have a card in any active game
      setHasCardInActiveGame(false);
      setPlayerGameId(null);
      setPlayerCardNumber(null);
      setPlayerGameStatus(null);
      return false;
    } catch (error) {
      console.error('❌ Error checking player card status:', error);
      setHasCardInActiveGame(false);
      setPlayerGameId(null);
      setPlayerCardNumber(null);
      setPlayerGameStatus(null);
      return false;
    } finally {
      setIsCheckingPlayerStatus(false);
    }
  };

  // ==================== LOAD ACTIVE GAMES ====================
  const loadActiveGames = async () => {
    try {
      setLoadingActiveGames(true);
      const response = await gameAPI.getActiveGames();
      if (response.data.success) {
        setActiveGames(response.data.games || []);
        console.log('🎮 Active games loaded:', response.data.games.length);
      }
    } catch (error) {
      console.error('❌ Failed to load active games:', error);
    } finally {
      setLoadingActiveGames(false);
    }
  };

  // ==================== REFRESH WALLET BALANCE FUNCTION ====================
  const refreshWalletBalanceLocal = async () => {
    try {
      setIsRefreshingBalance(true);
      console.log('💰 Refreshing wallet balance...');
      
      if (refreshWalletBalance) {
        await refreshWalletBalance();
        console.log('✅ Used AuthContext refreshWalletBalance');
      }
      
      const response = await walletAPIAuto.getBalance();
      setLocalWalletBalance(response.data.balance);
    } catch (error) {
      console.error('❌ Failed to refresh wallet balance:', error);
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // ==================== USE CORRECT BALANCE SOURCE ====================
  const effectiveWalletBalance = localWalletBalance > 0 ? localWalletBalance : walletBalance;

  // ==================== UPDATE RESTART COOLDOWN FROM GAME DATA ====================
  useEffect(() => {
    if (gameData) {
      const cooldown = gameData.hasRestartCooldown || false;
      const cooldownRemaining = gameData.restartCooldownRemaining || 0;
      
      setHasRestartCooldown(cooldown);
      setRestartCooldownRemaining(cooldownRemaining);
      
      if (cooldown && cooldownRemaining > 0) {
        console.log(`⏳ Restart cooldown active: ${Math.ceil(cooldownRemaining/1000)}s remaining`);
      }
    }
  }, [gameData]);

  // ==================== FETCH GAME PARTICIPANTS AND CHECK CONDITIONS ====================
  useEffect(() => {
    const fetchGameParticipants = async () => {
      if (gameData?._id) {
        try {
          const response = await gameAPI.getGameParticipants(gameData._id);
          if (response.data.success) {
            const participants = response.data.participants || [];
            setGameParticipants(participants);
            
            const playersWithCardsCount = participants.filter(p => p.hasCard).length;
            setPlayersWithCards(playersWithCardsCount);
            
            console.log(`👥 Game participants: ${participants.length}, Players with cards: ${playersWithCardsCount}`);
          }
        } catch (error) {
          console.error('❌ Failed to fetch game participants:', error);
        }
      }
    };

    fetchGameParticipants();
    
    const interval = setInterval(fetchGameParticipants, 5000);
    return () => clearInterval(interval);
  }, [gameData?._id]);

// Add this effect to update card selection countdown
useEffect(() => {
  if (gameData && gameData.status === 'CARD_SELECTION' && gameData.cardSelectionTimeRemaining) {
    setCardSelectionTimeRemaining(gameData.cardSelectionTimeRemaining);
    setCardSelectionTotalDuration(gameData.cardSelectionTotalDuration || 30000); // 30 seconds default
    
    // Update the countdown every second
    const interval = setInterval(() => {
      setCardSelectionTimeRemaining(prev => {
        const newValue = prev - 1000;
        return newValue < 0 ? 0 : newValue;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  } else {
    setCardSelectionTimeRemaining(0);
  }
}, [gameData]);

// Format time function
const formatTime = (milliseconds: number) => {
  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
  // ==================== LOAD ACTIVE GAMES ON INITIALIZATION ====================
  useEffect(() => {
       console.log("Defar = "+shouldDisableCardSelection);
    loadActiveGames();
    
    // Refresh active games every 10 seconds
    const interval = setInterval(loadActiveGames, 10000);
    return () => clearInterval(interval);
  }, []);

  // ==================== CHECK PLAYER'S CARD STATUS PERIODICALLY ====================
  useEffect(() => {
    if (!user?.id || authLoading) return;
    
    const checkPlayerStatus = async () => {
      await checkPlayerCardInActiveGame();
    };
    
    checkPlayerStatus();
    
    // Check every 5 seconds
    const interval = setInterval(checkPlayerStatus, 5000);
    return () => clearInterval(interval);
  }, [user?.id, authLoading]);

  // ==================== UPDATED REDIRECT LOGIC ====================
  // Redirect when:
  // 1. User has card in ACTIVE game
  // 2. OR Game is ACTIVE (even if user doesn't have card yet - redirect as spectator/late entry)
  // ==================== SIMPLIFIED REDIRECT LOGIC ====================

useEffect(() => {
  // Don't redirect during loading states
  if (isCheckingPlayerStatus || pageLoading || autoRedirected) return;
  
  console.log('🔍 Redirect check - Simplified:', {
    gameStatus,
    hasCardInActiveGame,
    playerGameStatus
  });
  
  // ONLY redirect if game is ACTIVE in main state OR player has card in ACTIVE game
  const shouldRedirect = 
    gameStatus === 'ACTIVE' || 
    (hasCardInActiveGame && playerGameStatus === 'ACTIVE');
  
  if (shouldRedirect) {
    console.log('🚨 Redirecting to game...');
    
    // Find the game to redirect to
    const targetGameId = playerGameId || (activeGames[0]?._id);
    
    if (targetGameId) {
      setAutoRedirected(true);
      
      // Redirect as spectator if no card, otherwise join with card
      const queryParams = hasCardInActiveGame ? '' : '?spectator=true';
      router.push(`/game/${targetGameId}${queryParams}`);
    }
  }
}, [
  gameStatus,
  hasCardInActiveGame,
  playerGameStatus,
  playerGameId,
  activeGames,
  isCheckingPlayerStatus,
  pageLoading,
  autoRedirected,
  router
]);

  // ==================== FIXED: GAME INFO FOOTER MESSAGE ====================
  const getGameStatusMessage = () => {
    if (hasCardInActiveGame) {
      if (playerGameStatus === 'ACTIVE') {
        return `🎯 You have card #${playerCardNumber} in active game - Redirecting...`;
      } else if (playerGameStatus === 'WAITING_FOR_PLAYERS') {
        return `⏳ You have card #${playerCardNumber} - Waiting for game to start...`;
      }
      return `🎯 You have card #${playerCardNumber} in game`;
    }

    if (hasRestartCooldown) {
      return `🔄 Game restarting in ${Math.ceil(restartCooldownRemaining / 1000)}s - Select your card now!`;
    }

    if (!selectedNumber && effectiveWalletBalance >= 10) {
      switch (gameStatus) {
        case 'WAITING_FOR_PLAYERS':
          return '🎯 Select a card number to join the waiting game';
        case 'ACTIVE':
          return '🎮 Game in progress - Redirecting to watch...';
        case 'FINISHED':
          return `🔄 Select a card for the next game (starting in ${restartCountdown}s)`;
        case 'RESTARTING':
          return '⚡ New game starting soon - Select your card!';
        default:
          return 'Select your card number to play!';
      }
    }

    if (!selectedNumber && effectiveWalletBalance < 10) {
      return `💡 Add balance to play (Current: ${effectiveWalletBalance} ብር)`;
    }

    if (selectedNumber && effectiveWalletBalance >= 10) {
      if (playersWithCards < 2) {
        return `⏳ Waiting for ${2 - playersWithCards} more player(s)...`;
      }
      
      switch (gameStatus) {
        case 'WAITING_FOR_PLAYERS':
          return `✅ Card ${selectedNumber} selected - Waiting for game to start`;
        case 'ACTIVE':
          return '🎮 Game active - You can still join!';
        case 'FINISHED':
          return `🔄 Card ${selectedNumber} reserved for next game`;
        default:
          return `✅ Card ${selectedNumber} selected - Waiting for game to start`;
      }
    }

    return '';
  };

  // ==================== CONDITIONAL GAME INFO DISPLAY ====================
  const shouldDisplayGameInfo = () => {
    // If user has card in active game, don't display anything
    if (hasCardInActiveGame && playerGameStatus === 'ACTIVE') {
      return false;
    }
    
    // Don't display if game is active (we'll redirect)
    if (gameStatus === 'ACTIVE') {
      return false;
    }
    
    // Only show game info for waiting games or other states
    return gameStatus === 'WAITING_FOR_PLAYERS' && playersWithCards >= 2;
  };

  // ==================== MAIN INITIALIZATION WITH BALANCE REFRESH ====================
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Starting app initialization...');
      
      if (authLoading) {
        console.log('⏳ Waiting for auth to load...');
        return;
      }

      if (!isAuthenticated || !user) {
        console.log('⚠️ User not authenticated, showing limited UI');
        await initializeGameState();
        return;
      }

      try {
        console.log('💰 Initial balance refresh...');
        await refreshWalletBalanceLocal();
        
        // Check if player already has a card in active game
        await checkPlayerCardInActiveGame();
        
        await initializeGameState();
        
        console.log('✅ App initialization complete');
        console.log(`💰 User balance: ${effectiveWalletBalance} ብር`);
        console.log(`🎮 Has card in active game: ${hasCardInActiveGame}, Game status: ${playerGameStatus}`);
      } catch (error) {
        console.error('❌ Initialization error:', error);
      }
    };

    initializeApp();
  }, [authLoading, isAuthenticated, user]);

  // ==================== PERIODIC BALANCE REFRESH ====================
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshWalletBalanceLocal();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);
  // ==================== DISABLE CARD SELECTION IF PLAYER HAS CARD IN ACTIVE GAME ====================
  const shouldDisableCardSelection = (hasCardInActiveGame && playerGameStatus === 'ACTIVE');
  const shouldShowActiveGameWarning = hasCardInActiveGame && playerGameStatus === 'ACTIVE';
const hasWaitingGame = hasCardInActiveGame && playerGameStatus === 'WAITING_FOR_PLAYERS';
console.log("Defar game",playerGameStatus+" = "+shouldDisableCardSelection);

  // ==================== SHOW REDIRECT LOADING SCREEN ====================
  if ((hasCardInActiveGame && playerGameStatus === 'ACTIVE' && !autoRedirected) ||
      (gameStatus === 'ACTIVE' && !hasCardInActiveGame && !autoRedirected)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">
            {hasCardInActiveGame ? 'Redirecting to Your Game...' : 'Game in Progress!'}
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">
            {hasCardInActiveGame 
              ? `You have card #${playerCardNumber} in an active game!`
              : 'A game is currently active. Redirecting to watch...'
            }
          </p>
          <p className="text-sm opacity-75 mt-2">Taking you to the game page...</p>
        </div>
      </div>
    );
  }

  // Show loading only when both auth and page are loading
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">Loading Bingo Game...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Initializing your game experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      {/* Updated Navbar with Role Info and Balance Refresh */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white font-bold text-xl">Bingo Game</h1>
            <p className="text-white/60 text-sm">
              {hasCardInActiveGame 
                ? playerGameStatus === 'ACTIVE' 
                  ? 'Already in active game - Redirecting...' 
                  : `Waiting for game to start (Card #${playerCardNumber})`
                : gameStatus === 'ACTIVE'
                ? 'Game in progress - Redirecting...'
                : isAdmin ? 'Admin Dashboard' : 
                isModerator ? 'Moderator View' : 
                'Select your card number'}
            </p>
          </div>
          
          {/* User Info with Role Badge and Balance Refresh */}
          <div className="flex items-center gap-3">
            <UserInfoDisplay user={user} userRole={userRole} />
          </div>
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <AdminControls 
          onStartGame={() => {}} // Placeholder functions
          onEndGame={() => {}} 
          onManageUsers={() => {}}
        />
      )}

      {/* Moderator Controls */}
      {isModerator && !isAdmin && (
        <ModeratorControls 
          onModerateGames={() => {}} // Placeholder functions
          onViewReports={() => {}}
        />
      )}

      {/* PLAYER ALREADY IN GAME NOTIFICATION */}
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
              <p className={`text-xs ${
                playerGameStatus === 'ACTIVE' ? 'text-green-200' : 'text-yellow-200'
              }`}>
                You have card #{playerCardNumber} in {playerGameStatus === 'ACTIVE' ? 'an active' : 'a waiting'} game
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full ${
              playerGameStatus === 'ACTIVE' 
                ? 'bg-green-500/30 animate-pulse' 
                : 'bg-yellow-500/30'
            }`}>
              <span className={`font-bold text-xs ${
                playerGameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'
              }`}>
                {playerGameStatus === 'ACTIVE' ? 'Redirecting...' : 'Waiting...'}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* GAME ACTIVE NOTIFICATION (for users without card) */}
    {gameStatus === 'ACTIVE' && !hasCardInActiveGame && (
  <motion.div 
    className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-3 mb-4 border border-blue-500/20"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <p className="text-blue-300 text-sm">Game in progress...</p>
      </div>
      <p className="text-blue-200 text-xs">Redirecting...</p>
    </div>
  </motion.div>
)}
      {/* BALANCE WARNING */}
      {!hasCardInActiveGame && effectiveWalletBalance < 10 && (
        <motion.div 
          className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-red-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-300" />
            <div className="flex-1">
              <p className="text-red-300 font-bold text-sm">
                Insufficient Balance
              </p>
              <p className="text-red-200 text-xs">
                You need 10 ብር to play. Current: {effectiveWalletBalance} ብር
              </p>
            </div>
            <button
              onClick={refreshWalletBalanceLocal}
              disabled={isRefreshingBalance}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-50 flex items-center gap-1"
            >
              {isRefreshingBalance ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* PLAYERS COUNT WARNING */}
      {/* {!hasCardInActiveGame && gameStatus === 'WAITING_FOR_PLAYERS' && playersWithCards < 2 && (
        <motion.div 
          className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-yellow-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-300" />
            <div className="flex-1">
              <p className="text-yellow-300 font-bold text-sm">
                Waiting for more players
              </p>
              <p className="text-yellow-200 text-xs">
                Need {2 - playersWithCards} more player(s) to start the game
              </p>
            </div>
            <div className="bg-yellow-500/30 px-3 py-1 rounded-full">
              <span className="text-yellow-300 font-bold">{playersWithCards}/2</span>
            </div>
          </div>
        </motion.div>
      )} */}
      {/* CARD SELECTION COUNTDOWN DISPLAY */}
{gameStatus === 'CARD_SELECTION' && cardSelectionTimeRemaining > 0 && (
  <motion.div 
    className="bg-purple-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-purple-500/30"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 300 }}
  >
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {formatTime(cardSelectionTimeRemaining)}
            </span>
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-purple-300/50 animate-ping"></div>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-bold text-lg">Card Selection Active!</h3>
          <p className="text-purple-200 text-sm">
            Select your bingo card before the timer runs out
          </p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full">
        <div className="flex justify-between text-xs text-purple-200 mb-1">
          <span>Time remaining</span>
          <span>{formatTime(cardSelectionTimeRemaining)}</span>
        </div>
        <div className="w-full bg-purple-400/20 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-purple-400 to-pink-400 h-3 rounded-full transition-all duration-1000"
            style={{ 
              width: `${((cardSelectionTotalDuration - cardSelectionTimeRemaining) / cardSelectionTotalDuration) * 100}%` 
            }}
          />
        </div>
      </div>
      
      {/* Players info */}
      <div className="mt-4 grid grid-cols-2 gap-4 w-full">
        <div className="text-center p-3 bg-purple-500/10 rounded-xl">
          <div className="text-white font-bold text-xl">{playersWithCards}</div>
          <div className="text-purple-200 text-xs">Players Selected</div>
        </div>
        <div className="text-center p-3 bg-purple-500/10 rounded-xl">
          <div className="text-white font-bold text-xl">{gameData?.cardsNeeded || 0}</div>
          <div className="text-purple-200 text-xs">Needed to Start</div>
        </div>
      </div>
      
      {/* Urgent message when time is running out */}
      {cardSelectionTimeRemaining < 10000 && (
        <motion.div 
          className="mt-3 p-3 bg-red-500/20 rounded-lg border border-red-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-red-300 text-sm text-center font-bold">
            ⚡ Hurry! Time is running out to select your card!
          </p>
        </motion.div>
      )}
    </div>
  </motion.div>
)}

      {/* CONDITIONAL GAME INFO DISPLAY */}
      {!hasCardInActiveGame && shouldDisplayGameInfo() ? (
        <>
          {/* Game Status Display */}
          <GameStatusDisplay 
            gameStatus={gameStatus}
            currentPlayers={currentPlayers}
            restartCountdown={restartCountdown}
            selectedNumber={selectedNumber}
            walletBalance={effectiveWalletBalance}
            shouldEnableCardSelection={shouldEnableCardSelection()}
            autoStartTimeRemaining={autoStartTimeRemaining}
            hasAutoStartTimer={hasAutoStartTimer}
            hasRestartCooldown={hasRestartCooldown}
            restartCooldownRemaining={restartCooldownRemaining}
          />

          {/* Card Selection Status */}
          {shouldEnableCardSelection() && cardSelectionStatus.isSelectionActive && (
            <motion.div 
              className={`backdrop-blur-lg rounded-2xl p-4 mb-4 border ${
                hasRestartCooldown
                  ? 'bg-purple-500/20 border-purple-500/30' 
                  : hasAutoStartTimer 
                    ? 'bg-orange-500/20 border-orange-500/30' 
                    : 'bg-green-500/20 border-green-500/30'
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasRestartCooldown ? (
                    <Clock className="w-4 h-4 text-purple-300" />
                  ) : hasAutoStartTimer ? (
                    <Rocket className="w-4 h-4 text-orange-300" />
                  ) : (
                    <Clock className="w-4 h-4 text-green-300" />
                  )}
                  <p className={`font-bold text-sm ${
                    hasRestartCooldown ? 'text-purple-300' :
                    hasAutoStartTimer ? 'text-orange-300' : 'text-green-300'
                  }`}>
                    {hasRestartCooldown ? '🔄 Restart Cooldown' : 
                     hasAutoStartTimer ? '🚀 Game Starting Soon!' : 
                     'Card Selection Active'}
                  </p>
                </div>
              </div>
              
              {/* RESTART COOLDOWN PROGRESS */}
              {/* {hasRestartCooldown && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-purple-200 mb-1">
                    <span>Previous game ended - Waiting 60s before next game</span>
                    <span>{playersWithCards}/2 players ready</span>
                  </div>
                  <div className="w-full bg-purple-400/20 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${((60000 - restartCooldownRemaining) / 60000) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              )} */}
              
              {/* AUTO-START PROGRESS */}
              {hasAutoStartTimer && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-orange-200 mb-1">
                    <span>Game will start automatically</span>
                    <span>{playersWithCards}/2 players ready</span>
                  </div>
                  <div className="w-full bg-orange-400/20 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-orange-400 to-red-400 h-2 rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${((30000 - autoStartTimeRemaining) / 30000) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              )}
              
              {cardSelectionError && (
                <p className="text-red-300 text-xs mt-2 text-center">
                  {cardSelectionError}
                </p>
              )}
            </motion.div>
          )}
        </>
      ) : !hasCardInActiveGame && gameStatus !== 'ACTIVE' ? (
        /* LIMITED GAME INFO FOR NON-ACTIVE GAMES */
        // <motion.div 
        //   className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/20"
        //   initial={{ opacity: 0, y: -10 }}
        //   animate={{ opacity: 1, y: 0 }}
        // >
        //   <div className="text-center">
        //     <div className="mb-3">
        //       <div className="text-white/70 text-sm mb-1">Game Status</div>
        //       <div className={`px-4 py-1 rounded-full inline-block ${
        //         gameStatus === 'WAITING_FOR_PLAYERS' ? 'bg-yellow-500/20 text-yellow-300' :
        //         gameStatus === 'FINISHED' ? 'bg-orange-500/20 text-orange-300' :
        //         'bg-purple-500/20 text-purple-300'
        //       }`}>
        //         {gameStatus === 'WAITING_FOR_PLAYERS' ? '⏳ Waiting for players' :
        //          gameStatus === 'FINISHED' ? '🏁 Game Finished' :
        //          '⚡ Preparing next game'}
        //       </div>
        //     </div>
            
        //     <div className="grid grid-cols-2 gap-4">
        //       <div>
        //         <div className="text-white font-bold">{playersWithCards}</div>
        //         <div className="text-white/60 text-xs">Players Ready</div>
        //       </div>
        //       <div>
        //         <div className="text-white font-bold">{2 - playersWithCards}</div>
        //         <div className="text-white/60 text-xs">Needed to Start</div>
        //       </div>
        //     </div>
            
        //     <div className="mt-3 grid grid-cols-2 gap-4">
        //       <div>
        //         <div className="text-white font-bold">{effectiveWalletBalance} ብር</div>
        //         <div className="text-white/60 text-xs">Your Balance</div>
        //       </div>
        //       <div>
        //         <div className="text-white font-bold">10 ብር</div>
        //         <div className="text-white/60 text-xs">Required</div>
        //       </div>
        //     </div>
            
        //     {playersWithCards < 2 && (
        //       <div className="mt-3 p-2 bg-yellow-500/10 rounded-lg">
        //         <p className="text-yellow-300 text-xs">
        //           Need {2 - playersWithCards} more player(s) to start the game
        //         </p>
        //       </div>
        //     )}
            
        //     {effectiveWalletBalance < 10 && (
        //       <div className="mt-3 p-2 bg-red-500/10 rounded-lg">
        //         <p className="text-red-300 text-xs">
        //           Need {10 - effectiveWalletBalance} ብር more to play
        //         </p>
        //       </div>
        //     )}
        //   </div>
        // </motion.div>
        <></>
      ) : null}

      {/* Card Selection Grid - Only show for WAITING games, not ACTIVE games */}
      {gameStatus !== 'ACTIVE' && (!hasCardInActiveGame || playerGameStatus !== 'ACTIVE') ? (
     
        <CardSelectionGrid
          availableCards={availableCards}
          takenCards={takenCards}
          selectedNumber={selectedNumber}
          walletBalance={effectiveWalletBalance}
          gameStatus={gameStatus}
          onCardSelect={handleCardSelect}
          // disabled={shouldDisableCardSelection}  // Only disable for ACTIVE games
  // hasActiveGame={shouldShowActiveGameWarning}  // Only true for ACTIVE games
  // activeGameInfo={{
  //   gameId: playerGameId || undefined,
  //   cardNumber: playerCardNumber || undefined,
  //   gameStatus: playerGameStatus || undefined
  // }}
        
        />
      ) : null}

      {/* Selected Card Preview - Show below the grid when a card is selected */}
      {!hasCardInActiveGame && selectedNumber && gameStatus !== 'ACTIVE' && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Selection Header */}
          <motion.div 
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mt-4 border border-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-white font-bold text-sm mb-3 text-center">Card Combination Details</h3>
            
            {/* Column-wise breakdown */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                <div key={letter} className="text-center">
                  <div className="text-telegram-button font-bold text-lg">{letter}</div>
                  <div className="text-white/60 text-xs">Column</div>
                </div>
              ))}
            </div>

            {/* Number breakdown */}
            <div className="space-y-3">
              {bingoCard && bingoCard.map((column, colIndex) => (
                <div key={colIndex} className="flex items-center">
                  <div className="w-8 text-telegram-button font-bold text-sm">
                    {['B', 'I', 'N', 'G', 'O'][colIndex]}:
                  </div>
                  <div className="flex-1 flex gap-1">
                    {column.map((number, rowIndex) => (
                      <div
                        key={`${colIndex}-${rowIndex}`}
                        className={`
                          flex-1 text-center py-1 rounded text-xs font-medium
                          ${number === 'FREE' 
                            ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white' 
                            : 'bg-white/20 text-white'
                          }
                        `}
                      >
                        {number}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/20">
              <div className="text-center text-white/60 text-xs">
                Total Numbers: {bingoCard ? bingoCard.flat().filter(num => num !== 'FREE').length : 0} • 
                FREE Space: 1
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Join Error Display */}
      {!hasCardInActiveGame && joinError && (
        <motion.div 
          className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-red-500/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-300" />
            <p className="text-red-300 text-sm">{joinError}</p>
          </div>
        </motion.div>
      )}

      {/* Game Info Footer */}
      <motion.div 
        className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="grid grid-cols-2 gap-4 text-center mb-3">
          <div>
            <p className="text-white font-bold">10 ብር</p>
            <p className="text-white/60 text-xs">Entry Fee</p>
          </div>
          <div>
            <p className="text-white font-bold">
              {hasRestartCooldown ? '60s Wait' : 'Auto'}
            </p>
            <p className="text-white/60 text-xs">
              {hasRestartCooldown ? 'Restart Cooldown' : 'Game Start'}
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          {/* Dynamic game status message */}
          <p className={`text-sm text-center font-medium ${
            hasCardInActiveGame && playerGameStatus === 'ACTIVE' ? 'text-green-300' :
            hasCardInActiveGame && playerGameStatus === 'WAITING_FOR_PLAYERS' ? 'text-yellow-300' :
            gameStatus === 'ACTIVE' ? 'text-blue-300' :
            hasRestartCooldown ? 'text-purple-300' :
            gameStatus === 'WAITING_FOR_PLAYERS' ? 'text-yellow-300' :
            gameStatus === 'FINISHED' ? 'text-orange-300' :
            'text-purple-300'
          }`}>
            {getGameStatusMessage()}
          </p>
          
          <p className="text-white/60 text-xs text-center">
            {hasRestartCooldown 
              ? 'Games restart 60 seconds after completion'
              : 'Games restart automatically 60 seconds after completion'
            }
          </p>
          <p className="text-white/40 text-xs text-center">
            Minimum 2 players required to start the game
          </p>
          
          {/* Additional info for players with cards */}
          {hasCardInActiveGame && (
            <div className={`mt-2 p-2 rounded-lg ${
              playerGameStatus === 'ACTIVE' 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-yellow-500/10 border border-yellow-500/20'
            }`}>
              <p className={`text-xs text-center ${
                playerGameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'
              }`}>
                {playerGameStatus === 'ACTIVE'
                  ? '✅ Your game is active - Redirecting now'
                  : '⏳ Your game is waiting for players - Stay on this page'}
              </p>
            </div>
          )}
          
          {/* Info for active game without card */}
          {gameStatus === 'ACTIVE' && !hasCardInActiveGame && (
            <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-300 text-xs text-center">
                🎮 A game is currently active - Redirecting to watch...
              </p>
            </div>
            
          )}
        </div>
      </motion.div>
    </div>
  );
}
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx - FIXED VERSION (Proper wallet balance handling)
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

// Import all components
import { BingoCardPreview } from '../components/bingo/BingoCardPreview';
import { CardSelectionGrid } from '../components/bingo/CardSelectionGrid';
import { UserInfoDisplay } from '../components/user/UserInfoDisplay';
import { AdminControls } from '../components/admin/AdminControls';
import { ModeratorControls } from '../components/admin/ModeratorControls';
import { GameStatusDisplay } from '../components/game/GameStatusDisplay';
import { GameControls } from '../components/game/GameControls';

// Import hooks
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { useAccountStorage } from '../hooks/useAccountStorage';
import { Clock, Play, Check, Rocket, AlertCircle, Users, RefreshCw } from 'lucide-react';

export default function Home() {
  const { 
    user, 
    isAuthenticated, 
    isLoading: authLoading, 
    isAdmin, 
    isModerator, 
    userRole, 
    walletBalance,
    refreshWalletBalance,
    hasPermission 
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
    // ADD AUTO-START STATES
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
    setCardSelectionError
  } = useCardSelection(gameData, gameStatus);

  const [joining, setJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>('');
  const [showGameView, setShowGameView] = useState<boolean>(false);
  const [autoRedirected, setAutoRedirected] = useState<boolean>(false);
  const [gameParticipants, setGameParticipants] = useState<any[]>([]);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);
  const [canStartGame, setCanStartGame] = useState<boolean>(false);

  // ==================== ADD BALANCE REFRESH STATES ====================
  const [localWalletBalance, setLocalWalletBalance] = useState<number>(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);
  const [balanceRefreshCounter, setBalanceRefreshCounter] = useState<number>(0);

  // ==================== ADD MISSING RESTART COOLDOWN STATES ====================
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [restartCooldownRemaining, setRestartCooldownRemaining] = useState<number>(0);

  // ==================== FIXED: REFRESH WALLET BALANCE FUNCTION ====================
  const refreshWalletBalanceLocal = async () => {
    try {
      setIsRefreshingBalance(true);
      console.log('💰 Refreshing wallet balance...');
      
      // First try to use the AuthContext's refresh function
      if (refreshWalletBalance) {
        await refreshWalletBalance();
        console.log('✅ Used AuthContext refreshWalletBalance');
      }
      
      // Also fetch directly to ensure we have the latest balance
      const response = await fetch('/api/wallet/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLocalWalletBalance(data.balance);
          console.log(`💰 Direct balance fetch: ${data.balance} ብር`);
        }
      }
      
      // Increment counter to trigger UI updates
      setBalanceRefreshCounter(prev => prev + 1);
    } catch (error) {
      console.error('❌ Failed to refresh wallet balance:', error);
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // ==================== FIXED: USE CORRECT BALANCE SOURCE ====================
  // Combine local balance with AuthContext balance for reliability
  const effectiveWalletBalance = localWalletBalance > 0 ? localWalletBalance : walletBalance;

  // ==================== UPDATE RESTART COOLDOWN FROM GAME DATA ====================
  useEffect(() => {
    if (gameData) {
      // Check if game has restart cooldown data
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
            
            // Check if game can start (minimum 2 players with cards)
            const canStart = playersWithCardsCount >= 2;
            setCanStartGame(canStart);
            
            console.log(`👥 Game participants: ${participants.length}, Players with cards: ${playersWithCardsCount}, Can start: ${canStart}`);
          }
        } catch (error) {
          console.error('❌ Failed to fetch game participants:', error);
        }
      }
    };

    fetchGameParticipants();
    
    // Refresh participants every 5 seconds
    const interval = setInterval(fetchGameParticipants, 5000);
    return () => clearInterval(interval);
  }, [gameData?._id]);

  // ==================== FIXED: MODIFIED AUTO-JOIN LOGIC WITH PROPER BALANCE CHECK ====================
  useEffect(() => {
    console.log('🔍 Auto-join condition check:', {
      timeRemaining: cardSelectionStatus.timeRemaining,
      isSelectionActive: cardSelectionStatus.isSelectionActive,
      selectedNumber: selectedNumber,
      walletBalance: effectiveWalletBalance,
      hasRestartCooldown: hasRestartCooldown,
      playersWithCards: playersWithCards,
      allConditionsMet: cardSelectionStatus.timeRemaining <= 0 && 
                      cardSelectionStatus.isSelectionActive && 
                      selectedNumber && 
                      effectiveWalletBalance >= 10 &&
                      !hasRestartCooldown &&
                      playersWithCards >= 2
    });

    // Auto-join when ALL conditions are met (including minimum players)
    if (cardSelectionStatus.timeRemaining <= 0 && 
        cardSelectionStatus.isSelectionActive && 
        selectedNumber && 
        effectiveWalletBalance >= 10 &&
        !hasRestartCooldown &&
        playersWithCards >= 2) {
      
      console.log('🚀 All auto-join conditions met! Triggering auto-join...');
      handleAutoJoinGame();
    }
  }, [
    cardSelectionStatus.timeRemaining, 
    cardSelectionStatus.isSelectionActive, 
    selectedNumber, 
    effectiveWalletBalance, 
    hasRestartCooldown, 
    playersWithCards
  ]);

  // ==================== AUTO-START CHECK ====================
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Only check auto-start if game is waiting and NOT in restart cooldown
    if (gameStatus === 'WAITING' && gameData?._id && !hasRestartCooldown) {
      intervalId = setInterval(async () => {
        try {
          console.log('🔄 Checking auto-start conditions...');
          
          // Call the auto-start check API
          const response = await gameAPI.checkAutoStart(gameData._id);
          
          if (response.data.success) {
            console.log('🎮 Auto-start check response:', response.data);
            
            // If game started via auto-start, refresh game state
            if (response.data.gameStarted) {
              console.log('🚀 Game auto-started! Refreshing...');
              await checkGameStatus();
            } else if (response.data.autoStartInfo) {
              console.log('⏳ Auto-start info:', response.data.autoStartInfo);
            }
          }
        } catch (error) {
          console.error('❌ Auto-start check failed:', error);
        }
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gameStatus, gameData?._id, checkGameStatus, hasRestartCooldown]);

  // ==================== FIXED: MODIFIED AUTO-JOIN FUNCTION WITH PROPER BALANCE CHECK ====================
  const handleAutoJoinGame = async () => {
    if (!selectedNumber || !user?.id || hasRestartCooldown) return; // Don't auto-join during cooldown
    
    // Check if enough players before auto-joining
    if (playersWithCards < 2) {
      console.log(`❌ Not enough players with cards (${playersWithCards}/2). Cannot auto-join.`);
      setJoinError(`Need ${2 - playersWithCards} more player(s) to start the game`);
      return;
    }

    // Check balance
    if (effectiveWalletBalance < 10) {
      console.log(`❌ Insufficient balance: ${effectiveWalletBalance} ብር (needs 10 ብር)`);
      setJoinError('Insufficient balance. Minimum 10 ብር required to play.');
      return;
    }

    try {
      console.log('🤖 Auto-joining game...');
      
      // Set showGameView to true to trigger the loading screen
      setShowGameView(true);
      
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        console.log('🎯 Joining waiting game:', game._id);
        
        // Check game participants again before joining
        const participantsResponse = await gameAPI.getGameParticipants(game._id);
        const currentPlayersWithCards = participantsResponse.data.participants?.filter(p => p.hasCard).length || 0;
        
        if (currentPlayersWithCards < 2) {
          console.log(`❌ Not enough players to join (${currentPlayersWithCards}/2)`);
          setShowGameView(false);
          setJoinError(`Need ${2 - currentPlayersWithCards} more player(s) to start the game`);
          return;
        }
        
        // FIX: Use user.id (Telegram ID) instead of MongoDB ObjectId
        const joinResponse = await gameAPI.joinGame(game.code, user.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          console.log('✅ Auto-joined game successfully');
          
          // Get the user's bingo card using Telegram ID
          try {
            const cardResponse = await gameAPI.getUserBingoCard(updatedGame._id, user.id);
            if (cardResponse.data.success && cardResponse.data.bingoCard) {
              const cardData = {
                cardNumber: selectedNumber,
                numbers: cardResponse.data.bingoCard.numbers
              };
              
              const encodedCardData = encodeURIComponent(JSON.stringify(cardData));
              
              setTimeout(() => {
                router.push(`/game/${updatedGame._id}?card=${encodedCardData}`);
              }, 1500);
            } else {
              // Fallback: use generated bingo card
              const cardData = {
                cardNumber: selectedNumber,
                numbers: bingoCard
              };
              
              const encodedCardData = encodeURIComponent(JSON.stringify(cardData));
              setTimeout(() => {
                router.push(`/game/${updatedGame._id}?card=${encodedCardData}`);
              }, 1500);
            }
          } catch (cardError) {
            console.error('Failed to fetch bingo card:', cardError);
            // Fallback with generated card
            const cardData = {
              cardNumber: selectedNumber,
              numbers: bingoCard
            };
            
            const encodedCardData = encodeURIComponent(JSON.stringify(cardData));
            setTimeout(() => {
              router.push(`/game/${updatedGame._id}?card=${encodedCardData}`);
            }, 1500);
          }
        } else {
          console.log('⚠️ Auto-join failed, redirecting to watch');
          setTimeout(() => {
            router.push(`/game/${game._id}?spectator=true`);
          }, 1500);
        }
      } else {
        const activeGamesResponse = await gameAPI.getActiveGames();
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          console.log('🎯 Joining active game as spectator');
          setTimeout(() => {
            router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
          }, 1500);
        } else {
          console.log('❌ No games available');
          setShowGameView(false);
          setJoinError('No games available at the moment');
        }
      }
    } catch (error: any) {
      console.error('Auto-join failed:', error);
      setShowGameView(false);
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        setTimeout(() => {
          router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
        }, 1500);
      }
    }
  };

  // ==================== FIXED: MODIFIED JOIN GAME FUNCTION WITH PROPER BALANCE CHECK ====================
  const handleJoinGame = async () => {
    if (!selectedNumber || !user?.id) return;

    setJoining(true);
    setJoinError('');

    try {
      // Check if enough players before joining
      if (playersWithCards < 2) {
        setJoinError(`Need ${2 - playersWithCards} more player(s) to start the game`);
        setJoining(false);
        return;
      }

      // Check balance using effective balance
      if (effectiveWalletBalance < 10) {
        setJoinError(`Insufficient balance. You have ${effectiveWalletBalance} ብር, minimum 10 ብር required.`);
        setJoining(false);
        
        // Try to refresh balance before showing error
        setTimeout(() => {
          refreshWalletBalanceLocal();
        }, 1000);
        
        return;
      }

      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        
        // Check participants again before joining
        const participantsResponse = await gameAPI.getGameParticipants(game._id);
        const currentPlayersWithCards = participantsResponse.data.participants?.filter(p => p.hasCard).length || 0;
        
        if (currentPlayersWithCards < 2) {
          setJoinError(`Need ${2 - currentPlayersWithCards} more player(s) to start the game`);
          setJoining(false);
          return;
        }
        
        const joinResponse = await gameAPI.joinGame(game.code, user.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          router.push(`/game/${updatedGame._id}`);
        } else {
          setJoinError(joinResponse.data.success || 'Failed to join game');
          handleJoinAsSpectator();
        }
      } else {
        handleJoinAsSpectator();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to join game. Please try again.';
      setJoinError(errorMessage);
      handleJoinAsSpectator();
    } finally {
      setJoining(false);
    }
  };

  const handleJoinAsSpectator = async () => {
    try {
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
      } else {
        setJoinError('No games available at the moment. Please try again later.');
      }
    } catch (watchError) {
      console.error('Failed to redirect to watch game:', watchError);
      setJoinError('Failed to join any game. Please try again.');
    }
  };

  // ==================== FIXED: UPDATED GAME INFO FOOTER MESSAGE WITH PROPER BALANCE ====================
  const getGameStatusMessage = () => {
    if (hasRestartCooldown) {
      return `🔄 Game restarting in ${Math.ceil(restartCooldownRemaining / 1000)}s - Select your card now!`;
    }

    if (!selectedNumber && effectiveWalletBalance >= 10) {
      switch (gameStatus) {
        case 'WAITING':
          return '🎯 Select a card number to join the waiting game';
        case 'ACTIVE':
          return '🚀 Game in progress - Select a card for late entry!';
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
      switch (gameStatus) {
        case 'WAITING':
          return `⏳ Ready! Need ${2 - playersWithCards} more player(s) to start`;
        case 'ACTIVE':
          return '🚀 Auto-joining active game with card #{selectedNumber}...';
        case 'FINISHED':
          return `🔄 Card ${selectedNumber} reserved for next game`;
        default:
          return `Card ${selectedNumber} selected and ready!`;
      }
    }

    return '';
  };

  // ==================== CONDITIONAL GAME INFO DISPLAY ====================
  const shouldDisplayGameInfo = () => {
    // Only show full game info for active or waiting games with enough players
    if (gameStatus === 'ACTIVE') {
      return true;
    }
    
    if (gameStatus === 'WAITING' && playersWithCards >= 2) {
      return true;
    }
    
    // For other statuses, show limited info
    return false;
  };

  // ==================== FIXED: MAIN INITIALIZATION WITH BALANCE REFRESH ====================
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
        // Refresh wallet balance FIRST
        console.log('💰 Initial balance refresh...');
        await refreshWalletBalanceLocal();
        
        // Initialize game state
        await initializeGameState();
        
        console.log('✅ App initialization complete');
        console.log(`💰 User balance: ${effectiveWalletBalance} ብር`);
      } catch (error) {
        console.error('❌ Initialization error:', error);
      }
    };

    initializeApp();
  }, [authLoading, isAuthenticated, user]);

  // ==================== AUTO-JOIN WHEN GAME VIEW IS SHOWN ====================
  useEffect(() => {
    if (showGameView && selectedNumber && effectiveWalletBalance >= 10 && !hasRestartCooldown && playersWithCards >= 2) {
      const timer = setTimeout(() => {
        handleAutoJoinGame();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showGameView, selectedNumber, effectiveWalletBalance, hasRestartCooldown, playersWithCards]);

  // ==================== PERIODIC BALANCE REFRESH ====================
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshWalletBalanceLocal();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Auto-join loading screen
  if (showGameView && selectedNumber && effectiveWalletBalance >= 10 && !hasRestartCooldown && playersWithCards >= 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-white font-bold text-xl">Bingo Game</h1>
              <p className="text-white/60 text-sm">Joining Game Automatically</p>
            </div>
            <UserInfoDisplay user={user} userRole={userRole} />
          </div>
        </div>

        <motion.div 
          className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-green-500/30"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Play className="w-6 h-6 text-green-300" />
            <p className="text-white font-bold text-xl">Joining Game...</p>
          </div>
          <p className="text-green-200 text-center mb-4">
            Auto-joining with Card #{selectedNumber}
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-300"></div>
          </div>
        </motion.div>

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <BingoCardPreview cardNumber={selectedNumber} numbers={bingoCard!} />
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
              {isAdmin ? 'Admin Dashboard' : 
              isModerator ? 'Moderator View' : 
              'Select your card number'}
            </p>
          </div>
          
          {/* User Info with Role Badge and Balance Refresh */}
          <div className="flex items-center gap-3">
            {/* Balance Display with Refresh Button */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-white font-bold text-lg">
                  {isRefreshingBalance ? (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    `${effectiveWalletBalance} ብር`
                  )}
                </p>
                <p className="text-white/60 text-xs">Balance</p>
              </div>
              <button
                onClick={refreshWalletBalanceLocal}
                disabled={isRefreshingBalance}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                title="Refresh balance"
              >
                <RefreshCw className={`w-4 h-4 text-white ${isRefreshingBalance ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <UserInfoDisplay user={user} userRole={userRole} />
          </div>
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <AdminControls 
          onStartGame={() => {}} // FIXED: Removed undefined function
          onEndGame={() => {}} 
          onManageUsers={() => {}}
        />
      )}

      {/* Moderator Controls */}
      {isModerator && !isAdmin && (
        <ModeratorControls 
          onModerateGames={() => {}} // FIXED: Removed undefined function
          onViewReports={() => {}}   // FIXED: Removed undefined function
        />
      )}

      {/* ==================== BALANCE WARNING ==================== */}
      {effectiveWalletBalance < 10 && (
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

      {/* ==================== PLAYERS COUNT WARNING ==================== */}
      {gameStatus === 'WAITING' && playersWithCards < 2 && (
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
      )}

      {/* ==================== CONDITIONAL GAME INFO DISPLAY ==================== */}
      {shouldDisplayGameInfo() ? (
        <>
          {/* Game Status Display - UPDATED WITH RESTART COOLDOWN PROPS */}
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

          {/* AUTO-JOIN DIAGNOSTIC PANEL */}
          <div className="mb-4 p-3 bg-black/30 rounded-xl border border-white/10 text-xs">
            <div className="grid grid-cols-2 gap-2 text-white/70">
              <div>Wallet Balance: <span className={effectiveWalletBalance >= 10 ? 'text-green-300' : 'text-red-300'}>{effectiveWalletBalance} ብር</span></div>
              <div>Restart Cooldown: <span className={hasRestartCooldown ? 'text-yellow-300' : 'text-green-300'}>{hasRestartCooldown ? 'ACTIVE' : 'INACTIVE'}</span></div>
              <div>Cooldown Remaining: <span className="text-yellow-300">{Math.ceil(restartCooldownRemaining/1000)}s</span></div>
              <div>Auto-start Timer: <span className={hasAutoStartTimer ? 'text-yellow-300' : 'text-gray-400'}>{hasAutoStartTimer ? 'ACTIVE' : 'INACTIVE'}</span></div>
              <div>Auto-start Remaining: <span className="text-yellow-300">{Math.ceil(autoStartTimeRemaining/1000)}s</span></div>
              <div className="col-span-2 text-center pt-2 border-t border-white/10">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-3 h-3" />
                  <span>Players with cards: <span className="font-bold">{playersWithCards}/2</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Selection Status - UPDATED WITH RESTART COOLDOWN */}
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
                <p className={`text-sm ${
                  hasRestartCooldown ? 'text-purple-200' :
                  hasAutoStartTimer ? 'text-orange-200' : 'text-green-200'
                }`}>
                  {hasRestartCooldown 
                    ? `${Math.ceil(restartCooldownRemaining / 1000)}s cooldown`
                    : hasAutoStartTimer 
                      ? `${Math.ceil(autoStartTimeRemaining / 1000)}s to start`
                      : `${Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s remaining`
                  }
                </p>
              </div>
              
              {/* RESTART COOLDOWN PROGRESS */}
              {hasRestartCooldown && (
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
              )}
              
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
              
              {/* REGULAR CARD SELECTION PROGRESS */}
              {!hasRestartCooldown && !hasAutoStartTimer && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-green-200 mb-1">
                    <span>Choose your card number to join the game</span>
                    <span>{takenCards.length}/400 cards taken</span>
                  </div>
                  <div className="w-full bg-green-400/20 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${((30000 - cardSelectionStatus.timeRemaining) / 30000) * 100}%` 
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
      ) : (
        /* ==================== LIMITED GAME INFO FOR NON-ACTIVE GAMES ==================== */
        <motion.div 
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/20"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center">
            <div className="mb-3">
              <div className="text-white/70 text-sm mb-1">Game Status</div>
              <div className={`px-4 py-1 rounded-full inline-block ${
                gameStatus === 'WAITING' ? 'bg-yellow-500/20 text-yellow-300' :
                gameStatus === 'FINISHED' ? 'bg-orange-500/20 text-orange-300' :
                'bg-purple-500/20 text-purple-300'
              }`}>
                {gameStatus === 'WAITING' ? '⏳ Waiting for players' :
                 gameStatus === 'FINISHED' ? '🏁 Game Finished' :
                 '⚡ Preparing next game'}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-white font-bold">{playersWithCards}</div>
                <div className="text-white/60 text-xs">Players Ready</div>
              </div>
              <div>
                <div className="text-white font-bold">{2 - playersWithCards}</div>
                <div className="text-white/60 text-xs">Needed to Start</div>
              </div>
            </div>
            
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-white font-bold">{effectiveWalletBalance} ብር</div>
                <div className="text-white/60 text-xs">Your Balance</div>
              </div>
              <div>
                <div className="text-white font-bold">10 ብር</div>
                <div className="text-white/60 text-xs">Required</div>
              </div>
            </div>
            
            {playersWithCards < 2 && (
              <div className="mt-3 p-2 bg-yellow-500/10 rounded-lg">
                <p className="text-yellow-300 text-xs">
                  Need {2 - playersWithCards} more player(s) to start the game
                </p>
              </div>
            )}
            
            {effectiveWalletBalance < 10 && (
              <div className="mt-3 p-2 bg-red-500/10 rounded-lg">
                <p className="text-red-300 text-xs">
                  Need {10 - effectiveWalletBalance} ብር more to play
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Card Selection Grid - ALWAYS VISIBLE */}
      <CardSelectionGrid
        availableCards={availableCards}
        takenCards={takenCards}
        selectedNumber={selectedNumber}
        walletBalance={effectiveWalletBalance}
        gameStatus={gameStatus}
        onCardSelect={handleCardSelect}
      />

      {/* Selected Card Preview - Show below the grid when a card is selected */}
      {selectedNumber && (
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
      {joinError && (
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

      {/* Game Info Footer - UPDATED WITH RESTART COOLDOWN MESSAGES */}
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
          {/* Balance Information */}
          <div className="flex justify-between items-center px-2">
            <span className="text-white/70 text-sm">Your Balance:</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${effectiveWalletBalance >= 10 ? 'text-green-300' : 'text-red-300'}`}>
                {effectiveWalletBalance} ብር
              </span>
              <button
                onClick={refreshWalletBalanceLocal}
                disabled={isRefreshingBalance}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                title="Refresh balance"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          {/* Dynamic game status message */}
          <p className={`text-sm text-center font-medium ${
            hasRestartCooldown ? 'text-purple-300' :
            gameStatus === 'WAITING' ? 'text-blue-300' :
            gameStatus === 'ACTIVE' ? 'text-green-300' :
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
          
          {/* Additional restart cooldown info */}
          {hasRestartCooldown && (
            <div className="mt-2 p-2 bg-purple-500/10 rounded-lg">
              <p className="text-purple-300 text-xs text-center">
                ⏳ Previous game finished {Math.ceil((60000 - restartCooldownRemaining) / 1000)}s ago
              </p>
              <p className="text-purple-200 text-xs text-center mt-1">
                Next game starts in {Math.ceil(restartCooldownRemaining / 1000)} seconds
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
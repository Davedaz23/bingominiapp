/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx - UPDATED VERSION (Auto-redirect when conditions met)
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
import { useAccountStorage } from '../hooks/useAccountStorage';
import { Clock, Play, Check, Rocket, AlertCircle, Users, RefreshCw, Eye } from 'lucide-react';

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
    setCardSelectionError
  } = useCardSelection(gameData, gameStatus);

  const [joinError, setJoinError] = useState<string>('');
  const [showGameView, setShowGameView] = useState<boolean>(false);
  const [autoRedirected, setAutoRedirected] = useState<boolean>(false);
  const [gameParticipants, setGameParticipants] = useState<any[]>([]);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);
  const [canStartGame, setCanStartGame] = useState<boolean>(false);
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [loadingActiveGames, setLoadingActiveGames] = useState<boolean>(false);

  // Balance refresh states
  const [localWalletBalance, setLocalWalletBalance] = useState<number>(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);
  const [balanceRefreshCounter, setBalanceRefreshCounter] = useState<number>(0);

  // Restart cooldown states
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [restartCooldownRemaining, setRestartCooldownRemaining] = useState<number>(0);

  // Auto-join tracking
  const [isAutoJoining, setIsAutoJoining] = useState<boolean>(false);
  const [lastAutoJoinAttempt, setLastAutoJoinAttempt] = useState<number>(0);

  // ==================== LOAD ACTIVE GAMES ====================
  const loadActiveGames = async () => {
    try {
      setLoadingActiveGames(true);
      const response = await gameAPI.getActiveGames();
      if (response.data.success && response.data.games[0].status=="ACTIVE") {
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
          setLocalWalletBalance(( response).data.balance);
          
        
      
      
      setBalanceRefreshCounter(prev => prev + 1);
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
    
    const interval = setInterval(fetchGameParticipants, 5000);
    return () => clearInterval(interval);
  }, [gameData?._id]);

  // ==================== LOAD ACTIVE GAMES ON INITIALIZATION ====================
  useEffect(() => {
    loadActiveGames();
    
    // Refresh active games every 10 seconds
    const interval = setInterval(loadActiveGames, 10000);
    return () => clearInterval(interval);
  }, []);

  // ==================== MAIN AUTO-REDIRECT LOGIC ====================
  useEffect(() => {
    // Don't auto-join if we're already in the process
    if (isAutoJoining || autoRedirected) return;
    
    // Check if there are any active games to join as spectator
    if (activeGames.length > 0 && !selectedNumber) {
      const now = Date.now();
      // Only attempt auto-join once every 5 seconds
      if (now - lastAutoJoinAttempt > 5000) {
        console.log('🎮 Active games available, redirecting as spectator...');
        setLastAutoJoinAttempt(now);
        setIsAutoJoining(true);
        
        // Redirect to the first active game as spectator
        setTimeout(() => {
          router.push(`/game/${activeGames[0]._id}?spectator=true`);
          setAutoRedirected(true);
        }, 1000);
      }
      return;
    }
    
    // Check if conditions are met for auto-joining with card
    const conditionsMet = 
      cardSelectionStatus.timeRemaining <= 0 && 
      cardSelectionStatus.isSelectionActive && 
      selectedNumber && 
      effectiveWalletBalance >= 10 &&
      !hasRestartCooldown &&
      playersWithCards >= 2;
    
    if (conditionsMet && !isAutoJoining && !autoRedirected) {
      console.log('🚀 All conditions met for auto-join!');
      setIsAutoJoining(true);
      handleAutoJoinGame();
    }
  }, [
    activeGames,
    cardSelectionStatus.timeRemaining,
    cardSelectionStatus.isSelectionActive,
    selectedNumber,
    effectiveWalletBalance,
    hasRestartCooldown,
    playersWithCards,
    isAutoJoining,
    autoRedirected,
    lastAutoJoinAttempt
  ]);

  // ==================== AUTO-START CHECK ====================
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (gameStatus === 'WAITING_FOR_PLAYERS' && gameData?._id && !hasRestartCooldown) {
      intervalId = setInterval(async () => {
        try {
          console.log('🔄 Checking auto-start conditions...');
          
          const response = await gameAPI.checkAutoStart(gameData._id);
          
          if (response.data.success) {
            console.log('🎮 Auto-start check response:', response.data);
            
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
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gameStatus, gameData?._id, checkGameStatus, hasRestartCooldown]);

  // ==================== AUTO-JOIN FUNCTION ====================
  const handleAutoJoinGame = async () => {
    if (!selectedNumber || !user?.id || hasRestartCooldown || isAutoJoining) return;
    
    try {
      console.log('🤖 Auto-joining game...');
      
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        console.log('🎯 Joining waiting game:', game._id);
        
        const participantsResponse = await gameAPI.getGameParticipants(game._id);
        const currentPlayersWithCards = participantsResponse.data.participants?.filter(p => p.hasCard).length || 0;
        
        if (currentPlayersWithCards < 2) {
          console.log(`❌ Not enough players to join (${currentPlayersWithCards}/2)`);
          setJoinError(`Need ${2 - currentPlayersWithCards} more player(s) to start the game`);
          setIsAutoJoining(false);
          return;
        }
        
        const joinResponse = await gameAPI.joinGame(game.code, user.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          console.log('✅ Auto-joined game successfully');
          setAutoRedirected(true);
          
          // Redirect to game page
          setTimeout(() => {
            router.push(`/game/${updatedGame._id}`);
          }, 1000);
        } else {
          console.log('⚠️ Auto-join failed, redirecting to watch');
          setAutoRedirected(true);
          setTimeout(() => {
            router.push(`/game/${game._id}?spectator=true`);
          }, 1000);
        }
      } else {
        // No waiting games, check active games
        const activeGamesResponse = await gameAPI.getActiveGames();
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          console.log('🎯 No waiting games, joining active game as spectator');
          setAutoRedirected(true);
          setTimeout(() => {
            router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
          }, 1000);
        } else {
          console.log('❌ No games available');
          setJoinError('No games available at the moment');
          setIsAutoJoining(false);
        }
      }
    } catch (error: any) {
      console.error('Auto-join failed:', error);
      setIsAutoJoining(false);
      
      // Try to join as spectator if join fails
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        setAutoRedirected(true);
        setTimeout(() => {
          router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
        }, 1000);
      }
    }
  };

  // ==================== FIXED: GAME INFO FOOTER MESSAGE ====================
  const getGameStatusMessage = () => {
    if (hasRestartCooldown) {
      return `🔄 Game restarting in ${Math.ceil(restartCooldownRemaining / 1000)}s - Select your card now!`;
    }

    if (isAutoJoining) {
      return '🚀 Joining game automatically...';
    }

    if (!selectedNumber && effectiveWalletBalance >= 10) {
      switch (gameStatus) {
        case 'WAITING_FOR_PLAYERS':
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
      if (playersWithCards < 2) {
        return `⏳ Waiting for ${2 - playersWithCards} more player(s)...`;
      }
      
      switch (gameStatus) {
        case 'WAITING_FOR_PLAYERS':
          return `✅ Ready! Auto-joining when game starts...`;
        case 'ACTIVE':
          return '🚀 Auto-joining active game...';
        case 'FINISHED':
          return `🔄 Card ${selectedNumber} reserved for next game`;
        default:
          return `✅ Card ${selectedNumber} selected - Auto-joining...`;
      }
    }

    return '';
  };

  // ==================== CONDITIONAL GAME INFO DISPLAY ====================
  const shouldDisplayGameInfo = () => {
    if (gameStatus === 'ACTIVE') {
      return true;
    }
    
    if (gameStatus === 'WAITING_FOR_PLAYERS' && playersWithCards >= 2) {
      return true;
    }
    
    return false;
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
        
        await initializeGameState();
        
        console.log('✅ App initialization complete');
        console.log(`💰 User balance: ${effectiveWalletBalance} ብር`);
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

  // Auto-join loading screen
  if (isAutoJoining) {
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
            {selectedNumber 
              ? `Auto-joining with Card #${selectedNumber}`
              : 'Redirecting to watch live game'}
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-300"></div>
          </div>
        </motion.div>

        {selectedNumber && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <BingoCardPreview cardNumber={selectedNumber} numbers={bingoCard!} />
          </div>
        )}
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

      {/* ACTIVE GAMES SECTION */}
      {activeGames.length > 0 && (
        <motion.div 
          className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-blue-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-300" />
              <h3 className="text-blue-300 font-bold">Active Games</h3>
            </div>
            <span className="text-blue-200 text-sm bg-blue-500/30 px-2 py-1 rounded-full">
              {activeGames.length} live game{activeGames.length > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="space-y-3">
            {activeGames.map((game) => (
              <div 
                key={game._id}
                className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-3 border border-blue-400/20"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white font-medium">Game #{game.code}</div>
                    <div className="text-blue-200 text-xs flex items-center gap-2 mt-1">
                      <Users className="w-3 h-3" />
                      <span>{game.currentPlayers || 0} players</span>
                      <span>•</span>
                      <span>{game.numbersCalled?.length || 0}/75 numbers called</span>
                    </div>
                  </div>
                  <div className="text-blue-300 text-xs px-3 py-1 bg-blue-500/20 rounded-full">
                    Watching automatically...
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-blue-200 text-xs mt-3 text-center">
            👁️ You will be automatically redirected to watch live games
          </p>
        </motion.div>
      )}

      {/* BALANCE WARNING */}
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

      {/* PLAYERS COUNT WARNING */}
      {gameStatus === 'WAITING_FOR_PLAYERS' && playersWithCards < 2 && (
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

      {/* CONDITIONAL GAME INFO DISPLAY */}
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
        /* LIMITED GAME INFO FOR NON-ACTIVE GAMES */
        <motion.div 
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/20"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center">
            <div className="mb-3">
              <div className="text-white/70 text-sm mb-1">Game Status</div>
              <div className={`px-4 py-1 rounded-full inline-block ${
                gameStatus === 'WAITING_FOR_PLAYERS' ? 'bg-yellow-500/20 text-yellow-300' :
                gameStatus === 'FINISHED' ? 'bg-orange-500/20 text-orange-300' :
                'bg-purple-500/20 text-purple-300'
              }`}>
                {gameStatus === 'WAITING_FOR_PLAYERS' ? '⏳ Waiting for players' :
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
            isAutoJoining ? 'text-green-300' :
            hasRestartCooldown ? 'text-purple-300' :
            gameStatus === 'WAITING_FOR_PLAYERS' ? 'text-blue-300' :
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
          
          {/* Auto-redirect info */}
          <div className="mt-3 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-blue-300 text-xs text-center mb-1">
              🤖 <span className="font-bold">Automatic Join</span>
            </p>
            <p className="text-blue-200 text-xs text-center">
              You will be automatically redirected when conditions are met
            </p>
          </div>
          
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
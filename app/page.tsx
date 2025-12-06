/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx - FIXED VERSION (Auto-join immediately when conditions met)
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

// Import hooks
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, AlertCircle, RefreshCw, Users } from 'lucide-react';

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
  
  // Use refs to track state without causing re-renders
  const isAutoJoiningRef = useRef(false);
  const autoRedirectedRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
  const [gameParticipants, setGameParticipants] = useState<any[]>([]);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);
  const [canStartGame, setCanStartGame] = useState<boolean>(false);

  // Balance refresh states
  const [localWalletBalance, setLocalWalletBalance] = useState<number>(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);

  // Restart cooldown states
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [restartCooldownRemaining, setRestartCooldownRemaining] = useState<number>(0);

  // Auto-join tracking - local state for UI
  const [isAutoJoining, setIsAutoJoining] = useState<boolean>(false);

  // ==================== MEMOIZED FUNCTIONS ====================
  // const refreshWalletBalanceLocal = useCallback(async () => {
  //   try {
  //     setIsRefreshingBalance(true);
      
  //     if (refreshWalletBalance) {
  //       await refreshWalletBalance();
  //     }
      
  //     const walletResponse = await walletAPIAuto.getBalance();
  //          if (walletResponse.data.success) {
  //            setLocalWalletBalance(walletResponse.data.balance);
  //          }
      
    
  //   } catch (error) {
  //     console.error('❌ Failed to refresh wallet balance:', error);
  //   } finally {
  //     setIsRefreshingBalance(false);
  //   }
  // }, [refreshWalletBalance]);

  // ==================== USE CORRECT BALANCE SOURCE ====================
  const effectiveWalletBalance = localWalletBalance > 0 ? localWalletBalance : walletBalance;

  // ==================== CHECK FOR ACTIVE GAMES ====================
  const checkAndRedirectToActiveGames = useCallback(async () => {
    if (isAutoJoiningRef.current || autoRedirectedRef.current || selectedNumber) return;
    
    try {
      const response = await gameAPI.getActiveGames();
      
      if (response.data.success && response.data.games.length > 0) {
        const activeGame = response.data.games.find((game: any) => game.status === 'ACTIVE');
        
        if (activeGame) {
          console.log('🎮 Redirecting to active game as spectator');
          isAutoJoiningRef.current = true;
          autoRedirectedRef.current = true;
          setIsAutoJoining(true);
          
          router.push(`/game/${activeGame._id}?spectator=true`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to check active games:', error);
    }
  }, [selectedNumber, router]);

  // ==================== FIXED: SIMPLIFIED AUTO-JOIN FUNCTION ====================
  const handleAutoJoinGame = useCallback(async () => {
    if (!selectedNumber || !user?.id || hasRestartCooldown || isAutoJoiningRef.current) {
      console.log('Auto-join conditions not met:', {
        selectedNumber,
        userId: user?.id,
        hasRestartCooldown,
        isAutoJoining: isAutoJoiningRef.current
      });
      return;
    }
    
    try {
      console.log('🤖 Attempting auto-join...');
      isAutoJoiningRef.current = true;
      setIsAutoJoining(true);
      
      // 1. First check if there are any waiting games
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      console.log('Waiting games:', waitingGamesResponse.data);
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const waitingGame = waitingGamesResponse.data.games[0];
        console.log('🎯 Found waiting game:', waitingGame._id);
        
        // Join the waiting game
        const joinResponse = await gameAPI.joinGame(waitingGame.code, user.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          console.log('✅ Successfully joined waiting game:', updatedGame._id);
          autoRedirectedRef.current = true;
          
          // Redirect to the game page
          router.push(`/game/${updatedGame._id}`);
          return;
        }
      }
      
      // 2. If no waiting games, check for active games
      const activeGamesResponse = await gameAPI.getActiveGames();
      console.log('Active games:', activeGamesResponse.data);
      
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        const activeGame = activeGamesResponse.data.games[0];
        console.log('🎮 Found active game, joining as participant:', activeGame._id);
        
        // Try to join as participant
        try {
          const joinResponse = await gameAPI.joinGame(activeGame.code, user.id);
          
          if (joinResponse.data.success) {
            const updatedGame = joinResponse.data.game;
            console.log('✅ Successfully joined active game:', updatedGame._id);
            autoRedirectedRef.current = true;
            
            router.push(`/game/${updatedGame._id}`);
            return;
          }
        } catch (joinError) {
          console.log('⚠️ Could not join as participant, trying as spectator');
        }
        
        // If can't join as participant, join as spectator
        console.log('👁️ Joining as spectator');
        autoRedirectedRef.current = true;
        router.push(`/game/${activeGame._id}?spectator=true`);
        return;
      }
      
      // 3. If no games at all, create a new waiting game
      console.log('🆕 No games found, creating new waiting game');
      
      // Generate a unique game code
      // const gameCode = `GAME${Math.floor(1000 + Math.random() * 9000)}`;
      
      // const createResponse = await gameAPI.createGame({
      //   name: `Bingo Game ${gameCode}`,
      //   code: gameCode,
      //   status: 'WAITING_FOR_PLAYERS',
      //   entryFee: 10,
      //   maxPlayers: 400,
      //   minPlayers: 2
      // });
      
      // if (createResponse.data.success) {
      //   const newGame = createResponse.data.game;
      //   console.log('✅ Created new waiting game:', newGame._id);
        
      //   // Join the new game
      //   const joinResponse = await gameAPI.joinGame(newGame.code, user.id);
        
      //   if (joinResponse.data.success) {
      //     const updatedGame = joinResponse.data.game;
      //     console.log('✅ Successfully joined new game:', updatedGame._id);
      //     autoRedirectedRef.current = true;
          
      //     router.push(`/game/${updatedGame._id}`);
      //     return;
      //   }
      // }
      
      console.log('❌ Failed to create or join any game');
      setJoinError('Failed to join any game. Please try again.');
      
    } catch (error: any) {
      console.error('Auto-join failed:', error);
      setJoinError(error.response?.data?.message || 'Failed to join game');
    } finally {
      isAutoJoiningRef.current = false;
      setIsAutoJoining(false);
    }
  }, [selectedNumber, user?.id, hasRestartCooldown, router]);

  // ==================== UPDATE RESTART COOLDOWN FROM GAME DATA ====================
  useEffect(() => {
    if (gameData) {
      const cooldown = gameData.hasRestartCooldown || false;
      const cooldownRemaining = gameData.restartCooldownRemaining || 0;
      
      setHasRestartCooldown(cooldown);
      setRestartCooldownRemaining(cooldownRemaining);
    }
  }, [gameData]);

  // ==================== FETCH GAME PARTICIPANTS ====================
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
            
            console.log('👥 Game participants:', {
              total: participants.length,
              withCards: playersWithCardsCount,
              canStart: canStart
            });
          }
        } catch (error) {
          console.error('❌ Failed to fetch game participants:', error);
        }
      }
    };

    fetchGameParticipants();
    
    const interval = setInterval(fetchGameParticipants, 5000); // Every 5 seconds
    
    return () => clearInterval(interval);
  }, [gameData?._id]);

  // ==================== FIXED: MAIN AUTO-JOIN TRIGGER ====================
  useEffect(() => {
    if (isAutoJoiningRef.current || autoRedirectedRef.current) return;
    
    console.log('🔍 Checking auto-join conditions:', {
      selectedNumber,
      effectiveWalletBalance,
      hasRestartCooldown,
      playersWithCards,
      gameStatus
    });
    
    // Check if conditions are met for auto-joining
    const conditionsMet = 
      selectedNumber && 
      effectiveWalletBalance >= 10 &&
      !hasRestartCooldown;
    
    if (conditionsMet) {
      console.log('🚀 Auto-join conditions met! Triggering auto-join...');
      
      // Don't wait for minimum players - just try to join immediately
      // The game will handle waiting for other players
      handleAutoJoinGame();
    }
  }, [
    selectedNumber,
    effectiveWalletBalance,
    hasRestartCooldown,
    playersWithCards,
    gameStatus,
    handleAutoJoinGame
  ]);

  // ==================== CHECK FOR ACTIVE GAMES ====================
  useEffect(() => {
    if (isAutoJoiningRef.current || autoRedirectedRef.current || selectedNumber) return;
    
    checkAndRedirectToActiveGames();
    
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    checkIntervalRef.current = setInterval(() => {
      checkAndRedirectToActiveGames();
    }, 5000);
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [checkAndRedirectToActiveGames, selectedNumber]);

  // ==================== MAIN INITIALIZATION ====================
  useEffect(() => {
    const initializeApp = async () => {
      if (authLoading) return;

      if (!isAuthenticated || !user) {
        await initializeGameState();
        return;
      }

      try {
      //  await refreshWalletBalanceLocal();
        await initializeGameState();
        
        console.log('✅ App initialization complete');
        console.log('💰 User balance:', effectiveWalletBalance, 'ብር');
      } catch (error) {
        console.error('❌ Initialization error:', error);
      }
    };

    initializeApp();
  }, [authLoading, isAuthenticated, user, initializeGameState,]);

  // ==================== PERIODIC BALANCE REFRESH ====================
  useEffect(() => {
    const intervalId = setInterval(() => {
   //   refreshWalletBalanceLocal();
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
              <p className="text-white/60 text-sm">Joining Game</p>
            </div>
            <UserInfoDisplay user={user} userRole={userRole} />
          </div>
        </div>

        <div className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-green-500/30">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-300"></div>
            <p className="text-white font-bold text-xl">Joining Game...</p>
          </div>
          <p className="text-green-200 text-center mb-4">
            {selectedNumber 
              ? `Joining with Card #${selectedNumber}`
              : 'Looking for available games...'}
          </p>
          <div className="text-center text-green-300 text-sm">
            <Users className="inline-block w-4 h-4 mr-2" />
            {playersWithCards >= 2 ? (
              <span>✅ Enough players to start!</span>
            ) : (
              <span>⏳ Waiting for other players... ({playersWithCards}/2)</span>
            )}
          </div>
        </div>

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
      {/* Navbar */}
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
          
          {/* User Info */}
          <div className="flex items-center gap-3">
            <UserInfoDisplay user={user} userRole={userRole} />
            <div className="text-white/70 text-xs bg-white/10 px-3 py-1.5 rounded-full">
              {effectiveWalletBalance} ብር
            </div>
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

      {/* PLAYERS STATUS */}
      {selectedNumber && (
        <motion.div 
          className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-blue-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-300" />
              <p className="text-blue-300 font-bold text-sm">
                Game Status
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              playersWithCards >= 2 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              {playersWithCards >= 2 ? 'Ready to Start' : 'Waiting for Players'}
            </div>
          </div>
          
          <div className="mt-2">
            <div className="flex justify-between text-xs text-blue-200 mb-1">
              <span>Players with cards:</span>
              <span>{playersWithCards}/2</span>
            </div>
            <div className="w-full bg-blue-400/20 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(playersWithCards / 2) * 100}%` 
                }}
              />
            </div>
          </div>
          
          {playersWithCards < 2 && (
            <p className="text-blue-200 text-xs mt-2 text-center">
              Need {2 - playersWithCards} more player(s) to start the game
            </p>
          )}
        </motion.div>
      )}

      {/* CARD SELECTION STATUS */}
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
              <Clock className="w-4 h-4" />
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
                ? `${Math.ceil(restartCooldownRemaining / 1000)}s`
                : hasAutoStartTimer 
                  ? `${Math.ceil(autoStartTimeRemaining / 1000)}s`
                  : `${Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s`
              }
            </p>
          </div>
          
          {hasRestartCooldown && (
            <div className="mt-2">
              <div className="w-full bg-purple-400/20 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${((60000 - restartCooldownRemaining) / 60000) * 100}%` 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-purple-200 mt-1">
                <span>Next game starts in {Math.ceil(restartCooldownRemaining / 1000)}s</span>
                <span>{playersWithCards}/2 players ready</span>
              </div>
            </div>
          )}
          
          {hasAutoStartTimer && (
            <div className="mt-2">
              <div className="w-full bg-orange-400/20 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-orange-400 to-red-400 h-2 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${((30000 - autoStartTimeRemaining) / 30000) * 100}%` 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-orange-200 mt-1">
                <span>Game starting in {Math.ceil(autoStartTimeRemaining / 1000)}s</span>
                <span>{playersWithCards}/2 players ready</span>
              </div>
            </div>
          )}
          
          {!hasRestartCooldown && !hasAutoStartTimer && (
            <div className="mt-2">
              <div className="w-full bg-green-400/20 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${((30000 - cardSelectionStatus.timeRemaining) / 30000) * 100}%` 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-green-200 mt-1">
                <span>Choose card in {Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s</span>
                <span>{takenCards.length}/400 cards</span>
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

      {/* GAME STATUS INFO */}
      <motion.div 
        className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center">
          <div className="mb-3">
            <div className={`px-4 py-2 rounded-full inline-block ${
              gameStatus === 'WAITING' ? 'bg-yellow-500/20 text-yellow-300' :
              gameStatus === 'ACTIVE' ? 'bg-green-500/20 text-green-300' :
              gameStatus === 'FINISHED' ? 'bg-orange-500/20 text-orange-300' :
              'bg-purple-500/20 text-purple-300'
            }`}>
              {gameStatus === 'WAITING' ? '⏳ Waiting for players' :
               gameStatus === 'ACTIVE' ? '🚀 Game Active' :
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
              <div className="text-white font-bold">{currentPlayers || 0}</div>
              <div className="text-white/60 text-xs">Total Players</div>
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
          
          {playersWithCards < 2 && gameStatus === 'WAITING' && (
            <div className="mt-3 p-2 bg-yellow-500/10 rounded-lg">
              <p className="text-yellow-300 text-xs">
                Need {2 - playersWithCards} more player(s) to start
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Card Selection Grid */}
      <CardSelectionGrid
        availableCards={availableCards}
        takenCards={takenCards}
        selectedNumber={selectedNumber}
        walletBalance={effectiveWalletBalance}
        gameStatus={gameStatus}
        onCardSelect={handleCardSelect}
      />

      {/* Selected Card Preview */}
      {selectedNumber && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div 
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mt-4 border border-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-white font-bold text-sm mb-3 text-center">Card #{selectedNumber}</h3>
            
            <div className="grid grid-cols-5 gap-2 mb-4">
              {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                <div key={letter} className="text-center">
                  <div className="text-telegram-button font-bold text-lg">{letter}</div>
                  <div className="text-white/60 text-xs">Column</div>
                </div>
              ))}
            </div>

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
            <p className="text-white font-bold">Auto</p>
            <p className="text-white/60 text-xs">Game Start</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-white/60 text-xs text-center">
            Games restart automatically 60 seconds after completion
          </p>
          <p className="text-white/40 text-xs text-center">
            Minimum 2 players required to start the game
          </p>
        </div>
      </motion.div>
    </div>
  );
}
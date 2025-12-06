/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx - IMMEDIATE AUTO-REDIRECT VERSION
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

// Import hooks
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';
import { Clock, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [autoRedirected, setAutoRedirected] = useState<boolean>(false);
  const [gameParticipants, setGameParticipants] = useState<any[]>([]);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);
  const [canStartGame, setCanStartGame] = useState<boolean>(false);
  const [activeGames, setActiveGames] = useState<any[]>([]);

  // Balance refresh states
  const [localWalletBalance, setLocalWalletBalance] = useState<number>(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);

  // Restart cooldown states
  const [hasRestartCooldown, setHasRestartCooldown] = useState<boolean>(false);
  const [restartCooldownRemaining, setRestartCooldownRemaining] = useState<number>(0);

  // Auto-join tracking
  const [isAutoJoining, setIsAutoJoining] = useState<boolean>(false);

  // ==================== REFRESH WALLET BALANCE FUNCTION ====================
  const refreshWalletBalanceLocal = async () => {
    try {
      setIsRefreshingBalance(true);
      console.log('💰 Refreshing wallet balance...');
      
      if (refreshWalletBalance) {
        await refreshWalletBalance();
        console.log('✅ Used AuthContext refreshWalletBalance');
      }
      
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

  // ==================== CHECK AND REDIRECT TO ACTIVE GAMES ====================
  const checkAndRedirectToActiveGames = async () => {
    if (isAutoJoining || autoRedirected) return;
    
    try {
      console.log('🔍 Checking for active games...');
      const response = await gameAPI.getActiveGames();
      
      if (response.data.success && response.data.games.length > 0) {
        console.log('🎮 Active games found, redirecting...');
        setIsAutoJoining(true);
        setAutoRedirected(true);
        
        // Redirect to the first active game as spectator
        setTimeout(() => {
          router.push(`/game/${response.data.games[0]._id}?spectator=true`);
        }, 500);
      }
    } catch (error) {
      console.error('❌ Failed to check active games:', error);
    }
  };

  // ==================== MAIN AUTO-REDIRECT LOGIC ====================
  useEffect(() => {
    // Don't auto-join if we're already in the process
    if (isAutoJoining || autoRedirected) return;
    
    // Check for active games immediately
    checkAndRedirectToActiveGames();
    
    // Set up interval to check for active games regularly
    const intervalId = setInterval(() => {
      checkAndRedirectToActiveGames();
    }, 3000); // Check every 3 seconds
    
    return () => clearInterval(intervalId);
  }, [isAutoJoining, autoRedirected]);

  // ==================== AUTO-START CHECK ====================
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (gameStatus === 'WAITING' && gameData?._id && !hasRestartCooldown) {
      intervalId = setInterval(async () => {
        try {
          console.log('🔄 Checking auto-start conditions...');
          
          const response = await gameAPI.checkAutoStart(gameData._id);
          
          if (response.data.success) {
            if (response.data.gameStarted) {
              console.log('🚀 Game auto-started!');
              await checkGameStatus();
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
      setIsAutoJoining(true);
      
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
          }, 500);
        } else {
          console.log('⚠️ Auto-join failed');
          setIsAutoJoining(false);
        }
      } else {
        console.log('❌ No waiting games available');
        setIsAutoJoining(false);
      }
    } catch (error: any) {
      console.error('Auto-join failed:', error);
      setIsAutoJoining(false);
    }
  };

  // ==================== AUTO-JOIN WHEN CONDITIONS MET ====================
  useEffect(() => {
    if (isAutoJoining || autoRedirected) return;
    
    // Check if conditions are met for auto-joining with card
    const conditionsMet = 
      cardSelectionStatus.timeRemaining <= 0 && 
      cardSelectionStatus.isSelectionActive && 
      selectedNumber && 
      effectiveWalletBalance >= 10 &&
      !hasRestartCooldown &&
      playersWithCards >= 2;
    
    if (conditionsMet) {
      console.log('🚀 All conditions met for auto-join!');
      handleAutoJoinGame();
    }
  }, [
    cardSelectionStatus.timeRemaining,
    cardSelectionStatus.isSelectionActive,
    selectedNumber,
    effectiveWalletBalance,
    hasRestartCooldown,
    playersWithCards,
    isAutoJoining,
    autoRedirected
  ]);

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

        <div className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-green-500/30">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-300"></div>
            <p className="text-white font-bold text-xl">Joining Game...</p>
          </div>
          <p className="text-green-200 text-center mb-4">
            {selectedNumber 
              ? `Auto-joining with Card #${selectedNumber}`
              : 'Redirecting to watch live game'}
          </p>
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
// app/page.tsx - COMPLETE FIXED VERSION
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
import { Clock, Play, Check, Rocket } from 'lucide-react';

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

  // ==================== MISSING AUTO-JOIN LOGIC ====================
  // Add this useEffect to trigger auto-join when time reaches 0
  useEffect(() => {
    console.log('🔍 Auto-join condition check:', {
      timeRemaining: cardSelectionStatus.timeRemaining,
      isSelectionActive: cardSelectionStatus.isSelectionActive,
      selectedNumber: selectedNumber,
      walletBalance: walletBalance,
      allConditionsMet: cardSelectionStatus.timeRemaining <= 0 && 
                       cardSelectionStatus.isSelectionActive && 
                       selectedNumber && 
                       walletBalance >= 10
    });

    // Auto-join when ALL conditions are met
    if (cardSelectionStatus.timeRemaining <= 0 && 
        cardSelectionStatus.isSelectionActive && 
        selectedNumber && 
        walletBalance >= 10) {
      
      console.log('🚀 All auto-join conditions met! Triggering auto-join...');
      handleAutoJoinGame();
    }
  }, [cardSelectionStatus.timeRemaining, cardSelectionStatus.isSelectionActive, selectedNumber, walletBalance]);

  // ==================== ENHANCED AUTO-JOIN FUNCTION ====================
// Add this useEffect to check auto-start periodically
useEffect(() => {
  let intervalId: NodeJS.Timeout;

  // Only check auto-start if game is waiting
  if (gameStatus === 'WAITING' && gameData?._id) {
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
            // Update UI with auto-start countdown if available
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
}, [gameStatus, gameData?._id, checkGameStatus]);
 // ==================== FIXED AUTO-JOIN FUNCTION ====================
  const handleAutoJoinGame = async () => {
    if (!selectedNumber || !user?.id) return;

    try {
      console.log('🤖 Auto-joining game...');
      
      // Set showGameView to true to trigger the loading screen
      setShowGameView(true);
      
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        console.log('🎯 Joining waiting game:', game._id);
        
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

  // Admin control handlers (keep existing)
  const handleStartGame = async () => {
    if (hasPermission('manage_games')) {
      try {
        if (!gameData?._id) return;
        
        const response = await gameAPI.startGame(gameData._id);
        
        if (response.data.success) {
          console.log('🔄 Admin starting game...');
          await checkGameStatus();
        }
      } catch (error) {
        console.error('❌ Failed to start game by admin:', error);
        setJoinError('Failed to start game');
      }
    }
  };

  const handleEndGame = () => {
    if (hasPermission('manage_games')) {
      console.log('🛑 Admin ending game...');
    }
  };

  const handleManageUsers = () => {
    if (hasPermission('manage_users')) {
      console.log('👥 Admin managing users...');
    }
  };

  const handleModerateGames = () => {
    if (hasPermission('moderate_games')) {
      console.log('🛡️ Moderator moderating games...');
    }
  };

  const handleViewReports = () => {
    if (hasPermission('view_reports')) {
      console.log('📊 Moderator viewing reports...');
    }
  };

  const handleJoinGame = async () => {
    if (!selectedNumber || !user?.id) return;

    setJoining(true);
    setJoinError('');

    try {
      if (walletBalance < 10) {
        setJoinError('Insufficient balance. Minimum 10 ብር required to play.');
        setJoining(false);
        setTimeout(() => {
          handleJoinAsSpectator();
        }, 2000);
        return;
      }

      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
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

  // Main initialization
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
        await initializeGameState();
        console.log('✅ App initialization complete');
      } catch (error) {
        console.error('❌ Initialization error:', error);
      }
    };

    initializeApp();
  }, [authLoading, isAuthenticated, user]);

  // Auto-join when game view is shown
  useEffect(() => {
    if (showGameView && selectedNumber && walletBalance >= 10) {
      const timer = setTimeout(() => {
        handleAutoJoinGame();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showGameView, selectedNumber, walletBalance]);

  // Auto-join loading screen (keep existing)
  if (showGameView && selectedNumber && walletBalance >= 10) {
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
      {/* Updated Navbar with Role Info */}
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
          
          {/* User Info with Role Badge */}
          <UserInfoDisplay user={user} userRole={userRole} />
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <AdminControls 
          onStartGame={handleStartGame}
          onEndGame={handleEndGame}
          onManageUsers={handleManageUsers}
        />
      )}

      {/* Moderator Controls */}
      {isModerator && !isAdmin && (
        <ModeratorControls 
          onModerateGames={handleModerateGames}
          onViewReports={handleViewReports}
        />
      )}

      {/* Game Status Display - UPDATED WITH AUTO-START PROPS */}
      <GameStatusDisplay 
        gameStatus={gameStatus}
        currentPlayers={currentPlayers}
        restartCountdown={restartCountdown}
        selectedNumber={selectedNumber}
        walletBalance={walletBalance}
        shouldEnableCardSelection={shouldEnableCardSelection()} // CALL THE FUNCTION
        autoStartTimeRemaining={autoStartTimeRemaining}
        hasAutoStartTimer={hasAutoStartTimer}
      />

      {/* AUTO-JOIN DIAGNOSTIC PANEL */}
      <div className="bg-purple-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-purple-500/30">
        <h3 className="text-purple-300 font-bold mb-3 text-center">🔍 Auto-Join Diagnostics</h3>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Condition 1: Card Selection Time */}
          <div className={`p-2 rounded-lg ${
            cardSelectionStatus.timeRemaining <= 0 
              ? 'bg-green-500/30 border border-green-400' 
              : 'bg-yellow-500/30 border border-yellow-400'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                cardSelectionStatus.timeRemaining <= 0 ? 'bg-green-400' : 'bg-yellow-400'
              }`} />
              <span className="font-medium">Time Remaining</span>
            </div>
            <p className="text-xs mt-1">
              {cardSelectionStatus.timeRemaining <= 0 
                ? '✅ Ready to join!' 
                : `${Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s remaining`
              }
            </p>
          </div>

          {/* Condition 2: Card Selection Active */}
          <div className={`p-2 rounded-lg ${
            cardSelectionStatus.isSelectionActive 
              ? 'bg-green-500/30 border border-green-400' 
              : 'bg-red-500/30 border border-red-400'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                cardSelectionStatus.isSelectionActive ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="font-medium">Selection Active</span>
            </div>
            <p className="text-xs mt-1">
              {cardSelectionStatus.isSelectionActive 
                ? '✅ Active' 
                : '❌ Not active'
              }
            </p>
          </div>

          {/* Condition 3: Card Selected */}
          <div className={`p-2 rounded-lg ${
            selectedNumber 
              ? 'bg-green-500/30 border border-green-400' 
              : 'bg-red-500/30 border border-red-400'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                selectedNumber ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="font-medium">Card Selected</span>
            </div>
            <p className="text-xs mt-1">
              {selectedNumber 
                ? `✅ Card #${selectedNumber}` 
                : '❌ No card selected'
              }
            </p>
          </div>

          {/* Condition 4: Sufficient Balance */}
          <div className={`p-2 rounded-lg ${
            walletBalance >= 10 
              ? 'bg-green-500/30 border border-green-400' 
              : 'bg-red-500/30 border border-red-400'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                walletBalance >= 10 ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="font-medium">Wallet Balance</span>
            </div>
            <p className="text-xs mt-1">
              {walletBalance >= 10 
                ? `✅ ${walletBalance} ብር` 
                : `❌ ${walletBalance} ብር (Need 10+)`
              }
            </p>
          </div>

          {/* Selection Time Progress */}
          <div className="col-span-2 p-2 rounded-lg bg-blue-500/30 border border-blue-400">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3 h-3 text-blue-300" />
              <span className="font-medium">Selection Time Progress</span>
            </div>
            <div className="w-full bg-blue-400/20 rounded-full h-2 mb-1">
              <div 
                className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full transition-all duration-1000"
                style={{ 
                  width: `${Math.max(0, ((30000 - cardSelectionStatus.timeRemaining) / 30000) * 100)}%` 
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-blue-200">
              <span>Started</span>
              <span>
                {cardSelectionStatus.timeRemaining > 0 
                  ? `${Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s left` 
                  : 'Time\'s up!'
                }
              </span>
              <span>30s total</span>
            </div>
          </div>
        </div>

        {/* Overall Status */}
        <div className={`mt-3 p-3 rounded-lg border ${
          cardSelectionStatus.timeRemaining <= 0 && 
          cardSelectionStatus.isSelectionActive && 
          selectedNumber && 
          walletBalance >= 10
            ? 'bg-green-500/30 border-green-400' 
            : 'bg-red-500/30 border-red-400'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                cardSelectionStatus.timeRemaining <= 0 && 
                cardSelectionStatus.isSelectionActive && 
                selectedNumber && 
                walletBalance >= 10
                  ? 'bg-green-400' 
                  : 'bg-red-400'
              }`} />
              <span className="font-bold">Auto-Join Status</span>
            </div>
            <span className={`text-sm font-medium ${
              cardSelectionStatus.timeRemaining <= 0 && 
              cardSelectionStatus.isSelectionActive && 
              selectedNumber && 
              walletBalance >= 10
                ? 'text-green-300' 
                : 'text-red-300'
            }`}>
              {cardSelectionStatus.timeRemaining <= 0 && 
              cardSelectionStatus.isSelectionActive && 
              selectedNumber && 
              walletBalance >= 10
                ? 'READY TO JOIN' 
                : 'NOT READY'
              }
            </span>
          </div>
          
          {/* Missing Conditions */}
          {!(cardSelectionStatus.timeRemaining <= 0 && 
            cardSelectionStatus.isSelectionActive && 
            selectedNumber && 
            walletBalance >= 10) && (
            <div className="mt-2 text-xs text-red-200">
              <p className="font-medium">Missing Conditions:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {cardSelectionStatus.timeRemaining > 0 && (
                  <li>Time remaining: {Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s</li>
                )}
                {!cardSelectionStatus.isSelectionActive && (
                  <li>Card selection is not active</li>
                )}
                {!selectedNumber && (
                  <li>No card selected</li>
                )}
                {walletBalance < 10 && (
                  <li>Insufficient balance: {walletBalance}/10 ብር</li>
                )}
              </ul>
            </div>
          )}

          {/* Auto-Join Countdown */}
          {cardSelectionStatus.timeRemaining > 0 && cardSelectionStatus.isSelectionActive && selectedNumber && walletBalance >= 10 && (
            <div className="mt-2 p-2 bg-blue-500/20 rounded border border-blue-400/50">
              <div className="flex items-center justify-between text-blue-200 text-xs">
                <span>Auto-join will trigger in:</span>
                <span className="font-bold">{Math.ceil(cardSelectionStatus.timeRemaining / 1000)} seconds</span>
              </div>
              <div className="w-full bg-blue-400/20 rounded-full h-1 mt-1">
                <div 
                  className="bg-blue-400 h-1 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${((30000 - cardSelectionStatus.timeRemaining) / 30000) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Auto-Join Triggered */}
          {cardSelectionStatus.timeRemaining <= 0 && cardSelectionStatus.isSelectionActive && selectedNumber && walletBalance >= 10 && (
            <div className="mt-2 p-2 bg-green-500/20 rounded border border-green-400/50">
              <div className="flex items-center justify-center gap-2 text-green-200 text-xs">
                <Play className="w-3 h-3" />
                <span className="font-bold">Auto-join triggered! Redirecting to game...</span>
              </div>
            </div>
          )}
        </div>

        {/* Manual Trigger for Testing */}
        {isAdmin && (
          <div className="mt-3 pt-3 border-t border-purple-400/30">
            <button
              onClick={handleAutoJoinGame}
              disabled={!selectedNumber || walletBalance < 10}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 text-white py-2 rounded-lg text-sm font-medium"
            >
              {selectedNumber && walletBalance >= 10 
                ? `Test Auto-Join (Card #${selectedNumber})` 
                : 'Cannot Test - Missing Requirements'
              }
            </button>
            <p className="text-purple-200 text-xs text-center mt-2">
              Admin test button - checks current conditions
            </p>
          </div>
        )}
      </div>

      {/* Rest of your existing JSX remains the same */}
      {/* Card Selection Status - UPDATED WITH AUTO-START */}
      {shouldEnableCardSelection() && cardSelectionStatus.isSelectionActive && (
        <motion.div 
          className={`backdrop-blur-lg rounded-2xl p-4 mb-4 border ${
            hasAutoStartTimer 
              ? 'bg-orange-500/20 border-orange-500/30' 
              : 'bg-green-500/20 border-green-500/30'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasAutoStartTimer ? (
                <Rocket className="w-4 h-4 text-orange-300" />
              ) : (
                <Clock className="w-4 h-4 text-green-300" />
              )}
              <p className={`font-bold text-sm ${
                hasAutoStartTimer ? 'text-orange-300' : 'text-green-300'
              }`}>
                {hasAutoStartTimer ? '🚀 Game Starting Soon!' : 'Card Selection Active'}
              </p>
            </div>
            <p className={`text-sm ${
              hasAutoStartTimer ? 'text-orange-200' : 'text-green-200'
            }`}>
              {hasAutoStartTimer 
                ? `${Math.ceil(autoStartTimeRemaining / 1000)}s to start`
                : `${Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s remaining`
              }
            </p>
          </div>
          
          {/* AUTO-START PROGRESS */}
          {hasAutoStartTimer && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-orange-200 mb-1">
                <span>Game will start automatically</span>
                <span>{currentPlayers}/2 players ready</span>
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
          {!hasAutoStartTimer && (
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

      {/* Card Selection Grid - ALWAYS VISIBLE */}
      <CardSelectionGrid
        availableCards={availableCards}
        takenCards={takenCards}
        selectedNumber={selectedNumber}
        walletBalance={walletBalance}
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
          {!selectedNumber && walletBalance >= 10 && (
            <>
              {gameStatus === 'WAITING' && (
                <p className="text-blue-300 text-sm text-center">
                  🎯 Select a card number to join the waiting game
                </p>
              )}
              {gameStatus === 'ACTIVE' && (
                <p className="text-green-300 text-sm text-center">
                  🚀 Game in progress - Select a card for late entry!
                </p>
              )}
              {gameStatus === 'FINISHED' && (
                <p className="text-orange-300 text-sm text-center">
                  🔄 Select a card for the next game (starting in {restartCountdown}s)
                </p>
              )}
              {gameStatus === 'RESTARTING' && (
                <p className="text-purple-300 text-sm text-center">
                  ⚡ New game starting soon - Select your card!
                </p>
              )}
            </>
          )}
          
          {!selectedNumber && walletBalance < 10 && (
            <p className="text-yellow-300 text-sm text-center">
              💡 Add balance to play - Watch mode available
            </p>
          )}
          
          {selectedNumber && walletBalance >= 10 && (
            <>
              {gameStatus === 'WAITING' && (
                <p className="text-blue-300 text-sm text-center">
                  ⏳ Ready! Game will start when enough players join
                </p>
              )}
              {gameStatus === 'ACTIVE' && (
                <p className="text-green-300 text-sm text-center">
                  🚀 Auto-joining active game with card #{selectedNumber}...
                </p>
              )}
              {gameStatus === 'FINISHED' && (
                <p className="text-orange-300 text-sm text-center">
                  🔄 Card #{selectedNumber} reserved for next game
                </p>
              )}
            </>
          )}
          
          <p className="text-white/60 text-xs text-center">
            Games restart automatically 30 seconds after completion
          </p>
          <p className="text-white/40 text-xs text-center">
            Minimum 2 players required to start the game
          </p>
        </div>
      </motion.div>
    </div>
  );
}
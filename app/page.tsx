/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx - ULTRA SIMPLIFIED VERSION
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI, walletAPIAuto } from '../services/api';
import { useRouter } from 'next/navigation';

// Import components
import { CardSelectionGrid } from '../components/bingo/CardSelectionGrid';
import { UserInfoDisplay } from '../components/user/UserInfoDisplay';
import { GameStatusDisplay } from '../components/game/GameStatusDisplay';
import { AlertCircle, RefreshCw } from 'lucide-react';

// Import hooks
import { useGameState } from '../hooks/useGameState';
import { useCardSelection } from '../hooks/useCardSelection';

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
    pageLoading,
    initializeGameState,
    autoStartTimeRemaining,
    hasAutoStartTimer,
    hasRestartCooldown,
    restartCooldownRemaining
  } = useGameState();

  const {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    shouldEnableCardSelection,
    handleCardSelect,
  } = useCardSelection(gameData, gameStatus);

  const [localWalletBalance, setLocalWalletBalance] = useState<number>(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);
  const [playersWithCards, setPlayersWithCards] = useState<number>(0);

  // ==================== IMMEDIATE REDIRECT FOR ACTIVE GAMES ====================
  useEffect(() => {
    // If game is active, redirect immediately
    if (gameStatus === 'ACTIVE' && gameData?._id) {
      console.log('🚨 Immediate redirect to active game:', gameData._id);
      router.push(`/game/${gameData._id}`);
    }
  }, [gameStatus, gameData, router]);

  // ==================== REFRESH WALLET BALANCE ====================
  const refreshWalletBalanceLocal = async () => {
    try {
      setIsRefreshingBalance(true);
      if (refreshWalletBalance) {
        await refreshWalletBalance();
      }
      const response = await walletAPIAuto.getBalance();
      setLocalWalletBalance(response.data.balance);
    } catch (error) {
      console.error('❌ Failed to refresh wallet balance:', error);
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  const effectiveWalletBalance = localWalletBalance > 0 ? localWalletBalance : walletBalance;

  // ==================== FETCH GAME PARTICIPANTS ====================
  useEffect(() => {
    const fetchGameParticipants = async () => {
      if (gameData?._id) {
        try {
          const response = await gameAPI.getGameParticipants(gameData._id);
          if (response.data.success) {
            const participants = response.data.participants || [];
            const playersWithCardsCount = participants.filter(p => p.hasCard).length;
            setPlayersWithCards(playersWithCardsCount);
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

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Starting app initialization...');
      
      if (authLoading) return;

      if (!isAuthenticated || !user) {
        await initializeGameState();
        return;
      }

      try {
        await refreshWalletBalanceLocal();
        await initializeGameState();
        console.log('✅ App initialization complete');
      } catch (error) {
        console.error('❌ Initialization error:', error);
      }
    };

    initializeApp();
  }, [authLoading, isAuthenticated, user, initializeGameState]);

  // ==================== SHOW LOADING SCREENS ====================
  // If game is active and we have game data, we'll redirect - show loading
  if (gameStatus === 'ACTIVE' && gameData?._id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl font-bold">Game in Progress!</p>
          <p className="mt-2">Redirecting you to the game...</p>
        </div>
      </div>
    );
  }

  // Show loading only when both auth and page are loading
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl font-bold">Loading Bingo Game...</p>
          <p>Initializing your game experience...</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER (ONLY FOR NON-ACTIVE GAMES) ====================
  // IMPORTANT: At this point, gameStatus is NOT 'ACTIVE'
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
          
          <div className="flex items-center gap-3">
            <UserInfoDisplay user={user} userRole={userRole} />
          </div>
        </div>
      </div>

      {/* BALANCE WARNING */}
      {effectiveWalletBalance < 10 && (
        <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-red-500/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-300" />
            <div className="flex-1">
              <p className="text-red-300 font-bold text-sm">Insufficient Balance</p>
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
        </div>
      )}

      {/* GAME STATUS DISPLAY */}
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

      {/* Card Selection Grid - ONLY show when game is NOT active */}
      <CardSelectionGrid
        availableCards={availableCards}
        takenCards={takenCards}
        selectedNumber={selectedNumber}
        walletBalance={effectiveWalletBalance}
        gameStatus={gameStatus}
        onCardSelect={handleCardSelect}
      />

      {/* Selected Card Preview - ONLY show when game is NOT active */}
      {selectedNumber && (
        <div className="mb-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mt-4 border border-white/20">
            <h3 className="text-white font-bold text-sm mb-3 text-center">Card Combination Details</h3>
            
            <div className="grid grid-cols-5 gap-2 mb-4">
              {['B', 'I', 'N', 'G', 'O'].map((letter) => (
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
          </div>
        </div>
      )}

      {/* Game Info Footer */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
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
          <p className={`text-sm text-center font-medium ${
            gameStatus === 'WAITING_FOR_PLAYERS' ? 'text-yellow-300' :
            gameStatus === 'FINISHED' ? 'text-orange-300' :
            'text-purple-300'
          }`}>
            {!selectedNumber && effectiveWalletBalance >= 10 
              ? '🎯 Select a card number to join the waiting game'
              : selectedNumber && effectiveWalletBalance >= 10
              ? `✅ Card ${selectedNumber} selected - Waiting for game to start`
              : effectiveWalletBalance < 10
              ? `💡 Add balance to play (Current: ${effectiveWalletBalance} ብር)`
              : 'Select your card number to play!'}
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
        </div>
      </div>
    </div>
  );
}
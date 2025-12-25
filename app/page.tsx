/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx - ULTRA SIMPLIFIED VERSION
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Use refs to prevent multiple initialization calls
  const initializedRef = useRef(false);
  const redirectingRef = useRef(false);
  const balanceRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const balanceCallCountRef = useRef(0);
  const lastBalanceUpdateRef = useRef<number>(0);

  // ==================== DEBOUNCED BALANCE REFRESH ====================
  const refreshWalletBalanceLocal = useCallback(async (force: boolean = false) => {
    // Prevent too many calls - limit to once per 5 seconds
    const now = Date.now();
    const timeSinceLastUpdate = now - lastBalanceUpdateRef.current;
    
    if (!force && timeSinceLastUpdate < 5000) {
      console.log('⏳ Skipping balance refresh - too soon');
      return;
    }

    // Clear any pending timeout
    if (balanceRefreshTimeoutRef.current) {
      clearTimeout(balanceRefreshTimeoutRef.current);
      balanceRefreshTimeoutRef.current = null;
    }

    try {
      setIsRefreshingBalance(true);
      
      // Use Promise.race with timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Balance fetch timeout')), 10000);
      });

      const balancePromise = walletAPIAuto.getBalance();
      const response = await Promise.race([balancePromise, timeoutPromise]) as any;
      
      if (response?.data?.balance !== undefined) {
        setLocalWalletBalance(response.data.balance);
        lastBalanceUpdateRef.current = Date.now();
        balanceCallCountRef.current++;
        console.log(`✅ Balance updated: ${response.data.balance} (call #${balanceCallCountRef.current})`);
      }

      // Also call the auth context refresh if available
      if (refreshWalletBalance && balanceCallCountRef.current % 3 === 0) {
        // Only call this every 3rd balance update to reduce load
        await refreshWalletBalance();
      }
    } catch (error) {
      console.error('❌ Failed to refresh wallet balance:', error);
      // Don't update the balance on error
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [refreshWalletBalance]);

  const effectiveWalletBalance = localWalletBalance > 0 ? localWalletBalance : walletBalance;

  // ==================== IMMEDIATE REDIRECT FOR ACTIVE GAMES ====================
  useEffect(() => {
    // Prevent multiple redirects
    if (redirectingRef.current) return;
    
    // If game is active and we have game data, redirect immediately
    if (gameStatus === 'ACTIVE' && gameData?._id) {
      console.log('🚨 Immediate redirect to active game:', gameData._id);
      redirectingRef.current = true;
      // Use replace instead of push to prevent going back
      router.replace(`/game/${gameData._id}`);
    }
  }, [gameStatus, gameData, router]);

  // ==================== OPTIMIZED FETCH GAME PARTICIPANTS ====================
  useEffect(() => {
    // Don't fetch if we're redirecting or if there's no game
    if (redirectingRef.current || !gameData?._id || gameStatus === 'ACTIVE') {
      return;
    }

    const fetchGameParticipants = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Participants fetch timeout')), 8000);
        });

        const participantsPromise = gameAPI.getGameParticipants(gameData._id);
        const response = await Promise.race([participantsPromise, timeoutPromise]) as any;
        
        if (response?.data?.success) {
          const participants = response.data.participants || [];
          const playersWithCardsCount = participants.filter((p: any) => p.hasCard).length;
          setPlayersWithCards(playersWithCardsCount);
        }
      } catch (error) {
        console.error('❌ Failed to fetch game participants:', error);
      }
    };

    fetchGameParticipants();
    
    // Use longer interval to reduce load
    const interval = setInterval(fetchGameParticipants, 10000); // Increased from 5s to 10s
    return () => clearInterval(interval);
  }, [gameData?._id, gameStatus]);

  // ==================== SINGLE INITIALIZATION ====================
  useEffect(() => {
    const initializeApp = async () => {
      // Prevent multiple initializations
      if (initializedRef.current) {
        console.log('⏩ Skipping re-initialization');
        return;
      }

      console.log('🚀 Starting app initialization...');
      
      if (authLoading) return;

      // If we're authenticated, don't reinitialize on auth changes
      if (!isAuthenticated || !user) {
        if (!initializedRef.current) {
          await initializeGameState();
          initializedRef.current = true;
        }
        return;
      }

      try {
        // Only initialize once
        if (!initializedRef.current) {
          // Initialize game state first (most important)
          await initializeGameState();
          
          // Then refresh balance with delay to spread out API calls
          setTimeout(() => {
            refreshWalletBalanceLocal();
          }, 1000);
          
          initializedRef.current = true;
          console.log('✅ App initialization complete');
        }
      } catch (error) {
        console.error('❌ Initialization error:', error);
        initializedRef.current = false; // Reset on error
      }
    };

    initializeApp();
    
    // Cleanup function
    return () => {
      // Reset refs on unmount
      initializedRef.current = false;
      redirectingRef.current = false;
      
      // Clear any pending timeouts
      if (balanceRefreshTimeoutRef.current) {
        clearTimeout(balanceRefreshTimeoutRef.current);
        balanceRefreshTimeoutRef.current = null;
      }
    };
  }, [authLoading, isAuthenticated, user, initializeGameState, refreshWalletBalanceLocal]);

  // Reset initialization when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      initializedRef.current = false;
    }
  }, [isAuthenticated]);

  // ==================== PERIODIC BALANCE CHECK ====================
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Check balance every 30 seconds, not constantly
    const interval = setInterval(() => {
      refreshWalletBalanceLocal();
    }, 30000); // 30 seconds
    
    return () => {
      clearInterval(interval);
      if (balanceRefreshTimeoutRef.current) {
        clearTimeout(balanceRefreshTimeoutRef.current);
      }
    };
  }, [isAuthenticated, user, refreshWalletBalanceLocal]);

  // ==================== SHOW LOADING SCREENS ====================
  // If game is active and we have game data, show redirect loading
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
                You need 10 ብር to play. Current: {effectiveWalletBalance.toFixed(2)} ብር
              </p>
            </div>
            <button
              onClick={() => refreshWalletBalanceLocal(true)} // Force refresh
              disabled={isRefreshingBalance}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-50 flex items-center gap-1 min-w-[100px]"
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
              ? `💡 Add balance to play (Current: ${effectiveWalletBalance.toFixed(2)} ብር)`
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
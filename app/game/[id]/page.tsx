/* eslint-disable @typescript-eslint/no-explicit-any */
// app/game/[id]/page.tsx - FIXED VERSION (No page reload, proper spectator mode)
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../../../hooks/useGame';
import { walletAPIAuto, gameAPI } from '../../../services/api';
import { AnimatePresence, motion } from 'framer-motion';

// Types
interface LocalBingoCard {
  cardNumber?: number;
  numbers: (number | string)[][];
  markedPositions: number[];
  selected?: boolean[][];
  id?: string;
  _id?: string;
  cardIndex?: number;
}

interface WinnerInfo {
  winner: {
    _id: string;
    username: string;
    firstName: string;
    telegramId?: string;
  };
  gameCode: string;
  endedAt: string;
  totalPlayers: number;
  numbersCalled: number;
  winningPattern?: string;
  winningCard?: {
    cardNumber: number;
    numbers: (number | string)[][];
    markedPositions: number[];
    winningPatternPositions?: number[];
  };
}

interface Game {
  _id: string;
  code: string;
  status: string;
  currentPlayers: number;
  numbersCalled: number[];
  winnerId?: string;
  startedAt?: Date;
  endedAt?: Date;
  players?: any[];
  potAmount?: number;
  message?: string;
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  
  const { 
    game, 
    bingoCard: gameBingoCard, 
    gameState, 
    isLoading,
    error: gameError,
    manualCallNumber,
    getWinnerInfo,
  } = useGame(id);
  
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [localBingoCard, setLocalBingoCard] = useState<LocalBingoCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState<boolean>(true);
  const [cardError, setCardError] = useState<string>('');
  const [isMarking, setIsMarking] = useState<boolean>(false);
  
  // Enhanced state for called numbers
  const [currentCalledNumber, setCurrentCalledNumber] = useState<{
    number: number;
    letter: string;
    isNew?: boolean;
  } | null>(null);
  
  const [allCalledNumbers, setAllCalledNumbers] = useState<number[]>([]);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Winner modal state
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<WinnerInfo | null>(null);
  const [isWinnerLoading, setIsWinnerLoading] = useState(false);
  const [isUserWinner, setIsUserWinner] = useState(false);
  const [winningAmount, setWinningAmount] = useState(0);
  const [countdown, setCountdown] = useState<number>(5);
  
  // State for bingo claiming
  const [isClaimingBingo, setIsClaimingBingo] = useState<boolean>(false);
  const [claimResult, setClaimResult] = useState<{
    success: boolean;
    message: string;
    patternType?: string;
    prizeAmount?: number;
  } | null>(null);

  // Spectator mode state
  const [isSpectatorMode, setIsSpectatorMode] = useState<boolean>(false);
  const [spectatorMessage, setSpectatorMessage] = useState<string>('');

  // Refs
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameEndedCheckRef = useRef(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastGameStateRef = useRef<any>(null);
  const hasCardCheckedRef = useRef(false);

  // Polling interval for real-time updates (3 seconds)
  const POLL_INTERVAL = 3000;

  // Helper function to get BINGO letter for a number
  const getNumberLetter = (num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  // Load wallet balance
  const loadWalletBalance = useCallback(async () => {
    try {
      const walletResponse = await walletAPIAuto.getBalance();
      if (walletResponse.data.success) {
        setWalletBalance(walletResponse.data.balance);
      }
    } catch (error) {
      console.warn('⚠️ Could not load wallet balance:', error);
    }
  }, []);

  // FIXED: Check if user has a bingo card for this game
  const checkUserHasCard = useCallback(async (forceCheck = false): Promise<boolean> => {
    // Skip if already checked and not forcing
    if (hasCardCheckedRef.current && !forceCheck) {
      return !!localBingoCard;
    }
    
    try {
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId || !id) return false;

      const cardResponse = await gameAPI.getUserBingoCard(id, userId);
      if (cardResponse.data.success && cardResponse.data.bingoCard) {
        const apiCard = cardResponse.data.bingoCard;
        setLocalBingoCard({
          cardNumber: (apiCard as any).cardNumber || (apiCard as any).cardIndex || 0,
          numbers: apiCard.numbers || [],
          markedPositions: apiCard.markedNumbers || apiCard.markedPositions || [],
          selected: (apiCard as any).selected
        });
        setSelectedNumber((apiCard as any).cardNumber || (apiCard as any).cardIndex || null);
        setIsSpectatorMode(false);
        hasCardCheckedRef.current = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking user card:', error);
      return false;
    }
  }, [id, localBingoCard]);

  // FIXED: Initialize user card with better logic
  const initializeUserCard = useCallback(async (forceCheck = false) => {
    try {
      setIsLoadingCard(true);
      setCardError('');
      
      // Check if user has a card
      const hasCard = await checkUserHasCard(forceCheck);
      
      if (!hasCard) {
        // User doesn't have a card
        if (game) {
          if (game.status === 'WAITING_FOR_PLAYERS' || game.status === 'CARD_SELECTION') {
            // Game is waiting, user can still select a card
            setIsSpectatorMode(false);
            setSpectatorMessage('Select a card number to join the game.');
          } else if (game.status === 'ACTIVE' || game.status === 'FINISHED') {
            // Game is active or finished, user is spectator
            setIsSpectatorMode(true);
            setSpectatorMessage('You do not have a card for this game. Watching as spectator.');
          }
        }
      } else {
        // User has a card, reset spectator mode
        setIsSpectatorMode(false);
        setSpectatorMessage('');
      }
    } catch (error) {
      console.error('Failed to initialize user card:', error);
      setCardError('Failed to load your card. Please try again.');
    } finally {
      setIsLoadingCard(false);
    }
  }, [game, checkUserHasCard]);

  // FIXED: Update game state without reloading page
  const updateGameState = useCallback(async (force = false) => {
    if (!id || showWinnerModal) return;
    
    try {
      const response = await gameAPI.getGame(id);
      const updatedGame = response.data.game as Game;
      
      if (updatedGame) {
        // Update called numbers if they've changed
        if (updatedGame.numbersCalled && updatedGame.numbersCalled.length > 0) {
          const newNumbers = updatedGame.numbersCalled;
          const oldNumbers = allCalledNumbers;
          
          // Check if numbers have actually changed
          if (JSON.stringify(newNumbers) !== JSON.stringify(oldNumbers)) {
            setAllCalledNumbers(newNumbers);
            
            // If there's a new number, animate it
            const lastNewNumber = newNumbers[newNumbers.length - 1];
            const lastOldNumber = oldNumbers[oldNumbers.length - 1];
            
            if (lastNewNumber !== lastOldNumber) {
              setCurrentCalledNumber({
                number: lastNewNumber,
                letter: getNumberLetter(lastNewNumber),
                isNew: true
              });
              
              // Clear the "new" flag after animation
              setTimeout(() => {
                setCurrentCalledNumber(prev => 
                  prev ? { ...prev, isNew: false } : null
                );
              }, 2000);
            } else if (!currentCalledNumber) {
              setCurrentCalledNumber({
                number: lastNewNumber,
                letter: getNumberLetter(lastNewNumber),
                isNew: false
              });
            }
          }
        }
        
        // Update game status
        if (updatedGame.status === 'FINISHED' && updatedGame.winnerId && !gameEndedCheckRef.current) {
          gameEndedCheckRef.current = true;
          checkForWinner(updatedGame);
        }
        
        // Store current state for comparison
        lastGameStateRef.current = updatedGame;
        
        // If user is in spectator mode but game is waiting, check for card again
        if (isSpectatorMode && (updatedGame.status === 'WAITING_FOR_PLAYERS' || updatedGame.status === 'CARD_SELECTION')) {
          await initializeUserCard(true);
        }
      }
    } catch (error) {
      console.warn('Failed to update game state:', error);
    }
  }, [id, showWinnerModal, allCalledNumbers, currentCalledNumber, isSpectatorMode, initializeUserCard]);

  // Check for winner
  const checkForWinner = useCallback(async (gameData?: Game) => {
    if (!gameData) return;
    
    try {
      setIsWinnerLoading(true);
      const winnerData = await getWinnerInfo();
      
      if (winnerData) {
        setWinnerInfo(winnerData);
        
        // Check if current user is the winner
        const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
        if (userId) {
          const isWinner = winnerData.winner.telegramId === userId || 
                          winnerData.winner._id.toString() === userId;
          setIsUserWinner(isWinner);
          
          // Calculate winning amount
          const totalPot = (gameData.currentPlayers || 0) * 10;
          const platformFee = totalPot * 0.1;
          const winnerPrize = totalPot - platformFee;
          setWinningAmount(winnerPrize);
        }
        
        // Show winner modal after delay
        setTimeout(() => {
          setShowWinnerModal(true);
          setIsWinnerLoading(false);
          
          // Stop polling when game is finished
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to fetch winner info:', error);
      setIsWinnerLoading(false);
    }
  }, [getWinnerInfo]);

  // Function to get winning pattern positions
  const getWinningPatternPositions = useCallback((patternType?: string): number[] => {
    if (!patternType) return [];
    
    const patternMap: Record<string, number[]> = {
      // Rows (0-4)
      'ROW_0': [0, 1, 2, 3, 4],           // Top row
      'ROW_1': [5, 6, 7, 8, 9],           // Second row
      'ROW_2': [10, 11, 12, 13, 14],      // Third row (with free space in middle)
      'ROW_3': [15, 16, 17, 18, 19],      // Fourth row
      'ROW_4': [20, 21, 22, 23, 24],      // Bottom row
      
      // Columns
      'COLUMN_0': [0, 5, 10, 15, 20],     // First column (B)
      'COLUMN_1': [1, 6, 11, 16, 21],     // Second column (I)
      'COLUMN_2': [2, 7, 12, 17, 22],     // Third column (N)
      'COLUMN_3': [3, 8, 13, 18, 23],     // Fourth column (G)
      'COLUMN_4': [4, 9, 14, 19, 24],     // Fifth column (O)
      
      // Diagonals
      'DIAGONAL_LEFT': [0, 6, 12, 18, 24],  // Top-left to bottom-right
      'DIAGONAL_RIGHT': [4, 8, 12, 16, 20], // Top-right to bottom-left
      
      // Four corners
      'FOUR_CORNERS': [0, 4, 20, 24],      // Four corners
      
      // Blackout (all cells except free space)
      'BLACKOUT': Array.from({ length: 25 }, (_, i) => i).filter(i => i !== 12), // All except free space
      
      // Default BINGO (any row, column, or diagonal)
      'BINGO': [], // This will be populated from API if available
    };
    
    return patternMap[patternType] || [];
  }, []);

  // Helper function to check if a position is in winning pattern
  const isWinningPosition = (rowIndex: number, colIndex: number): boolean => {
    if (!winnerInfo?.winningPattern) return false;
    
    const flatIndex = rowIndex * 5 + colIndex;
    const winningPositions = winnerInfo.winningCard?.winningPatternPositions || 
                           getWinningPatternPositions(winnerInfo.winningPattern);
    
    return winningPositions.includes(flatIndex);
  };

  // Function to get winning pattern type name
  const getPatternName = (patternType?: string): string => {
    if (!patternType) return 'BINGO Line';
    
    const patternMap: Record<string, string> = {
      'ROW_0': 'Top Row',
      'ROW_1': 'Second Row',
      'ROW_2': 'Third Row',
      'ROW_3': 'Fourth Row',
      'ROW_4': 'Bottom Row',
      'COLUMN_0': 'First Column (B)',
      'COLUMN_1': 'Second Column (I)',
      'COLUMN_2': 'Third Column (N)',
      'COLUMN_3': 'Fourth Column (G)',
      'COLUMN_4': 'Fifth Column (O)',
      'DIAGONAL_LEFT': 'Left Diagonal',
      'DIAGONAL_RIGHT': 'Right Diagonal',
      'FOUR_CORNERS': 'Four Corners',
      'BLACKOUT': 'Blackout (Full Card)',
      'BINGO': 'BINGO Line'
    };
    
    return patternMap[patternType] || patternType.replace('_', ' ').toLowerCase();
  };

  // Function to render pattern visualization
  const renderPatternVisualization = () => {
    if (!winnerInfo?.winningPattern) return null;
    
    const winningPositions = winnerInfo.winningCard?.winningPatternPositions || 
                           getWinningPatternPositions(winnerInfo.winningPattern);
    
    return (
      <div className="mt-4 bg-gray-900/50 rounded-xl p-4 border border-gray-700">
        <h4 className="text-white font-bold mb-3 text-center">Winning Pattern</h4>
        
        {/* Mini BINGO grid */}
        <div className="grid grid-cols-5 gap-1 max-w-xs mx-auto mb-4">
          {Array.from({ length: 25 }).map((_, index) => {
            const isWinningCell = winningPositions.includes(index);
            const isFreeSpace = index === 12;
            
            return (
              <div 
                key={index}
                className={`
                  aspect-square rounded-md border flex items-center justify-center
                  ${isWinningCell 
                    ? 'bg-gradient-to-br from-yellow-500 to-orange-500 border-yellow-300 shadow-lg shadow-yellow-500/30 animate-pulse' 
                    : isFreeSpace
                    ? 'bg-gradient-to-br from-purple-700/40 to-pink-700/40 border-purple-500/30'
                    : 'bg-gray-800/30 border-gray-700'
                  }
                `}
              >
                {isWinningCell && (
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 bg-yellow-200 rounded-full"
                  />
                )}
                {isFreeSpace && (
                  <span className="text-[8px] text-white/70">FREE</span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Pattern description */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-yellow-300 font-medium">
              {getPatternName(winnerInfo.winningPattern)}
            </span>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  };

  // FIXED: Main initialization - properly checks for card
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('🎮 Initializing game page...');
        
        // Load wallet balance
        await loadWalletBalance();
        
        // Wait for game data to load
        if (isLoading) {
          console.log('⏳ Waiting for game data...');
          return;
        }
        
        // Check if game exists
        if (!game) {
          setCardError('Game not found. Redirecting to lobby...');
          setTimeout(() => router.push('/'), 2000);
          return;
        }

        // Initialize user's card
        await initializeUserCard();

        // Load existing called numbers
        if (game.numbersCalled && game.numbersCalled.length > 0) {
          setAllCalledNumbers(game.numbersCalled);
          
          const lastNumber = game.numbersCalled[game.numbersCalled.length - 1];
          if (lastNumber) {
            setCurrentCalledNumber({
              number: lastNumber,
              letter: getNumberLetter(lastNumber),
              isNew: false
            });
          }
        }

        // Store initial game state
        lastGameStateRef.current = game;

        // Start polling for updates
        if (!pollingRef.current) {
          pollingRef.current = setInterval(() => updateGameState(), POLL_INTERVAL);
        }

      } catch (error) {
        console.error('Failed to initialize game:', error);
        setCardError('Failed to initialize game');
      }
    };

    initializeGame();

    // Cleanup function
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [game, isLoading, loadWalletBalance, initializeUserCard, router, updateGameState]);

  // Check for winner on game status change
  useEffect(() => {
    if (game && game.status === 'FINISHED' && game.winnerId && !showWinnerModal && !gameEndedCheckRef.current) {
      console.log('🏁 Game finished! Fetching winner info...');
      gameEndedCheckRef.current = true;
      checkForWinner(game as Game);
    }
  }, [game, showWinnerModal, checkForWinner]);

  // Countdown for winner modal
  useEffect(() => {
    if (showWinnerModal && winnerInfo) {
      setCountdown(20);
      
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            handleReturnToLobby();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [showWinnerModal, winnerInfo]);

  // FIXED: Handle manual number call - no page reload
  const handleCallNumber = async () => {
    if (isCallingNumber || !id || game?.status !== 'ACTIVE') return;
    
    try {
      setIsCallingNumber(true);
      const response = await gameAPI.callNumber(id);
      const data = response.data;
      
      if (data.success) {
        const letter = getNumberLetter(data.number);
        
        // Update state locally without page reload
        setCurrentCalledNumber({
          number: data.number,
          letter: letter,
          isNew: true
        });
        
        setAllCalledNumbers(data.calledNumbers);
        
        // Clear animation after duration
        setTimeout(() => {
          setCurrentCalledNumber(prev => 
            prev ? { ...prev, isNew: false } : null
          );
        }, 2000);
        
        // Trigger game state update
        setTimeout(() => updateGameState(true), 500);
      }
    } catch (error) {
      console.error('❌ Failed to call number:', error);
    } finally {
      setIsCallingNumber(false);
    }
  };

  // FIXED: Handle manual number marking - no page reload
  const handleMarkNumber = async (number: number) => {
    if (isMarking || !allCalledNumbers.includes(number) || game?.status !== 'ACTIVE') return;
    
    try {
      setIsMarking(true);
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) throw new Error('User ID not found');
      
      const response = await gameAPI.markNumber(id, userId, number);
      
      if (response.data.success) {
        console.log(`✅ Successfully manually marked number: ${number}`);
        
        // Update local bingo card state WITHOUT page reload
        if (localBingoCard) {
          const numbers = localBingoCard.numbers.flat();
          const position = numbers.indexOf(number);
          
          if (position !== -1 && !localBingoCard.markedPositions?.includes(position)) {
            const updatedMarkedPositions = [...(localBingoCard.markedPositions || []), position];
            setLocalBingoCard({
              ...localBingoCard,
              markedPositions: updatedMarkedPositions
            });
            
            // Show visual feedback
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 500);
          }
        }
        
        // Update game state without reload
        setTimeout(() => updateGameState(true), 300);
      }
    } catch (error: any) {
      console.error('Failed to mark number:', error);
      setClaimResult({
        success: false,
        message: error.response?.data?.message || 'Failed to mark number'
      });
      
      setTimeout(() => setClaimResult(null), 3000);
    } finally {
      setIsMarking(false);
    }
  };

  // FIXED: Handle manual Bingo claim - no page reload
  const handleClaimBingo = async () => {
    if (isClaimingBingo || !id || game?.status !== 'ACTIVE' || !localBingoCard) return;
    
    try {
      setIsClaimingBingo(true);
      setClaimResult(null);
      
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) throw new Error('User ID not found');
      
      const response = await gameAPI.claimBingo(id, userId, 'BINGO');
      
      if (response.data.success) {
        setClaimResult({
          success: true,
          message: response.data.message || 'Bingo claimed successfully!',
          patternType: response.data.patternType,
          prizeAmount: response.data.prizeAmount
        });
        
        // Update game state WITHOUT page reload
        setTimeout(() => {
          updateGameState(true);
        }, 1000);
      } else {
        setClaimResult({
          success: false,
          message: response.data.message || 'Failed to claim bingo'
        });
      }
    } catch (error: any) {
      console.error('❌ Bingo claim failed:', error);
      setClaimResult({
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to claim bingo'
      });
    } finally {
      setIsClaimingBingo(false);
      
      // Clear result after 5 seconds
      setTimeout(() => {
        setClaimResult(null);
      }, 5000);
    }
  };

  // Handle returning to lobby
  const handleReturnToLobby = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    setShowWinnerModal(false);
    setWinnerInfo(null);
    setIsUserWinner(false);
    setWinningAmount(0);
    setCurrentCalledNumber(null);
    setAllCalledNumbers([]);
    setClaimResult(null);
    setCountdown(20);
    
    gameEndedCheckRef.current = false;
    hasCardCheckedRef.current = false;
    
    router.push('/');
  };

  // Handle play again
  const handlePlayAgain = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    setShowWinnerModal(false);
    gameEndedCheckRef.current = false;
    hasCardCheckedRef.current = false;
    setWinnerInfo(null);
    setIsUserWinner(false);
    setWinningAmount(0);
    setCountdown(20);
    
    // Navigate to main page to select a new card
    router.push('/');
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Manual refresh button - only updates state, doesn't reload page
  const handleManualRefresh = () => {
    updateGameState(true);
  };

  // Use local card if available
  const displayBingoCard = localBingoCard || gameBingoCard;

  // Check if user can select card
  const canSelectCard = game && 
                       (game.status === 'WAITING_FOR_PLAYERS' || 
                        game.status === 'CARD_SELECTION') &&
                       !localBingoCard;

  // FIXED: Show spectator mode ONLY when user truly doesn't have a card
  if (isSpectatorMode && !localBingoCard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
          <h1 className="text-white font-bold text-xl mb-2">Spectator Mode</h1>
          <p className="text-white/70 text-sm mb-4">
            {spectatorMessage || 'You are watching the game as a spectator.'}
          </p>
          
          {canSelectCard ? (
            <button 
              onClick={() => router.push('/')}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-xl font-bold mr-3"
            >
              Select a Card to Join
            </button>
          ) : (
            <p className="text-yellow-300 text-sm mb-4">
              Game is active. Please wait for the next game to play.
            </p>
          )}
          
          <button 
            onClick={() => router.push('/')}
            className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-xl font-bold"
          >
            Return to Lobby
          </button>
        </div>
        
        {/* Game info for spectators */}
        {game && (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <h3 className="text-white font-bold mb-3">Game Info</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-white font-bold">{game.currentPlayers || 0}</p>
                  <p className="text-white/60 text-xs">Players</p>
                </div>
                <div>
                  <p className="text-white font-bold">{(game.currentPlayers || 0) * 10} ብር</p>
                  <p className="text-white/60 text-xs">Pot</p>
                </div>
                <div>
                  <p className="text-white font-bold">{allCalledNumbers.length}/75</p>
                  <p className="text-white/60 text-xs">Called</p>
                </div>
              </div>
            </div>
            
            {currentCalledNumber && (
              <div className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 border border-yellow-500/30">
                <h3 className="text-white font-bold mb-2">Current Number</h3>
                <div className="text-center">
                  <div className={`text-4xl font-bold text-yellow-300 mb-2 ${currentCalledNumber.isNew ? 'animate-bounce' : ''}`}>
                    {currentCalledNumber.letter}{currentCalledNumber.number}
                  </div>
                  <p className="text-white/70 text-sm">
                    Game is in progress. Join next game to play!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isLoading || isLoadingCard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading game...</p>
          {isLoadingCard && <p className="text-sm mt-2">Loading your bingo card...</p>}
          {cardError && (
            <p className="text-yellow-300 text-sm mt-2">{cardError}</p>
          )}
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Game Not Found</h1>
          <button 
            onClick={() => router.push('/')}
            className="bg-white text-purple-600 px-6 py-3 rounded-2xl font-bold"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4 relative">
      {/* Winner Modal */}
      <AnimatePresence>
        {showWinnerModal && winnerInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-3xl p-8 max-w-6xl w-full border-4 border-yellow-500 shadow-2xl relative overflow-hidden"
            >
              {/* Winner content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-white mb-2">
                    🎉 BINGO WINNER! 🎉
                  </h1>
                  <p className="text-white/70 text-lg">
                    Game #{winnerInfo.gameCode || id}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Winner Information */}
                  <div className="space-y-6">
                    {/* Winner Profile */}
                    <div className="bg-gradient-to-r from-purple-800/50 to-blue-800/50 rounded-2xl p-6 border border-white/20">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-2xl font-bold">
                          {isUserWinner ? 'YOU' : winnerInfo.winner.firstName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white">
                            {isUserWinner ? '🎊 YOU WON! 🎊' : winnerInfo.winner.firstName}
                          </h3>
                          <p className="text-white/70">
                            @{winnerInfo.winner.username}
                          </p>
                        </div>
                      </div>

                      {/* Prize Amount */}
                      <div className="text-center py-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl">
                        <p className="text-white/80 text-sm mb-1">Prize Amount</p>
                        <p className="text-3xl font-bold text-yellow-300">
                          {winningAmount} ብር
                        </p>
                        {isUserWinner && (
                          <p className="text-green-300 text-sm mt-2">
                            💰 Added to your wallet!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Game Stats */}
                    <div className="bg-gradient-to-r from-gray-900 to-black rounded-2xl p-5 border border-white/10">
                      <h4 className="text-white font-bold mb-4 text-lg">Game Statistics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-white/70 text-sm">Total Players</p>
                          <p className="text-white text-xl font-bold">{winnerInfo.totalPlayers}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/70 text-sm">Numbers Called</p>
                          <p className="text-white text-xl font-bold">{winnerInfo.numbersCalled}/75</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/70 text-sm">Winning Pattern</p>
                          <p className="text-green-300 text-lg font-bold">
                            {getPatternName(winnerInfo.winningPattern)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/70 text-sm">Game Duration</p>
                          <p className="text-white text-sm">
                            {new Date(winnerInfo.endedAt).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Winning Card Display */}
                  <div className="space-y-6">
                    {/* Card Title */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-bold text-xl">
                        Winning Card #{winnerInfo.winningCard?.cardNumber || 'N/A'}
                      </h3>
                      <div className="text-yellow-300 text-sm bg-yellow-500/20 px-3 py-1 rounded-full">
                        Winning Pattern Highlighted
                      </div>
                    </div>

                    {/* Winning Card */}
                    {winnerInfo.winningCard?.numbers && (
                      <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 border-2 border-yellow-500/50">
                        {/* BINGO Header */}
                        <div className="grid grid-cols-5 gap-2 mb-4">
                          {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                            <div 
                              key={letter}
                              className="h-12 rounded-lg flex items-center justify-center font-bold text-xl text-white bg-gradient-to-b from-purple-700 to-blue-800"
                            >
                              {letter}
                            </div>
                          ))}
                        </div>
                        
                        {/* Winning Card Numbers */}
                        <div className="grid grid-cols-5 gap-2">
                          {winnerInfo.winningCard.numbers.map((row: (number | string)[], rowIndex: number) =>
                            row.map((number: number | string, colIndex: number) => {
                              const flatIndex = rowIndex * 5 + colIndex;
                              const isMarked = winnerInfo.winningCard?.markedPositions?.includes(flatIndex);
                              const isWinningPos = isWinningPosition(rowIndex, colIndex);
                              const isFreeSpace = rowIndex === 2 && colIndex === 2;

                              return (
                                <motion.div
                                  key={`${rowIndex}-${colIndex}`}
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: rowIndex * 0.1 + colIndex * 0.02 }}
                                  className={`
                                    h-14 rounded-lg flex items-center justify-center 
                                    font-bold transition-all duration-200 relative z-10
                                    ${isWinningPos
                                      ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/50 border-2 border-yellow-300'
                                      : isMarked
                                      ? 'bg-gradient-to-br from-gray-700 to-gray-800 text-white/70 border border-gray-600'
                                      : isFreeSpace
                                      ? 'bg-gradient-to-br from-purple-700/50 to-pink-700/50 text-white/80 border border-purple-600/30'
                                      : 'bg-gray-800/50 text-white/40 border border-gray-700/50'
                                    }
                                  `}
                                >
                                  {isFreeSpace ? (
                                    <>
                                      <span className="text-xs font-bold">FREE</span>
                                      <div className="absolute top-1 right-1 text-[10px] opacity-70">✓</div>
                                    </>
                                  ) : (
                                    <>
                                      <span className={`text-base ${isWinningPos ? 'font-black' : ''}`}>
                                        {number}
                                      </span>
                                      
                                      {/* Special indicator for winning positions */}
                                      {isWinningPos && (
                                        <>
                                          <motion.div 
                                            animate={{ rotate: [0, 360] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0 border-2 border-yellow-300 rounded-lg"
                                          />
                                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-ping" />
                                        </>
                                      )}
                                      
                                      {/* Checkmark for marked positions */}
                                      {isMarked && (
                                        <div className={`
                                          absolute top-1 right-1 text-[10px]
                                          ${isWinningPos ? 'text-yellow-200 font-black' : 'text-gray-400'}
                                        `}>
                                          ✓
                                        </div>
                                      )}
                                      
                                      {/* Glow effect for winning positions */}
                                      {isWinningPos && (
                                        <div className="absolute inset-0 rounded-lg bg-yellow-400/20 blur-sm animate-pulse" />
                                      )}
                                    </>
                                  )}
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                        
                        {/* Pattern Description */}
                        <div className="mt-4 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full animate-pulse" />
                            <span className="text-white font-medium">
                              Winning Pattern: <span className="text-yellow-300 font-bold">
                                {getPatternName(winnerInfo.winningPattern)}
                              </span>
                            </span>
                            <div className="w-3 h-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full animate-pulse" />
                          </div>
                          
                          {/* Visual pattern indicator */}
                          <div className="mt-3 flex justify-center">
                            <div className="grid grid-cols-5 gap-1 bg-black/30 p-2 rounded-lg">
                              {Array.from({ length: 25 }).map((_, index) => {
                                const winningPositions = winnerInfo.winningCard?.winningPatternPositions || 
                                                       getWinningPatternPositions(winnerInfo.winningPattern);
                                const isWinningCell = winningPositions.includes(index);
                                const isFreeSpace = index === 12;
                                
                                return (
                                  <div 
                                    key={index}
                                    className={`
                                      w-4 h-4 rounded-sm border
                                      ${isWinningCell 
                                        ? 'bg-gradient-to-br from-yellow-500 to-orange-500 border-yellow-400 animate-pulse' 
                                        : isFreeSpace
                                        ? 'bg-purple-700/50 border-purple-600/50'
                                        : 'bg-gray-800/30 border-gray-700/30'
                                      }
                                    `}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        
                        {/* Legend */}
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 animate-pulse"></div>
                            <span className="text-white/80">Winning Line</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-gray-700 border border-gray-600"></div>
                            <span className="text-white/60">Marked Numbers</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-gradient-to-br from-purple-700/50 to-pink-700/50"></div>
                            <span className="text-white/60">Free Space</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pattern Visualization */}
                    {renderPatternVisualization()}
                  </div>
                </div>

                {/* Countdown and Action Buttons */}
                <div className="mt-8 pt-6 border-t border-white/20">
                  {/* Countdown */}
                  <div className="text-center mb-6">
                    <p className="text-white/70 text-sm mb-2">
                      New game starts in:
                    </p>
                    <div className="text-3xl font-bold text-yellow-300">
                      {countdown} seconds
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={handlePlayAgain}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition-all"
                    >
                      🎮 Play Again
                    </button>
                    
                    <button
                      onClick={handleReturnToLobby}
                      className="bg-gradient-to-r from-gray-700 to-gray-800 text-white px-8 py-3 rounded-xl font-bold text-lg hover:from-gray-800 hover:to-gray-900 transition-all"
                    >
                      ⏪ Return to Lobby
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay for winner info */}
      {isWinnerLoading && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="bg-gradient-to-br from-purple-700 to-blue-800 rounded-2xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white font-medium">Loading winner information...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <div className="grid grid-cols-6 gap-4 text-center">
          <div>
            <p className="text-white font-bold text-lg">{walletBalance} ብር</p>
            <p className="text-white/60 text-xs">Balance</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{(game.currentPlayers || 0) * 10} ብር</p>
            <p className="text-white/60 text-xs">Pot</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{game.currentPlayers || 0}</p>
            <p className="text-white/60 text-xs">Players</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">10 ብር</p>
            <p className="text-white/60 text-xs">Bet</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">
              {selectedNumber ? `#${selectedNumber}` : 'N/A'}
            </p>
            <p className="text-white/60 text-xs">Your Card</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{allCalledNumbers.length}/75</p>
            <p className="text-white/60 text-xs">Called</p>
          </div>
        </div>
        
        {/* Game Status Badge */}
        <div className="mt-3 flex justify-center">
          <div className={`px-4 py-1 rounded-full text-sm font-medium ${
            game.status === 'WAITING_FOR_PLAYERS' ? 'bg-yellow-500/20 text-yellow-300' :
            game.status === 'CARD_SELECTION' ? 'bg-blue-500/20 text-blue-300' :
            game.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            {game.status === 'WAITING_FOR_PLAYERS' ? '⏳ Waiting for players' :
             game.status === 'CARD_SELECTION' ? '🎲 Card Selection' :
             game.status === 'ACTIVE' ? '🎮 Game Active' :
             '🏁 Game Ended'}
          </div>
        </div>

        {/* Card Error Display */}
        {cardError && (
          <div className="mt-3 p-3 bg-red-500/20 rounded-lg border border-red-500/30">
            <p className="text-red-300 text-sm text-center">{cardError}</p>
            {game.status === 'WAITING_FOR_PLAYERS' && (
              <button 
                onClick={() => router.push('/')}
                className="mt-2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm mx-auto block"
              >
                Select New Card
              </button>
            )}
          </div>
        )}
      </div>

      {/* New Number Notification */}
      {currentCalledNumber?.isNew && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-3 rounded-full shadow-lg">
            <div className="flex items-center gap-3">
              <motion.span 
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 0.5, repeat: 1 }}
                className="text-2xl"
              >
                🔔
              </motion.span>
              <div>
                <motion.div 
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                  className="font-bold text-lg"
                >
                  {currentCalledNumber.letter}{currentCalledNumber.number} CALLED!
                </motion.div>
                <div className="text-sm opacity-90">Click it on your card to mark</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {/* Left: Called Numbers */}
        <div className="col-span-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
            {/* BINGO Header */}
            <div className="grid grid-cols-5 gap-1 mb-2">
              {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                <div 
                  key={letter}
                  className="h-8 rounded flex items-center justify-center font-bold text-md text-white bg-gradient-to-b from-purple-600/70 to-blue-700/70"
                >
                  {letter}
                </div>
              ))}
            </div>
            
            {/* Called Numbers Grid */}
            <div className="grid grid-cols-5 gap-1">
              {[
                {letter: 'B', range: {start: 1, end: 15}},
                {letter: 'I', range: {start: 16, end: 30}},
                {letter: 'N', range: {start: 31, end: 45}},
                {letter: 'G', range: {start: 46, end: 60}},
                {letter: 'O', range: {start: 61, end: 75}}
              ].map((column) => {
                const numbersInColumn = Array.from(
                  { length: column.range.end - column.range.start + 1 }, 
                  (_, i) => column.range.start + i
                );
                
                return (
                  <div key={column.letter} className="flex flex-col gap-1">
                    {numbersInColumn.map((number: number) => {
                      const isCalled = allCalledNumbers.includes(number);
                      const isCurrent = currentCalledNumber?.number === number;
                      
                      return (
                        <motion.div
                          key={number}
                          layout
                          initial={false}
                          animate={{
                            scale: isCurrent && currentCalledNumber?.isNew ? 1.1 : 1,
                          }}
                          className={`
                            aspect-square rounded flex items-center justify-center 
                            transition-all duration-200 cursor-pointer relative
                            ${isCurrent && currentCalledNumber?.isNew
                              ? 'bg-gradient-to-br from-yellow-500 to-orange-500 scale-105 ring-2 ring-yellow-400'
                              : isCurrent
                              ? 'bg-gradient-to-br from-yellow-500 to-orange-500 ring-1 ring-yellow-400'
                              : isCalled
                              ? 'bg-gradient-to-br from-red-500 to-pink-600'
                              : 'bg-white/10'
                            }
                          `}
                          onClick={() => isCalled && game?.status === 'ACTIVE' && handleMarkNumber(number)}
                          title={`${column.letter}${number} ${isCurrent ? '(Current)' : isCalled ? '(Called)' : ''}`}
                        >
                          <span className={`
                            text-xs font-bold
                            ${isCurrent ? 'text-white' : isCalled ? 'text-white' : 'text-white/70'}
                          `}>
                            {number}
                          </span>
                          
                          {isCurrent && currentCalledNumber?.isNew && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            
            {/* Call Number Button */}
            {game.status === 'ACTIVE' && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <button
                  onClick={handleCallNumber}
                  disabled={isCallingNumber}
                  className={`
                    w-full flex items-center justify-center gap-2 py-2 rounded font-medium text-sm
                    transition-all duration-200
                    ${isCallingNumber 
                      ? 'bg-gray-600/50 text-gray-300 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                    }
                  `}
                >
                  {isCallingNumber ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Calling...
                    </>
                  ) : (
                    <>
                      <span>🎲</span>
                      Call Next Number
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          {/* Current Number Display */}
          <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <h3 className="text-white font-bold mb-3">Current Number</h3>
            <div className={`text-center transition-all duration-300 ${isAnimating ? 'scale-110' : 'scale-100'}`}>
              {currentCalledNumber ? (
                <div>
                  <motion.div 
                    animate={currentCalledNumber.isNew ? {
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, -5, 0]
                    } : {}}
                    transition={currentCalledNumber.isNew ? {
                      duration: 0.5,
                      repeat: 1
                    } : {}}
                    className={`text-5xl font-bold mb-2`}
                  >
                    <span className="text-white mr-2">{currentCalledNumber.letter}</span>
                    <span className="text-yellow-300">{currentCalledNumber.number}</span>
                  </motion.div>
                  <p className="text-white/70 text-sm">
                    Click {currentCalledNumber.letter}{currentCalledNumber.number} on your card to mark it!
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-white/50 mb-2">
                    No numbers called yet
                  </p>
                  <p className="text-white/60 text-sm">
                    {game.status === 'ACTIVE' 
                      ? 'Waiting for first number...' 
                      : 'Game not active'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Bingo Card */}
        <div className="col-span-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-bold text-xl">Your Bingo Card</h3>
                {selectedNumber && (
                  <span className="text-white/90 text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 px-4 py-1.5 rounded-full font-medium">
                    Card #{selectedNumber}
                  </span>
                )}
              </div>
              <div className="text-white/70 text-sm bg-white/10 px-4 py-1.5 rounded-full">
                Marked: <span className="text-white font-bold ml-1">{displayBingoCard?.markedPositions?.length || 0}</span>/24
              </div>
            </div>
            
            {displayBingoCard ? (
              <div className="mb-4">
                {/* BINGO Header */}
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                    <div 
                      key={letter}
                      className="h-10 rounded-lg flex items-center justify-center font-bold text-lg text-white bg-gradient-to-b from-purple-600 to-blue-700"
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                
                {/* Card Numbers */}
                <div className="grid grid-cols-5 gap-1">
                  {displayBingoCard.numbers.map((row: (number | string)[], rowIndex: number) =>
                    row.map((number: number | string, colIndex: number) => {
                      const flatIndex = rowIndex * 5 + colIndex;
                      const isMarked = displayBingoCard.markedPositions?.includes(flatIndex);
                      const isCalled = allCalledNumbers.includes(number as number);
                      const isFreeSpace = rowIndex === 2 && colIndex === 2;

                      return (
                        <motion.div
                          key={`${rowIndex}-${colIndex}`}
                          layout
                          initial={false}
                          animate={{
                            scale: isCalled && !isMarked && game?.status === 'ACTIVE' ? 1.02 : 1,
                          }}
                          whileHover={isCalled && !isMarked && !isFreeSpace && game?.status === 'ACTIVE' ? {
                            scale: 1.05,
                            backgroundColor: 'rgba(255, 255, 255, 0.25)'
                          } : {}}
                          className={`
                            h-12 rounded-lg flex items-center justify-center 
                            font-bold transition-all duration-200 relative
                            ${isMarked
                              ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white border-2 border-green-400'
                              : isFreeSpace
                              ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white border-2 border-purple-400'
                              : 'bg-white/15 text-white'
                            }
                            ${isCalled && !isMarked && !isFreeSpace && game?.status === 'ACTIVE' 
                              ? 'cursor-pointer' 
                              : 'cursor-default'
                            }
                          `}
                          onClick={() => {
                            if (game?.status === 'ACTIVE' && !isFreeSpace && isCalled && !isMarked) {
                              handleMarkNumber(number as number);
                            }
                          }}
                          title={
                            isFreeSpace ? 'FREE SPACE (Always marked)' :
                            isMarked ? `Marked: ${number}` :
                            isCalled ? `Click to mark ${number}` :
                            `${number} (Not called yet)`
                          }
                        >
                          {isFreeSpace ? (
                            <>
                              <span className="text-xs font-bold">FREE</span>
                              <div className="absolute top-1 right-1 text-[10px] opacity-90">✓</div>
                            </>
                          ) : (
                            <>
                              <span className={`text-base ${isMarked ? 'line-through' : ''}`}>
                                {number}
                              </span>
                              {isCalled && !isMarked && game?.status === 'ACTIVE' && (
                                <motion.div 
                                  animate={{ scale: [1, 1.5, 1] }}
                                  transition={{ repeat: Infinity, duration: 1 }}
                                  className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"
                                />
                              )}
                              {isMarked && (
                                <motion.div 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute top-1 right-1 text-[10px] opacity-90"
                                >
                                  ✓
                                </motion.div>
                              )}
                            </>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-white/70 py-8">
                <p className="text-lg mb-2">No bingo card found</p>
                <p className="text-sm mb-6">{cardError}</p>
                <button 
                  onClick={() => router.push('/')}
                  className="bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-white px-6 py-2.5 rounded-lg hover:from-purple-500/40 hover:to-blue-500/40 transition-all"
                >
                  Select a Card
                </button>
              </div>
            )}
          </div>

          {/* Game Controls */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <h4 className="text-white font-bold mb-2">How to Win</h4>
              <div className="space-y-2 text-xs text-white/80">
                <div className="flex items-start gap-2">
                  <span className="text-green-400">1.</span>
                  <span>Listen for called numbers</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400">2.</span>
                  <span><span className="font-bold">Click</span> called numbers on your card</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400">3.</span>
                  <span>Complete a line (row, column, diagonal)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">4.</span>
                  <span><span className="font-bold">First</span> to claim with valid line wins!</span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <h4 className="text-white font-bold mb-2">Quick Actions</h4>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    alert(`🎮 MANUAL BINGO GAME RULES:

• Numbers are called automatically every 5-8 seconds
• YOU must click each called number on YOUR card
• Mark a complete line (5 in a row, column, or diagonal)
• Click "CLAIM BINGO" immediately when you complete a line
• First player with valid claim wins the prize!

⚡ TIP: Be quick! Other players are marking manually too!`);
                  }}
                  className="w-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white py-1.5 rounded text-xs hover:from-blue-500/30 hover:to-purple-500/30 transition-all border border-blue-400/30"
                >
                  📖 Game Rules
                </button>
                <button
                  onClick={handleManualRefresh}
                  className="w-full bg-white/15 text-white py-1.5 rounded text-xs hover:bg-white/25 transition-all flex items-center justify-center gap-1"
                >
                  ↻ Refresh Game Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Bingo Button - Fixed Position */}
      {game?.status === 'ACTIVE' && displayBingoCard && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-md">
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <div className="text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full inline-block mb-1 border border-white/20">
                ⚡ Manual Marking Active
              </div>
              <div className="text-white/60 text-xs max-w-xs">
                Mark numbers manually, complete a line, then claim!
              </div>
            </div>
            
            <button
              onClick={handleClaimBingo}
              disabled={isClaimingBingo}
              className={`
                bg-gradient-to-r from-yellow-500 to-orange-500 
                text-white px-10 py-4 rounded-2xl font-bold text-lg
                shadow-lg shadow-orange-500/30
                hover:from-yellow-600 hover:to-orange-600
                active:scale-95 transition-all duration-200
                flex items-center gap-3 w-full justify-center
                ${isClaimingBingo ? 'opacity-70 cursor-not-allowed' : ''}
              `}
            >
              {isClaimingBingo ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Verifying Claim...
                </>
              ) : (
                <>
                  <span className="text-2xl">🏆</span>
                  CLAIM BINGO
                  <span className="text-2xl">🏆</span>
                </>
              )}
            </button>
            
            {/* Claim Result Message */}
            {claimResult && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  mt-3 p-3 rounded-xl text-center text-sm font-medium w-full
                  ${claimResult.success 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }
                `}
              >
                {claimResult.message}
                {claimResult.patternType && (
                  <div className="text-xs mt-1">
                    Winning Pattern: <span className="font-bold">{claimResult.patternType}</span>
                  </div>
                )}
                {claimResult.prizeAmount && (
                  <div className="text-xs mt-1 font-bold">
                    Prize: <span className="text-yellow-300">${claimResult.prizeAmount} ብር</span>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
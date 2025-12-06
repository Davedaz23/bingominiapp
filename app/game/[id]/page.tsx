/* eslint-disable @typescript-eslint/no-explicit-any */
// app/game/[id]/page.tsx - COMPLETE VERSION (Manual Marking Only)
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useGame } from '../../../hooks/useGame';
import { walletAPIAuto, gameAPI } from '../../../services/api';
import { AnimatePresence, motion } from 'framer-motion';

// Interface for CallNumberResponse from API
interface CallNumberResponse {
  success: boolean;
  number: number;
  calledNumbers: number[];
  totalCalled: number;
  letter?: string;
}

interface CardData {
  cardNumber: number;
  numbers: (number | string)[][];
}

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
    refreshGame,
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

  // Refs for tracking
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameEndedCheckRef = useRef(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize game and load card
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('🎮 Initializing game page...');
        
        // Check if user should be redirected to spectator
        const isSpectator = searchParams.get('spectator') === 'true';
        const cardParam = searchParams.get('card');
        
        // FIX: Don't check game status yet - wait for full game data
        if (isLoading || !game) {
          console.log('⏳ Waiting for game data...');
          return;
        }
//15.0.5
        // FIX: Only check for spectator redirect if user doesn't have a card
        // and game is not in card selection or waiting phase
        if (!isSpectator && !cardParam) {
          const shouldBeSpectator = await checkIfShouldBeSpectator(game);
          if (shouldBeSpectator) {
            console.log('👁️ Redirecting to spectator mode...');
            router.push(`/game/${id}?spectator=true`);
            return;
          }
        }

        // Load wallet balance
        try {
          const walletResponse = await walletAPIAuto.getBalance();
          if (walletResponse.data.success) {
            setWalletBalance(walletResponse.data.balance);
            console.log('💰 Wallet balance loaded:', walletResponse.data.balance);
          }
        } catch (walletError) {
          console.warn('⚠️ Could not load wallet balance:', walletError);
        }

        // Spectator mode
        if (isSpectator) {
          console.log('👁️ User is joining as spectator');
          setIsLoadingCard(false);
          return;
        }

        // Card from URL
        if (cardParam) {
          try {
            const cardData: CardData = JSON.parse(decodeURIComponent(cardParam));
            console.log('🎯 Loaded card from URL:', cardData);
            setLocalBingoCard({
              cardNumber: cardData.cardNumber,
              numbers: cardData.numbers,
              markedPositions: []
            });
            setSelectedNumber(cardData.cardNumber);
            setIsLoadingCard(false);
            setCardError('');
            return;
          } catch (error) {
            console.error('Failed to parse card data from URL:', error);
            setCardError('Failed to load card data from URL');
          }
        }

        // Fetch from API
        console.log('🔄 Fetching card from API...');
        try {
          const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
          if (userId) {
            console.log('📋 Fetching card for user:', userId);
            const cardResponse = await gameAPI.getUserBingoCard(id, userId);
            
            if (cardResponse.data.success && cardResponse.data.bingoCard) {
              console.log('✅ Loaded card from API:', cardResponse.data.bingoCard);
              
              const apiCard = cardResponse.data.bingoCard;
              setLocalBingoCard({
                cardNumber: (apiCard as any).cardNumber || (apiCard as any).cardIndex || 0,
                numbers: apiCard.numbers || [],
                markedPositions: apiCard.markedNumbers || apiCard.markedPositions || [],
                selected: (apiCard as any).selected
              });
              setSelectedNumber((apiCard as any).cardNumber || (apiCard as any).cardIndex || null);
              setCardError('');
            } else {
              // FIX: Only redirect to spectator if game is already active
              if (game.status === 'ACTIVE') {
                setCardError('No bingo card found. Joining as spectator...');
                setTimeout(() => {
                  router.push(`/game/${id}?spectator=true`);
                }, 2000);
              } else {
                setCardError('No bingo card found for this user');
              }
            }
          } else {
            setCardError('User ID not found');
            console.log('❌ No user ID found in localStorage');
          }
        } catch (error: any) {
          console.error('Failed to fetch card from API:', error);
          if (error.response?.data?.error?.includes('Cast to ObjectId failed')) {
            setCardError('User ID format error. Please rejoin the game.');
          } else {
            setCardError('Failed to load bingo card from server');
          }
        }

        setIsLoadingCard(false);
      } catch (error) {
        console.error('Failed to initialize game:', error);
        setCardError('Failed to initialize game');
        setIsLoadingCard(false);
      }
    };

    const checkIfShouldBeSpectator = async (currentGame: any): Promise<boolean> => {
      // Only force spectator mode if:
      // 1. Game is ACTIVE and user doesn't have a card
      // 2. Game is FINISHED and user doesn't have a card
      
      if (currentGame.status === 'ACTIVE' || currentGame.status === 'FINISHED') {
        try {
          const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
          if (userId) {
            const cardResponse = await gameAPI.getUserBingoCard(id, userId);
            return !(cardResponse.data.success && cardResponse.data.bingoCard);
          }
        } catch (error) {
          console.log('Error checking user card:', error);
        }
      }
      
      return false;
    };

    initializeGame();
  }, [id, searchParams, game, isLoading]);

  // Helper function to get BINGO letter for a number
  const getNumberLetter = (num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  // Load existing called numbers when game loads
  useEffect(() => {
    if (game && game.numbersCalled && game.numbersCalled.length > 0) {
      // Set all called numbers
      setAllCalledNumbers(game.numbersCalled);
      
      // Set current called number (last one)
      const lastNumber = game.numbersCalled[game.numbersCalled.length - 1];
      if (lastNumber) {
        setCurrentCalledNumber({
          number: lastNumber,
          letter: getNumberLetter(lastNumber)
        });
      }
      
      console.log(`📊 Loaded ${game.numbersCalled.length} existing called numbers`);
    }
  }, [game]);

  // Start countdown when winner modal shows
  useEffect(() => {
    if (showWinnerModal && winnerInfo) {
      setCountdown(5);
      
      // Clear any existing countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      
      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Auto-return to lobby when countdown reaches 0
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
    
    // Cleanup
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [showWinnerModal, winnerInfo]);

  // Check if game ended and show winner modal
useEffect(() => {
  const checkGameEnded = async () => {
    if (!game || gameEndedCheckRef.current) return;
    
    if (game.status === 'FINISHED' && game.winner && !showWinnerModal) {
      console.log('🏁 Game finished! Fetching winner info...');
      gameEndedCheckRef.current = true;
      
      try {
        setIsWinnerLoading(true);
        
        // Fetch winner information
        const winnerData = await getWinnerInfo();
        if (winnerData) {
          // If winner card data is missing, try to fetch it separately
          if (!winnerData.winningCard && winnerData.winner) {
            try {
              const winnerUserId = winnerData.winner.telegramId || winnerData.winner._id;
              if (winnerUserId) {
                const winnerCardResponse = await gameAPI.getUserBingoCard(id, winnerUserId.toString());
                
                if (winnerCardResponse.data.success && winnerCardResponse.data.bingoCard) {
                  const winnerCard = winnerCardResponse.data.bingoCard;
                  winnerData.winningCard = {
                    cardNumber: (winnerCard as any).cardNumber || (winnerCard as any).cardIndex || 0,
                    numbers: winnerCard.numbers || [],
                    markedPositions: winnerCard.markedNumbers || winnerCard.markedPositions || [],
                    winningPatternPositions: (winnerCard as any).winningPatternPositions || []
                  };
                }
              }
            } catch (cardError) {
              console.warn('Could not fetch winner card details:', cardError);
            }
          }
          
          setWinnerInfo(winnerData);
          
          // Check if current user is the winner
          const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
          if (userId) {
            const isWinner = winnerData.winner.telegramId === userId || 
                            winnerData.winner._id.toString() === userId;
            setIsUserWinner(isWinner);
            
            // Calculate winning amount (90% of total pot)
            const totalPot = (game.currentPlayers || 0) * 10;
            const platformFee = totalPot * 0.1;
            const winnerPrize = totalPot - platformFee;
            setWinningAmount(winnerPrize);
            
            console.log(`🏆 Winner detected: ${winnerData.winner.username}, Prize: $${winnerPrize}`);
            
            // Update wallet balance if user is winner
            if (isWinner) {
              setTimeout(async () => {
                try {
                  const walletResponse = await walletAPIAuto.getBalance();
                  if (walletResponse.data.success) {
                    setWalletBalance(walletResponse.data.balance);
                  }
                } catch (error) {
                  console.warn('Could not update wallet balance:', error);
                }
              }, 1000);
            }
          }
        }
        
        // Show winner modal after a short delay
        setTimeout(() => {
          setShowWinnerModal(true);
          setIsWinnerLoading(false);
        }, 1500);
        
      } catch (error) {
        console.error('Failed to fetch winner info:', error);
        setIsWinnerLoading(false);
      }
    }
  };
  
  checkGameEnded();
  
  // Cleanup function
  return () => {
    gameEndedCheckRef.current = false;
  };
}, [game, getWinnerInfo, showWinnerModal]);

  // Function to call next number (MANUAL MARKING - NO AUTO-MARK)
  const handleCallNumber = async () => {
    if (isCallingNumber || !id || game?.status !== 'ACTIVE') return;
    
    try {
      setIsCallingNumber(true);
      console.log('🎲 Calling next number (MANUAL MARKING MODE)...');
      
      const response = await gameAPI.callNumber(id);
      const data: CallNumberResponse = response.data;
      
      if (data.success) {
        // Update current called number with animation
        const letter = getNumberLetter(data.number);
        setCurrentCalledNumber({
          number: data.number,
          letter: letter
        });
        
        // Update all called numbers - but DO NOT auto-mark
        setAllCalledNumbers(data.calledNumbers);
        
        // Show notification that number was called
        console.log(`📢 ${letter}${data.number} called! Click it on your card to mark.`);
        
        // Display notification to user (without reloading)
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg z-50';
        notification.textContent = `${letter}${data.number} called! Click to mark.`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
        
        // Trigger animation
        setIsAnimating(true);
        
        // Update game state without reloading
        setTimeout(() => {
          setIsAnimating(false);
        }, 1500);
      }
    } catch (error) {
      console.error('❌ Failed to call number:', error);
    } finally {
      setIsCallingNumber(false);
    }
  };

  // Manual mark number (user must click)
  const handleMarkNumber = async (number: number) => {
    if (isMarking || !allCalledNumbers.includes(number) || game?.status !== 'ACTIVE') return;
    
    try {
      setIsMarking(true);
      console.log(`🎯 Attempting to manually mark number: ${number}`);
      
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Call the API to mark this number
      const response = await gameAPI.markNumber(id, userId, number);
      
      if (response.data.success) {
        console.log(`✅ Successfully manually marked number: ${number}`);
        setSelectedNumber(number);
        
        // Update local bingo card state WITHOUT reloading
        if (displayBingoCard) {
          const numbers = displayBingoCard.numbers.flat();
          const position = numbers.indexOf(number);
          
          if (position !== -1 && !displayBingoCard.markedPositions?.includes(position)) {
            const updatedMarkedPositions = [...(displayBingoCard.markedPositions || []), position];
            setLocalBingoCard({
              ...displayBingoCard,
              markedPositions: updatedMarkedPositions
            });
            
            // Show success feedback without reloading
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg z-50';
            successMsg.textContent = `✓ Marked ${number}!`;
            document.body.appendChild(successMsg);
            
            setTimeout(() => {
              successMsg.remove();
            }, 1500);
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to mark number:', error);
      // Show error without reloading
      const errorMsg = document.createElement('div');
      errorMsg.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-50';
      errorMsg.textContent = error.response?.data?.error || 'Failed to mark number';
      document.body.appendChild(errorMsg);
      
      setTimeout(() => {
        errorMsg.remove();
      }, 3000);
    } finally {
      setIsMarking(false);
    }
  };

  // Manual Bingo claim
  const handleClaimBingo = async () => {
    if (isClaimingBingo || !id || game?.status !== 'ACTIVE' || !displayBingoCard) return;
    
    try {
      setIsClaimingBingo(true);
      setClaimResult(null);
      
      console.log('🏆 Attempting to claim BINGO...');
      
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      const response = await gameAPI.claimBingo(id, userId, 'BINGO');
      
      if (response.data.success) {
        setClaimResult({
          success: true,
          message: response.data.message || 'Bingo claimed successfully!',
          patternType: response.data.patternType,
          prizeAmount: response.data.prizeAmount
        });
        
        console.log('🎉 Bingo claim successful!');
        
        // Update game state without full reload - just refresh game data
        setTimeout(() => {
          refreshGame();
        }, 2000);
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
        message: error.message || 'Failed to claim bingo'
      });
    } finally {
      setIsClaimingBingo(false);
    }
  };

  // Function to handle returning to lobby
  const handleReturnToLobby = () => {
    console.log('🚀 Returning to lobby...');
    
    // Clear countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    // Clear all game states
    setShowWinnerModal(false);
    setWinnerInfo(null);
    setIsUserWinner(false);
    setWinningAmount(0);
    setCurrentCalledNumber(null);
    setAllCalledNumbers([]);
    setClaimResult(null);
    setCountdown(5);
    
    // Reset game ended check
    gameEndedCheckRef.current = false;
    
    // Navigate to lobby
    router.push('/');
  };

  // Function to play again
  const handlePlayAgain = () => {
    console.log('🔄 Playing again...');
    
    // Clear countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    setShowWinnerModal(false);
    gameEndedCheckRef.current = false;
    setWinnerInfo(null);
    setIsUserWinner(false);
    setWinningAmount(0);
    setCountdown(5);
    refreshGame();
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
    };
  }, []);

  // Use local card if available, otherwise use the one from useGame hook
  const displayBingoCard = localBingoCard || gameBingoCard;

  // Helper function to check if a position is in winning pattern
  const isWinningPosition = (rowIndex: number, colIndex: number): boolean => {
    if (!winnerInfo?.winningCard?.winningPatternPositions) return false;
    const flatIndex = rowIndex * 5 + colIndex;
    return winnerInfo.winningCard.winningPatternPositions.includes(flatIndex);
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
if (searchParams.get('spectator') === 'true') {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <h1 className="text-white font-bold text-xl mb-2">Spectator Mode</h1>
        <p className="text-white/70 text-sm mb-4">
          You are watching the game as a spectator. Join next game to play!
        </p>
        <button 
          onClick={() => router.push('/')}
          className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-xl font-bold"
        >
          Return to Lobby
        </button>
      </div>
      
      {/* Show game state for spectators */}
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
                <p className="text-white font-bold">{allCalledNumbers .length}/75</p>
                <p className="text-white/60 text-xs">Called</p>
              </div>
            </div>
          </div>
          
          {currentCalledNumber && (
            <div className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 border border-yellow-500/30">
              <h3 className="text-white font-bold mb-2">Current Number</h3>
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-300 mb-2">
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
            Back to Home
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
              {/* Confetti Background Effect */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animation: `twinkle ${1 + Math.random()}s infinite alternate`
                    }}
                  />
                ))}
              </div>

              {/* Winner Crown Icon */}
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="text-6xl text-yellow-400 animate-bounce">👑</div>
              </div>

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
                    {winnerInfo.winningCard?.numbers ? (
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
                                    font-bold transition-all duration-200 relative
                                    ${isWinningPos
                                      ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white border-3 border-yellow-300 shadow-lg shadow-yellow-500/50'
                                      : isMarked
                                      ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white'
                                      : isFreeSpace
                                      ? 'bg-gradient-to-br from-purple-700 to-pink-700 text-white'
                                      : 'bg-gray-800 text-white/70'
                                    }
                                  `}
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
                                      {isMarked && (
                                        <div className="absolute top-1 right-1 text-[10px] opacity-90">✓</div>
                                      )}
                                      {isWinningPos && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>
                                      )}
                                    </>
                                  )}
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                        
                        {/* Pattern Legend */}
                        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-br from-yellow-500 to-orange-500"></div>
                            <span className="text-white/70">Winning Pattern</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-br from-green-600 to-emerald-700"></div>
                            <span className="text-white/70">Marked Numbers</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-700 to-pink-700"></div>
                            <span className="text-white/70">Free Space</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 text-center">
                        <div className="text-5xl mb-4">🎯</div>
                        <h4 className="text-white text-xl font-bold mb-2">Winner Details</h4>
                        <p className="text-white/70 mb-4">
                          {winnerInfo.winner.firstName} won with {getPatternName(winnerInfo.winningPattern)}!
                        </p>
                      </div>
                    )}
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
                    {isUserWinner ? (
                      <button
                        onClick={handlePlayAgain}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition-all"
                      >
                        🎮 Play Again
                      </button>
                    ) : (
                      <button
                        onClick={handlePlayAgain}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition-all"
                      >
                        🎯 Join Next Game
                      </button>
                    )}
                    
                    <button
                      onClick={handleReturnToLobby}
                      className="bg-gradient-to-r from-gray-700 to-gray-800 text-white px-8 py-3 rounded-xl font-bold text-lg hover:from-gray-800 hover:to-gray-900 transition-all"
                    >
                      ⏪ Return to Lobby
                    </button>
                  </div>

                  {/* Share Button */}
                  <div className="text-center mt-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`I just won ${winningAmount} ብር in Bingo! 🎉`);
                        alert('Winner announcement copied to clipboard!');
                      }}
                      className="text-white/60 text-sm hover:text-white transition-colors"
                    >
                      📋 Share this victory
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
            <p className="text-white font-bold text-lg">{game.potAmount || 0} ብር</p>
            <p className="text-white/60 text-xs">To Win</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{game.players?.length || 0}</p>
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
            game.status === 'WAITING' ? 'bg-yellow-500/20 text-yellow-300' :
            game.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            {game.status === 'WAITING' ? '⏳ Waiting for players' :
             game.status === 'ACTIVE' ? '🎮 Game Active' :
             '🏁 Game Ended'}
          </div>
        </div>
        

        {/* Card Error Display */}
        {cardError && (
          <div className="mt-3 p-3 bg-red-500/20 rounded-lg border border-red-500/30">
            <p className="text-red-300 text-sm text-center">{cardError}</p>
            <button 
              onClick={() => router.push('/')}
              className="mt-2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm mx-auto block"
            >
              Select New Card
            </button>
          </div>
        )}
      </div>

      {/* Called Number Notification */}
      {currentCalledNumber && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-pulse">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-3 rounded-full shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <div className="font-bold text-lg">
                  {currentCalledNumber.letter}{currentCalledNumber.number} CALLED!
                </div>
                <div className="text-sm opacity-90">Click it on your card to mark</div>
              </div>
            </div>
          </div>
        </div>
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
            
            {/* Called Numbers Grid - Organized by BINGO Columns */}
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
                        <div
                          key={number}
                          className={`
                            aspect-square rounded flex items-center justify-center 
                            transition-all duration-200 cursor-pointer relative
                            ${isCurrent
                              ? 'bg-gradient-to-br from-yellow-500 to-orange-500 scale-105 ring-1 ring-yellow-400'
                              : isCalled
                              ? 'bg-gradient-to-br from-red-500 to-pink-600'
                              : 'bg-white/10'
                            }
                          `}
                          onClick={() => isCalled && handleMarkNumber(number)}
                          title={`${column.letter}${number} ${isCurrent ? '(Current)' : isCalled ? '(Called)' : ''}`}
                        >
                          {/* Number */}
                          <span className={`
                            text-xs font-bold
                            ${isCurrent ? 'text-white' : isCalled ? 'text-white' : 'text-white/70'}
                          `}>
                            {number}
                          </span>
                          
                          {/* Current Indicator */}
                          {isCurrent && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                          )}
                        </div>
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
                  <div className={`text-5xl font-bold mb-2 transition-all duration-500 ${isAnimating ? 'animate-bounce' : ''}`}>
                    <span className="text-white mr-2">{currentCalledNumber.letter}</span>
                    <span className="text-yellow-300">{currentCalledNumber.number}</span>
                  </div>
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
            
            {/* Manual Marking Instructions */}
            {game.status === 'ACTIVE' && (
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-400/30">
                <p className="text-white text-sm text-center font-medium">
                  💡 <span className="text-yellow-300">MANUAL MARKING:</span> Click called numbers below to mark your card!
                </p>
              </div>
            )}
            
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
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`
                            h-12 rounded-lg flex items-center justify-center 
                            font-bold transition-all duration-200 relative
                            ${isMarked
                              ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white border-2 border-green-400'
                              : isFreeSpace
                              ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white border-2 border-purple-400'
                              : 'bg-white/15 text-white'
                            }
                            ${isCalled && !isMarked && !isFreeSpace ? 'cursor-pointer hover:scale-[1.02] hover:bg-white/25' : 'cursor-default'}
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
                              {isCalled && !isMarked && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                              )}
                              {isMarked && (
                                <div className="absolute top-1 right-1 text-[10px] opacity-90">✓</div>
                              )}
                            </>
                          )}
                        </div>
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
                  onClick={() => router.refresh()}
                  className="w-full bg-white/15 text-white py-1.5 rounded text-xs hover:bg-white/25 transition-all"
                >
                  ↻ Refresh Game
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
              <div className={`
                mt-3 p-3 rounded-xl text-center text-sm font-medium w-full
                ${claimResult.success 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }
                animate-fadeIn
              `}>
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
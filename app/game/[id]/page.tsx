// app/game/[id]/page.tsx - UPDATED WITH WINNER MODAL
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../../../hooks/useGame';
import { walletAPIAuto, gameAPI } from '../../../services/api';

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
  cardNumber: number;
  numbers: (number | string)[][];
  markedPositions: number[];
  selected?: boolean[][];
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
    markNumber, 
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
  
  // NEW: Enhanced state for called numbers
  const [currentCalledNumber, setCurrentCalledNumber] = useState<{
    number: number;
    letter: string;
  } | null>(null);
  
  const [allCalledNumbers, setAllCalledNumbers] = useState<number[]>([]);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // NEW: Winner modal state
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<WinnerInfo | null>(null);
  const [isWinnerLoading, setIsWinnerLoading] = useState(false);
  const [isUserWinner, setIsUserWinner] = useState(false);
  const [winningAmount, setWinningAmount] = useState(0);
  
  // Refs for tracking
  const autoMarkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameEndedCheckRef = useRef(false);


  // NEW: State for bingo claiming
  const [isClaimingBingo, setIsClaimingBingo] = useState<boolean>(false);
  const [claimResult, setClaimResult] = useState<{
    success: boolean;
    message: string;
    patternType?: string;
    prizeAmount?: number;
  } | null>(null);


  // Initialize game and load card
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('🎮 Initializing game page...');
        
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

        // Try to get card data from URL parameters first
        const cardParam = searchParams.get('card');
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

        // If no card in URL, try to fetch from API
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
              setCardError('No bingo card found for this user');
              console.log('❌ No bingo card in response:', cardResponse.data);
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

    initializeGame();
  }, [id, searchParams]);

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

  // NEW: Check if game ended and show winner modal
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
            setWinnerInfo(winnerData);
            
            // Check if current user is the winner
            const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
            if (userId) {
              const isWinner = winnerData.winner.telegramId === userId || 
                              winnerData.winner._id.toString() === userId;
              setIsUserWinner(isWinner);
              
              // Calculate winning amount (90% of total pot)
              const totalPot = (game.currentPlayers || 0) * 10; // $10 entry fee
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

  // NEW: Function to call next number
  const handleCallNumber = async () => {
    if (isCallingNumber || !id || game?.status !== 'ACTIVE') return;
    
    try {
      setIsCallingNumber(true);
      console.log('🎲 Calling next number...');
      
      const response = await gameAPI.callNumber(id);
      const data: CallNumberResponse = response.data;
      
      if (data.success) {
        // Update current called number with animation
        const letter = getNumberLetter(data.number);
        setCurrentCalledNumber({
          number: data.number,
          letter: letter
        });
        
        // Update all called numbers
        setAllCalledNumbers(data.calledNumbers);
        
        // Trigger animation
        setIsAnimating(true);
        
        // Auto-mark on user's card if they have one
        if (localBingoCard) {
          autoMarkNumberOnCard(data.number);
        }
        
        console.log(`✅ Called number: ${letter}${data.number}`);
        
        // Refresh game state after a short delay
        setTimeout(() => {
          refreshGame();
          setIsAnimating(false);
        }, 1500);
      }
    } catch (error) {
      console.error('❌ Failed to call number:', error);
    } finally {
      setIsCallingNumber(false);
    }
  };

  // Auto-mark number on card when it's called
const autoMarkNumberOnCard = useCallback((number: number) => {
  // REMOVE THIS FUNCTION - Don't auto-mark anymore
  // Just notify the user that a number was called
  if (localBingoCard && number) {
    console.log(`📢 Number ${number} was called. Click it to mark!`);
    
    // Optional: Show a notification toast instead of auto-marking
    // toast(`Number ${number} called! Click it to mark.`);
  }
}, [localBingoCard]);

  const handleMarkNumber = async (number: number) => {
    if (isMarking || !allCalledNumbers.includes(number) || game?.status !== 'ACTIVE') return;
    
    try {
      setIsMarking(true);
      console.log(`🎯 Attempting to mark number: ${number}`);
      
      const success = await markNumber(number);
      
      if (success) {
        console.log(`✅ Successfully marked number: ${number}`);
        setSelectedNumber(number);
        
        // Refresh game state after marking
        setTimeout(() => {
          refreshGame();
        }, 500);
      }
    } catch (error) {
      console.error('Failed to mark number:', error);
    } finally {
      setIsMarking(false);
    }
  };
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
        
        // Refresh game state to show winner
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
  // NEW: Function to handle returning to lobby
  const handleReturnToLobby = () => {
    console.log('🚀 Returning to lobby...');
    setShowWinnerModal(false);
    router.push('/');
  };

  // NEW: Function to play again
  const handlePlayAgain = () => {
    console.log('🔄 Playing again...');
    setShowWinnerModal(false);
    gameEndedCheckRef.current = false;
    setWinnerInfo(null);
    setIsUserWinner(false);
    setWinningAmount(0);
    refreshGame();
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoMarkTimeoutRef.current) {
        clearTimeout(autoMarkTimeoutRef.current);
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Use local card if available, otherwise use the one from useGame hook
  const displayBingoCard = localBingoCard || gameBingoCard;

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
      {showWinnerModal && winnerInfo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-700 to-blue-800 rounded-2xl p-6 max-w-md w-full border-2 border-yellow-400 shadow-2xl">
            <div className="text-center">
              {/* Trophy Icon */}
              <div className="mb-4">
                <div className="text-6xl mb-2">🏆</div>
                <h2 className="text-2xl font-bold text-white mb-1">Game Over!</h2>
                <p className="text-white/70 text-sm">Game Code: {winnerInfo.gameCode}</p>
              </div>
              
              {/* Winner Info */}
              <div className="bg-white/10 rounded-xl p-4 mb-4 border border-white/20">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <span className="text-xl font-bold">👑</span>
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-bold text-lg">
                      {winnerInfo.winner.firstName} {winnerInfo.winner.username ? `(@${winnerInfo.winner.username})` : ''}
                    </h3>
                    <p className="text-white/70 text-sm">Is the Winner!</p>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-white/70 text-xs">Players</p>
                    <p className="text-white font-bold">{winnerInfo.totalPlayers}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-white/70 text-xs">Numbers Called</p>
                    <p className="text-white font-bold">{winnerInfo.numbersCalled}/75</p>
                  </div>
                </div>
                
                {/* Winning Amount */}
                {isUserWinner && winningAmount > 0 && (
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 rounded-lg p-3 mb-3 border border-green-500/30">
                    <p className="text-white/80 text-sm mb-1">You won!</p>
                    <p className="text-2xl font-bold text-yellow-300">${winningAmount} ብር</p>
                    <p className="text-white/60 text-xs mt-1">Has been added to your wallet</p>
                  </div>
                )}
                
                {!isUserWinner && (
                  <div className="bg-white/5 rounded-lg p-3 mb-3">
                    <p className="text-white/70 text-sm">
                      Better luck next time! You'll get them next game.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handlePlayAgain}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all"
                >
                  Play Another Game
                </button>
                <button
                  onClick={handleReturnToLobby}
                  className="bg-white/20 text-white py-3 rounded-xl font-bold hover:bg-white/30 transition-all"
                >
                  Return to Lobby
                </button>
              </div>
              
              <p className="text-white/50 text-xs mt-4">
                A new game will start automatically in 60 seconds
              </p>
            </div>
          </div>
        </div>
      )}
      
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
                    Click on {currentCalledNumber.letter}{currentCalledNumber.number} to mark your card
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
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`
                            h-12 rounded-lg flex items-center justify-center 
                            font-bold transition-all duration-200 relative
                            ${isMarked
                              ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white'
                              : isFreeSpace
                              ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                              : isCalled
                              ? 'bg-gradient-to-br from-yellow-500/40 to-orange-500/40 text-white hover:scale-[1.02] cursor-pointer'
                              : 'bg-white/15 text-white hover:bg-white/25'
                            }
                            ${isCalled && !isMarked && !isFreeSpace ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}
                          `}
                          onClick={() => 
                            !isFreeSpace && isCalled && !isMarked && handleMarkNumber(number as number)
                          }
                          title={
                            isFreeSpace ? 'FREE SPACE' :
                            isMarked ? `Marked: ${number}` :
                            isCalled ? `Click to mark ${number}` :
                            `${number}`
                          }
                        >
                          {isFreeSpace ? (
                            <span className="text-xs font-bold">FREE</span>
                          ) : (
                            <>
                              <span className={`text-base ${isMarked ? 'line-through' : ''}`}>
                                {number}
                              </span>
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
              <h4 className="text-white font-bold mb-2">Game Status</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-xs">Status:</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    game.status === 'ACTIVE' ? 'bg-green-500/30 text-green-300' :
                    game.status === 'WAITING' ? 'bg-yellow-500/30 text-yellow-300' :
                    'bg-red-500/30 text-red-300'
                  }`}>
                    {game.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70 text-xs">Players:</span>
                  <span className="text-white text-xs font-medium">{game.currentPlayers || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70 text-xs">Called:</span>
                  <span className="text-white text-xs font-medium">{allCalledNumbers.length}/75</span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <h4 className="text-white font-bold mb-2">Actions</h4>
              <div className="space-y-1.5">
                <button
                  onClick={() => router.refresh()}
                  className="w-full bg-white/15 text-white py-1.5 rounded text-xs hover:bg-white/25 transition-all"
                >
                  ↻ Refresh Game
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-white/15 text-white py-1.5 rounded text-xs hover:bg-white/25 transition-all"
                >
                  ← Back to Lobby
                </button>
              </div>
            </div>
          </div>
        </div>
        {game?.status === 'ACTIVE' && displayBingoCard && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleClaimBingo}
            disabled={isClaimingBingo}
            className={`
              bg-gradient-to-r from-yellow-500 to-orange-500 
              text-white px-8 py-4 rounded-2xl font-bold text-lg
              shadow-lg shadow-orange-500/30
              hover:from-yellow-600 hover:to-orange-600
              active:scale-95 transition-all duration-200
              flex items-center gap-3
              ${isClaimingBingo ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            {isClaimingBingo ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Verifying...
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
              mt-3 p-3 rounded-xl text-center text-sm font-medium
              ${claimResult.success 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }
              animate-fadeIn
            `}>
              {claimResult.message}
              {claimResult.patternType && (
                <div className="text-xs mt-1">
                  Pattern: {claimResult.patternType}
                </div>
              )}
              {claimResult.prizeAmount && (
                <div className="text-xs mt-1 font-bold">
                  Prize: ${claimResult.prizeAmount} ብር
                </div>
              )}
            </div>
          )}
          
          {/* Instructions */}
          <div className="text-white/70 text-xs text-center mt-2 max-w-xs">
            First player to claim with a valid bingo line wins!
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
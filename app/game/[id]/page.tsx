// app/game/[id]/page.tsx - UPDATED WITH ENHANCED NUMBER DISPLAY
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../../../hooks/useGame';
import { walletAPIAuto, gameAPI } from '../../../services/api';

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
  } = useGame(id);
  
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [localBingoCard, setLocalBingoCard] = useState<LocalBingoCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState<boolean>(true);
  const [cardError, setCardError] = useState<string>('');
  const [isMarking, setIsMarking] = useState<boolean>(false);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [calledNumbersHistory, setCalledNumbersHistory] = useState<number[]>([]);
  const [currentNumberDisplay, setCurrentNumberDisplay] = useState<{
    number: number | null;
    letter: string | null;
  }>({ number: null, letter: null });
  
  // NEW: Add state for called numbers with letters
  const [calledNumbersWithLetters, setCalledNumbersWithLetters] = useState<
    Array<{ number: number; letter: string }>
  >([]);
  
  // NEW: Add state for animation
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs for tracking
  const calledNumbersRef = useRef<number[]>([]);
  const autoMarkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // NEW: Enhanced function to update called numbers with animation
  const updateCalledNumbersWithAnimation = useCallback((newNumber: number) => {
    const letter = getNumberLetter(newNumber);
    
    // Trigger animation
    setIsAnimating(true);
    
    // Update current number display with animation
    setCurrentNumberDisplay({ number: newNumber, letter });
    
    // Add to called numbers history
    setCalledNumbersHistory(prev => [...prev, newNumber]);
    
    // Update called numbers with letters
    setCalledNumbersWithLetters(prev => [...prev, { number: newNumber, letter }]);
    
    // Reset animation after 1 second
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    
    animationTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
    
    console.log(`🔢 New number called: ${letter}${newNumber}`);
    
    // Auto-mark on card
    if (localBingoCard) {
      autoMarkNumberOnCard(newNumber);
    }
  }, [localBingoCard]);

  // Update called numbers when gameState changes
  useEffect(() => {
    if (gameState.calledNumbers && gameState.calledNumbers.length > 0) {
      const newCalledNumbers = gameState.calledNumbers;
      
      // Check if there are new numbers
      if (newCalledNumbers.length > calledNumbersRef.current.length) {
        const latestNumber = newCalledNumbers[newCalledNumbers.length - 1];
        
        if (latestNumber && latestNumber !== lastCalledNumber) {
          setLastCalledNumber(latestNumber);
          updateCalledNumbersWithAnimation(latestNumber);
        }
        
        // Update all called numbers with letters
        const numbersWithLetters = newCalledNumbers.map(num => ({
          number: num,
          letter: getNumberLetter(num)
        }));
        setCalledNumbersWithLetters(numbersWithLetters);
      }
      
      calledNumbersRef.current = newCalledNumbers;
    }
  }, [gameState.calledNumbers, updateCalledNumbersWithAnimation]);

  // Auto-mark number on card when it's called
  const autoMarkNumberOnCard = useCallback((number: number) => {
    if (!localBingoCard || !number) return;
    
    if (autoMarkTimeoutRef.current) {
      clearTimeout(autoMarkTimeoutRef.current);
    }
    
    autoMarkTimeoutRef.current = setTimeout(async () => {
      try {
        const flatNumbers = localBingoCard.numbers.flat();
        const position = flatNumbers.indexOf(number);
        
        if (position !== -1 && !localBingoCard.markedPositions.includes(position)) {
          console.log(`✅ Auto-marking ${number} on card at position ${position}`);
          
          setLocalBingoCard(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              markedPositions: [...prev.markedPositions, position]
            };
          });
          
          if (game?.status === 'ACTIVE') {
            await handleMarkNumber(number);
          }
        }
      } catch (error) {
        console.error('Error auto-marking number:', error);
      }
    }, 500);
  }, [localBingoCard, game]);

  const handleMarkNumber = async (number: number) => {
    if (isMarking) return;
    
    try {
      setIsMarking(true);
      console.log(`🎯 Attempting to mark number: ${number}`);
      
      if (!gameState.calledNumbers.includes(number)) {
        console.log(`❌ Number ${number} hasn't been called yet`);
        return;
      }
      
      const success = await markNumber(number);
      
      if (success) {
        console.log(`✅ Successfully marked number: ${number}`);
        setSelectedNumber(number);
      }
    } catch (error) {
      console.error('Failed to mark number:', error);
    } finally {
      setIsMarking(false);
    }
  };

  // Handle manual number calling (for testing/debugging)
  const handleManualCallNumber = async () => {
    try {
      console.log('🎲 Manually calling next number...');
      const number = await manualCallNumber();
      if (number) {
        updateCalledNumbersWithAnimation(number);
      }
    } catch (error) {
      console.error('Failed to manually call number:', error);
    }
  };

  // NEW: Function to clear all called numbers (for testing)
  const handleClearCalledNumbers = () => {
    setCalledNumbersHistory([]);
    setCalledNumbersWithLetters([]);
    setCurrentNumberDisplay({ number: null, letter: null });
    console.log('🧹 Cleared called numbers display');
  };

  // Use local card if available, otherwise use the one from useGame hook
  const displayBingoCard = localBingoCard || gameBingoCard;

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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
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
            <p className="text-white font-bold text-lg">{calledNumbersHistory.length}/75</p>
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
        {/* Left: Called Numbers - More space (col-span-2) */}
        <div className="col-span-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Called Numbers</h3>
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm bg-white/10 px-3 py-1 rounded-full">
                  {calledNumbersHistory.length}/75
                </span>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleClearCalledNumbers}
                    className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded hover:bg-red-500/30 transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            {/* Current Number Display - Enhanced with Animation */}
 
<div className={`flex items-center justify-center mb-2 transition-all duration-300 ${
  isAnimating ? 'scale-110' : 'scale-100'
}`}>
  {currentNumberDisplay.number ? (
    <>
      <div className={`mr-4 transition-all duration-500 ${
        isAnimating ? 'animate-pulse' : ''
      }`}>
        <span className="text-6xl font-bold text-white">
          {currentNumberDisplay.letter}
        </span>
      </div>
      <div className={`transition-all duration-500 ${
        isAnimating ? 'animate-bounce' : ''
      }`}>
        <span className="text-7xl font-bold text-yellow-300 drop-shadow-lg">
          {currentNumberDisplay.number}
        </span>
      </div>
    </>
  ) : (
    <div className="text-center py-4">
      <span className="text-3xl font-bold text-white/50">
        No numbers called yet
      </span>
      {game.status === 'ACTIVE' && (
        <p className="text-white/70 text-sm mt-2">
          Numbers will appear automatically...
        </p>
      )}
    </div>
  )}
</div>
            
            {/* Called Numbers Grid - WITH LETTERS */}
            <div className="grid grid-cols-10 gap-1.5 flex-grow overflow-y-auto pr-1 pb-2 max-h-[400px]">
              {Array.from({ length: 75 }, (_, i) => i + 1).map((number: number) => {
                const isCalled = gameState.calledNumbers.includes(number);
                const isCurrent = number === currentNumberDisplay.number;
                const letter = getNumberLetter(number);
                
                return (
                  <div
                    key={number}
                    className={`
                      aspect-square rounded-lg flex flex-col items-center justify-center 
                      transition-all duration-200 cursor-pointer relative group
                      ${isCurrent
                        ? 'bg-gradient-to-br from-yellow-500 to-orange-500 scale-105 ring-2 ring-yellow-400 shadow-lg'
                        : isCalled
                        ? 'bg-gradient-to-br from-green-500/90 to-emerald-600/90 hover:scale-105 hover:shadow-md'
                        : 'bg-white/15 hover:bg-white/25'
                      }
                    `}
                    onClick={() => isCalled && handleMarkNumber(number)}
                    title={
                      isCurrent ? `Current: ${letter}${number}` :
                      isCalled ? `Click to mark ${letter}${number}` :
                      `${letter}${number} - Not called yet`
                    }
                  >
                    {/* Letter Badge */}
                    <div className={`
                      absolute top-1 left-1 text-[9px] font-bold px-1 py-0.5 rounded
                      ${isCurrent 
                        ? 'bg-white/30 text-white' 
                        : isCalled 
                        ? 'bg-white/20 text-white/90' 
                        : 'bg-white/10 text-white/60'
                      }
                    `}>
                      {letter}
                    </div>
                    
                    {/* Number */}
                    <span className={`
                      text-sm font-bold mt-1
                      ${isCurrent ? 'text-white' : isCalled ? 'text-white' : 'text-white/70'}
                    `}>
                      {number}
                    </span>
                    
                    {/* Called Indicator */}
                    {isCalled && (
                      <div className="absolute bottom-1 right-1 text-[8px] opacity-90">
                        ✓
                      </div>
                    )}
                    
                    {/* Hover Tooltip */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {letter}{number}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Recent Called Numbers with Letters */}
            {calledNumbersWithLetters.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-white/80 text-sm font-medium">Recently Called:</p>
                  <span className="text-white/60 text-xs">
                    Last {Math.min(calledNumbersWithLetters.length, 15)} of {calledNumbersWithLetters.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...calledNumbersWithLetters].reverse().slice(0, 15).map((item, index) => {
                    const isLatest = index === 0;
                    return (
                      <div 
                        key={`recent-${item.number}-${index}`}
                        className={`
                          flex flex-col items-center justify-center px-3 py-2 rounded-lg 
                          transition-all hover:scale-105 min-w-[50px]
                          ${isLatest 
                            ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 ring-1 ring-yellow-400/50' 
                            : 'bg-white/15'
                          }
                        `}
                        onClick={() => handleMarkNumber(item.number)}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`
                            text-xs font-bold
                            ${isLatest ? 'text-yellow-300' : 'text-white/70'}
                          `}>
                            {item.letter}
                          </span>
                          <span className={`
                            text-base font-bold
                            ${isLatest ? 'text-yellow-300' : 'text-white'}
                          `}>
                            {item.number}
                          </span>
                        </div>
                        {isLatest && (
                          <span className="text-[10px] text-yellow-200/70 mt-1">LATEST</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Auto-call Status */}
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    game.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                  }`}></div>
                  <span className="text-white/70 text-sm">
                    {game.status === 'ACTIVE' 
                      ? 'Auto-calling numbers every 5-8 seconds' 
                      : 'Auto-call paused (game not active)'}
                  </span>
                </div>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleManualCallNumber}
                    className="text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-white px-3 py-1.5 rounded hover:from-purple-500/40 hover:to-blue-500/40 transition-all"
                  >
                    🎲 Call Next Number
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Bingo Card - Less space (col-span-2) */}
        {/* ... (rest of your bingo card code remains the same) ... */}
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
                      const isCalled = gameState.calledNumbers.includes(number as number);
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
                
                {/* Compact Stats Row */}
                <div className="mt-3 flex items-center justify-between text-white/70 text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-green-600"></div>
                      <span>Marked</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-yellow-500/40"></div>
                      <span>Called</span>
                    </div>
                  </div>
                  <div>
                    Progress: <span className="text-white font-bold">{Math.round(((displayBingoCard.markedPositions?.length || 0) / 24) * 100)}%</span>
                  </div>
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

          {/* Game Controls & Info - Reduced height */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Game Status Card - Reduced */}
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
                  <span className="text-white text-xs font-medium">{calledNumbersHistory.length}/75</span>
                </div>
              </div>
            </div>

            {/* Quick Actions - Reduced */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <h4 className="text-white font-bold mb-2">Actions</h4>
              <div className="space-y-1.5">
                <button
                  onClick={() => router.refresh()}
                  className="w-full bg-white/15 text-white py-1.5 rounded text-xs hover:bg-white/25 transition-all"
                >
                  ↻ Refresh
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-white/15 text-white py-1.5 rounded text-xs hover:bg-white/25 transition-all"
                >
                  ← Lobby
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleManualCallNumber}
                    className="w-full bg-yellow-500/20 text-yellow-300 py-1.5 rounded text-xs hover:bg-yellow-500/30 transition-all"
                  >
                    🎲 Call # (Dev)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Debug Info - Smaller */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-3 mt-3 border border-yellow-500/20">
              <h4 className="text-yellow-300 font-bold mb-2 text-sm">Debug Info</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-yellow-200/70 text-[10px]">Card:</p>
                  <p className="text-yellow-200 text-xs">{displayBingoCard ? '✓' : '✗'}</p>
                </div>
                <div>
                  <p className="text-yellow-200/70 text-[10px]">Card #:</p>
                  <p className="text-yellow-200 text-xs">{selectedNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-yellow-200/70 text-[10px]">Marked:</p>
                  <p className="text-yellow-200 text-xs">{displayBingoCard?.markedPositions?.length || 0}</p>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-yellow-200/70 text-[10px]">Called Numbers:</p>
                <p className="text-yellow-200 text-xs truncate">
                  {calledNumbersHistory.slice(-8).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
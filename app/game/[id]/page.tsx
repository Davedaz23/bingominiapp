// app/game/[id]/page.tsx - COMPLETE ENHANCED VERSION
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
  
  // NEW: Enhanced state for called numbers
  const [currentCalledNumber, setCurrentCalledNumber] = useState<{
    number: number;
    letter: string;
  } | null>(null);
  
  const [allCalledNumbers, setAllCalledNumbers] = useState<number[]>([]);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs for tracking
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

  // NEW: Function to call next number
  const handleCallNumber = async () => {
    if (isCallingNumber || !id) return;
    
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
        
        // Reset animation after 1.5 seconds
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

  // Auto-mark number on card when it's called
  const autoMarkNumberOnCard = useCallback((number: number) => {
    if (!localBingoCard || !number) return;
    
    console.log(`🎯 Auto-marking ${number} on bingo card...`);
    
    if (autoMarkTimeoutRef.current) {
      clearTimeout(autoMarkTimeoutRef.current);
    }
    
    autoMarkTimeoutRef.current = setTimeout(() => {
      try {
        // Find position in bingo card
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
          
          // Also mark via API if game is active
          if (game?.status === 'ACTIVE') {
            handleMarkNumber(number);
          }
        }
      } catch (error) {
        console.error('Error auto-marking number:', error);
      }
    }, 500);
  }, [localBingoCard, game]);

  const handleMarkNumber = async (number: number) => {
    if (isMarking || !allCalledNumbers.includes(number)) return;
    
    try {
      setIsMarking(true);
      console.log(`🎯 Attempting to mark number: ${number}`);
      
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
        {/* Left: Called Numbers - More space (col-span-2) */}
        <div className="col-span-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Called Numbers</h3>
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm bg-white/10 px-3 py-1 rounded-full">
                  {allCalledNumbers.length}/75
                </span>
              </div>
            </div>
            
            {/* Current Number Display - Enhanced with Animation */}
            <div className={`flex items-center justify-center mb-6 transition-all duration-300 ${isAnimating ? 'scale-110' : 'scale-100'}`}>
              {currentCalledNumber ? (
                <div className="text-center">
                  {/* Current Number with Animation */}
                  <div className={`transition-all duration-500 ${isAnimating ? 'animate-bounce' : ''}`}>
                    <div className="flex items-center justify-center">
                      <span className="text-5xl font-bold text-white mr-3">
                        {currentCalledNumber.letter}
                      </span>
                      <span className="text-6xl font-bold text-yellow-300 drop-shadow-lg">
                        {currentCalledNumber.number}
                      </span>
                    </div>
                  </div>
                  
                  {/* Called Count */}
                  <div className="mt-2 text-white/70 text-sm">
                    {allCalledNumbers.length} of 75 numbers called
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl font-bold text-white/50">
                    No number called yet
                  </div>
                  <div className="mt-2 text-white/70 text-sm">
                    Waiting for first number...
                  </div>
                </div>
              )}
            </div>
            
            {/* Called Numbers Grid - 75 Numbers with Red Highlighting */}
        // Replace the Called Numbers Grid section (lines 196-277) with this improved version:
<div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 h-full flex flex-col">
  <div className="flex justify-between items-center mb-4">
    <h3 className="text-white font-bold text-lg">Called Numbers</h3>
    <div className="flex items-center gap-2">
      <span className="text-white/70 text-sm bg-white/10 px-3 py-1 rounded-full">
        {allCalledNumbers.length}/75
      </span>
    </div>
  </div>
  
  {/* Current Number Display - Enhanced with Animation */}
  <div className={`flex items-center justify-center mb-6 transition-all duration-300 ${isAnimating ? 'scale-110' : 'scale-100'}`}>
    {currentCalledNumber ? (
      <div className="text-center">
        {/* Current Number with Animation */}
        <div className={`transition-all duration-500 ${isAnimating ? 'animate-bounce' : ''}`}>
          <div className="flex items-center justify-center">
            <span className="text-5xl font-bold text-white mr-3">
              {currentCalledNumber.letter}
            </span>
            <span className="text-6xl font-bold text-yellow-300 drop-shadow-lg">
              {currentCalledNumber.number}
            </span>
          </div>
        </div>
        
        {/* Called Count */}
        <div className="mt-2 text-white/70 text-sm">
          {allCalledNumbers.length} of 75 numbers called
        </div>
      </div>
    ) : (
      <div className="text-center">
        <div className="text-3xl font-bold text-white/50">
          No number called yet
        </div>
        <div className="mt-2 text-white/70 text-sm">
          Waiting for first number...
        </div>
      </div>
    )}
  </div>
  
  {/* BINGO Header for Called Numbers */}
  <div className="grid grid-cols-5 gap-2 mb-3">
    {['B', 'I', 'N', 'G', 'O'].map((letter) => (
      <div 
        key={letter}
        className="h-12 rounded-lg flex items-center justify-center font-bold text-xl text-white bg-gradient-to-b from-purple-600/70 to-blue-700/70 border border-white/20"
      >
        {letter}
      </div>
    ))}
  </div>
  
  {/* Called Numbers Grid - Organized by BINGO Columns */}
  <div className="grid grid-cols-5 gap-2 flex-grow overflow-y-auto pr-1 pb-2 max-h-[400px]">
    {[
      {letter: 'B', range: {start: 1, end: 15}},
      {letter: 'I', range: {start: 16, end: 30}},
      {letter: 'N', range: {start: 31, end: 45}},
      {letter: 'G', range: {start: 46, end: 60}},
      {letter: 'O', range: {start: 61, end: 75}}
    ].map((column, colIndex) => {
      const numbersInColumn = Array.from(
        { length: column.range.end - column.range.start + 1 }, 
        (_, i) => column.range.start + i
      );
      
      return (
        <div key={column.letter} className="flex flex-col gap-1.5">
          {numbersInColumn.map((number: number) => {
            const isCalled = allCalledNumbers.includes(number);
            const isCurrent = currentCalledNumber?.number === number;
            
            return (
              <div
                key={number}
                className={`
                  aspect-square rounded-lg flex items-center justify-center 
                  transition-all duration-300 cursor-pointer relative group
                  ${isCurrent
                    ? 'bg-gradient-to-br from-yellow-500 to-orange-500 scale-105 ring-2 ring-yellow-400 shadow-lg animate-pulse'
                    : isCalled
                    ? 'bg-gradient-to-br from-red-500 to-pink-600 hover:scale-105 hover:shadow-md'
                    : 'bg-white/15 hover:bg-white/25'
                  }
                `}
                onClick={() => isCalled && handleMarkNumber(number)}
                title={
                  isCurrent ? `Current: ${column.letter}${number}` :
                  isCalled ? `Called: ${column.letter}${number} - Click to mark` :
                  `${column.letter}${number} - Not called yet`
                }
              >
                {/* Number */}
                <span className={`
                  text-sm font-bold
                  ${isCurrent ? 'text-white' : isCalled ? 'text-white' : 'text-white/70'}
                `}>
                  {number}
                </span>
                
                {/* Called Indicator */}
                {isCalled && !isCurrent && (
                  <div className="absolute bottom-1 right-1 text-[8px] opacity-90">
                    ✓
                  </div>
                )}
                
                {/* Current Indicator */}
                {isCurrent && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center animate-ping">
                    <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
                  </div>
                )}
                
                {/* Hover Tooltip */}
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {column.letter}{number} {isCurrent ? '(Current)' : isCalled ? '(Called)' : '(Not called)'}
                </div>
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
  
  {/* Recent Called Numbers */}
  {allCalledNumbers.length > 0 && (
    <div className="mt-4 pt-4 border-t border-white/20">
      <div className="flex justify-between items-center mb-3">
        <p className="text-white/80 text-sm font-medium">Recently Called:</p>
        <span className="text-white/60 text-xs">
          Last {Math.min(allCalledNumbers.length, 10)} of {allCalledNumbers.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {allCalledNumbers.slice(-10).reverse().map((number, index) => {
          const letter = getNumberLetter(number);
          const isLatest = index === 0;
          
          return (
            <div 
              key={`recent-${number}-${index}`}
              className={`
                flex flex-col items-center justify-center px-2 py-1.5 rounded-lg 
                transition-all hover:scale-105 min-w-[45px] cursor-pointer
                ${isLatest 
                  ? 'bg-gradient-to-br from-yellow-500/40 to-orange-500/40 ring-1 ring-yellow-400/50' 
                  : 'bg-white/15 hover:bg-white/25'
                }
              `}
              onClick={() => handleMarkNumber(number)}
              title={`Click to mark ${letter}${number}`}
            >
              <div className="flex items-center gap-1">
                <span className={`
                  text-xs font-bold
                  ${isLatest ? 'text-yellow-300' : 'text-white/70'}
                `}>
                  {letter}
                </span>
                <span className={`
                  text-base font-bold
                  ${isLatest ? 'text-yellow-300' : 'text-white'}
                `}>
                  {number}
                </span>
              </div>
              {isLatest && (
                <span className="text-[9px] text-yellow-200/70 mt-0.5">LATEST</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  )}
  
  {/* Call Number Button */}
  {game.status === 'ACTIVE' && (
    <div className="mt-4 pt-4 border-t border-white/20">
      <button
        onClick={handleCallNumber}
        disabled={isCallingNumber}
        className={`
          w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium
          transition-all duration-300
          ${isCallingNumber 
            ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 cursor-not-allowed' 
            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:shadow-lg'
          }
        `}
      >
        {isCallingNumber ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Calling Next Number...
          </>
        ) : (
          <>
            <span className="text-xl">🎲</span>
            Call Next Number
          </>
        )}
      </button>
      <p className="text-white/60 text-xs text-center mt-2">
        Click to call the next BINGO number
      </p>
    </div>
  )}
</div>
            
            {/* Recent Called Numbers */}
            {allCalledNumbers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-white/80 text-sm font-medium">Recently Called:</p>
                  <span className="text-white/60 text-xs">
                    Last {Math.min(allCalledNumbers.length, 10)} of {allCalledNumbers.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allCalledNumbers.slice(-10).reverse().map((number, index) => {
                    const letter = getNumberLetter(number);
                    const isLatest = index === 0;
                    
                    return (
                      <div 
                        key={`recent-${number}-${index}`}
                        className={`
                          flex flex-col items-center justify-center px-2 py-1.5 rounded-lg 
                          transition-all hover:scale-105 min-w-[45px] cursor-pointer
                          ${isLatest 
                            ? 'bg-gradient-to-br from-yellow-500/40 to-orange-500/40 ring-1 ring-yellow-400/50' 
                            : 'bg-white/15 hover:bg-white/25'
                          }
                        `}
                        onClick={() => handleMarkNumber(number)}
                        title={`Click to mark ${letter}${number}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`
                            text-xs font-bold
                            ${isLatest ? 'text-yellow-300' : 'text-white/70'}
                          `}>
                            {letter}
                          </span>
                          <span className={`
                            text-base font-bold
                            ${isLatest ? 'text-yellow-300' : 'text-white'}
                          `}>
                            {number}
                          </span>
                        </div>
                        {isLatest && (
                          <span className="text-[9px] text-yellow-200/70 mt-0.5">LATEST</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Call Number Button */}
            {game.status === 'ACTIVE' && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <button
                  onClick={handleCallNumber}
                  disabled={isCallingNumber}
                  className={`
                    w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium
                    transition-all duration-300
                    ${isCallingNumber 
                      ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:shadow-lg'
                    }
                  `}
                >
                  {isCallingNumber ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Calling Next Number...
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🎲</span>
                      Call Next Number
                    </>
                  )}
                </button>
                <p className="text-white/60 text-xs text-center mt-2">
                  Click to call the next BINGO number
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Bingo Card - Less space (col-span-2) */}
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
                  <span className="text-white text-xs font-medium">{allCalledNumbers.length}/75</span>
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
                  ↻ Refresh Game
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-white/15 text-white py-1.5 rounded text-xs hover:bg-white/25 transition-all"
                >
                  ← Back to Lobby
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleCallNumber}
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
                  {allCalledNumbers.slice(-8).join(', ') || 'None'}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={handleCallNumber}
                  className="bg-yellow-500/20 text-yellow-300 py-1 rounded text-xs hover:bg-yellow-500/30 transition-all"
                >
                  Test Call #
                </button>
                <button
                  onClick={() => setAllCalledNumbers([])}
                  className="bg-red-500/20 text-red-300 py-1 rounded text-xs hover:bg-red-500/30 transition-all"
                >
                  Clear Called #
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
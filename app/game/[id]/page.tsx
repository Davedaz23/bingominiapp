// app/game/[id]/page.tsx - COMPLETE FIXED VERSION WITH REAL-TIME UPDATES
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
    refreshGame
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
  const [nextNumberCountdown, setNextNumberCountdown] = useState<number>(8);
  
  // Refs for tracking
  const calledNumbersRef = useRef<number[]>([]);
  const autoMarkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          // Use Telegram user ID instead of MongoDB ObjectId
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

  // Update called numbers and current number display when gameState changes
  useEffect(() => {
    if (gameState.calledNumbers && gameState.calledNumbers.length > 0) {
      const newCalledNumbers = gameState.calledNumbers;
      
      // Check if called numbers have changed
      if (JSON.stringify(calledNumbersRef.current) !== JSON.stringify(newCalledNumbers)) {
        calledNumbersRef.current = newCalledNumbers;
        setCalledNumbersHistory(newCalledNumbers);
        
        // Get the latest called number
        const latestNumber = newCalledNumbers[newCalledNumbers.length - 1];
        if (latestNumber && latestNumber !== lastCalledNumber) {
          setLastCalledNumber(latestNumber);
          
          // Calculate the letter for display
          const letter = getNumberLetter(latestNumber);
          setCurrentNumberDisplay({ number: latestNumber, letter });
          
          // Reset countdown when new number is called
          setNextNumberCountdown(8);
          
          console.log(`🔢 New number called: ${letter}${latestNumber}`);
          
          // Auto-mark this number on the user's card if they have it
          if (localBingoCard) {
            autoMarkNumberOnCard(latestNumber);
          }
        }
      }
    }
  }, [gameState.calledNumbers, localBingoCard]);

  // Start countdown for next number
  useEffect(() => {
    if (game?.status === 'ACTIVE') {
      // Clear existing interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // Start countdown from 8 seconds
      setNextNumberCountdown(8);
      
      countdownIntervalRef.current = setInterval(() => {
        setNextNumberCountdown(prev => {
          if (prev <= 1) {
            // When countdown reaches 0, refresh game to get new number
            refreshGame();
            return 8; // Reset to 8 seconds
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [game?.status, refreshGame]);

  // Helper function to get BINGO letter for a number
  const getNumberLetter = (num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  // Auto-mark number on card when it's called
  const autoMarkNumberOnCard = useCallback((number: number) => {
    if (!localBingoCard || !number) return;
    
    // Clear any existing timeout
    if (autoMarkTimeoutRef.current) {
      clearTimeout(autoMarkTimeoutRef.current);
    }
    
    autoMarkTimeoutRef.current = setTimeout(async () => {
      try {
        // Check if number exists on the card
        const flatNumbers = localBingoCard.numbers.flat();
        const position = flatNumbers.indexOf(number);
        
        if (position !== -1 && !localBingoCard.markedPositions.includes(position)) {
          console.log(`✅ Auto-marking ${number} on card at position ${position}`);
          
          // Update local state immediately for better UX
          setLocalBingoCard(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              markedPositions: [...prev.markedPositions, position]
            };
          });
          
          // Also mark via API if game is active
          if (game?.status === 'ACTIVE') {
            await handleMarkNumber(number);
          }
        }
      } catch (error) {
        console.error('Error auto-marking number:', error);
      }
    }, 500); // Small delay for better UX
  }, [localBingoCard, game]);

  const handleMarkNumber = async (number: number) => {
    if (isMarking) return;
    
    try {
      setIsMarking(true);
      console.log(`🎯 Attempting to mark number: ${number}`);
      
      // Check if number has been called
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
      console.log(`✅ Manually called number: ${number}`);
    } catch (error) {
      console.error('Failed to manually call number:', error);
    }
  };

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

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Called Numbers - ENHANCED */}
        <div className="col-span-1">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 h-full flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold">Called Numbers</h3>
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-sm">
                  {calledNumbersHistory.length}/75
                </span>
                {game?.status === 'ACTIVE' && (
                  <span className="text-green-300 text-xs bg-green-500/20 px-2 py-1 rounded-full animate-pulse">
                    Live
                  </span>
                )}
              </div>
            </div>
            
            {/* Current Number Display - ENHANCED */}
            {currentNumberDisplay.number && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-xl border border-white/20 animate-pulse-slow">
                <p className="text-white/80 text-xs mb-1 text-center uppercase tracking-wider">Current Number</p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <span className="text-6xl font-bold text-yellow-300 block leading-none">
                      {currentNumberDisplay.number}
                    </span>
                    <span className="text-white/60 text-xs mt-1 block">Number</span>
                  </div>
                  <div className="text-center">
                    <span className="text-4xl font-bold text-white block leading-none">
                      {currentNumberDisplay.letter}
                    </span>
                    <span className="text-white/60 text-xs mt-1 block">Letter</span>
                  </div>
                </div>
                {game?.status === 'ACTIVE' && (
                  <div className="mt-3 text-center">
                    <p className="text-white/60 text-xs">
                      Next number in: <span className="text-yellow-300 font-bold">{nextNumberCountdown}s</span>
                    </p>
                    <div className="w-full bg-blue-400/20 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-cyan-400 h-1.5 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${((8 - nextNumberCountdown) / 8) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 75 Numbers Grid - ENHANCED (Wider, no letters) */}
            <div className="grid grid-cols-10 gap-1.5 flex-1 overflow-y-auto p-2 bg-black/20 rounded-lg">
              {Array.from({ length: 75 }, (_, i) => i + 1).map((number: number) => {
                const isCalled = gameState.calledNumbers.includes(number);
                const isCurrent = number === currentNumberDisplay.number;
                
                return (
                  <div
                    key={number}
                    className={`
                      aspect-square rounded-lg flex items-center justify-center 
                      font-bold text-sm transition-all duration-300 cursor-pointer
                      hover:scale-110 hover:z-10 relative
                      ${isCurrent
                        ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white scale-125 ring-3 ring-yellow-400 shadow-lg animate-pulse'
                        : isCalled
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                        : 'bg-white/15 text-white/70 hover:bg-white/25'
                      }
                    `}
                    onClick={() => isCalled && handleMarkNumber(number)}
                    title={isCalled ? `Click to mark ${getNumberLetter(number)}${number} on your card` : 'Not called yet'}
                  >
                    {/* Show only the number - NO LETTERS */}
                    <div className="text-center">
                      <div className={`${isCurrent ? 'text-lg font-bold' : 'text-base'} ${isCalled && !isCurrent ? 'font-medium' : ''}`}>
                        {number}
                      </div>
                      {isCalled && !isCurrent && (
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-green-300 rounded-full"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Last Called Numbers List - ENHANCED */}
            {calledNumbersHistory.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-white/80 text-xs mb-2">Recently Called:</p>
                <div className="flex flex-wrap gap-2">
                  {[...calledNumbersHistory].reverse().slice(0, 12).map((num, index) => {
                    const isLatest = index === 0;
                    return (
                      <div 
                        key={`recent-${num}`}
                        className={`
                          px-2.5 py-1.5 rounded-lg flex flex-col items-center justify-center min-w-[50px]
                          transition-all duration-300
                          ${isLatest 
                            ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-500/50' 
                            : 'bg-white/10'
                          }
                        `}
                      >
                        <div className={`${isLatest ? 'text-yellow-300 text-xs' : 'text-white/60 text-xs'}`}>
                          {getNumberLetter(num)}
                        </div>
                        <div className={`${isLatest ? 'text-white font-bold text-lg' : 'text-white font-medium text-base'}`}>
                          {num}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Game Status Info */}
            <div className="mt-4 p-3 bg-black/20 rounded-lg">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="text-white font-medium">Numbers Called</p>
                  <p className="text-white/80 text-sm font-bold">{calledNumbersHistory.length}/75</p>
                </div>
                <div>
                  <p className="text-white font-medium">Next Number In</p>
                  <p className="text-white/80 text-sm font-bold">{game?.status === 'ACTIVE' ? `${nextNumberCountdown}s` : '--'}</p>
                </div>
                <div>
                  <p className="text-white font-medium">Game Status</p>
                  <p className={`font-medium text-sm ${
                    game?.status === 'ACTIVE' ? 'text-green-300' : 
                    game?.status === 'WAITING' ? 'text-yellow-300' : 
                    'text-red-300'
                  }`}>
                    {game?.status || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Bingo Card */}
        <div className="col-span-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold">Your Bingo Card</h3>
              <div className="flex items-center gap-2">
                {selectedNumber && (
                  <span className="text-white/80 text-sm bg-white/20 px-3 py-1 rounded-full">
                    Card #{selectedNumber}
                  </span>
                )}
                <div className="text-white/60 text-sm">
                  Marked: {displayBingoCard?.markedPositions?.length || 0}/24
                </div>
              </div>
            </div>
            
            {displayBingoCard ? (
              <div className="mb-4">
                {/* BINGO Header */}
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                    <div 
                      key={letter}
                      className="aspect-square rounded-lg flex items-center justify-center font-bold text-xl text-white bg-gradient-to-b from-purple-500 to-blue-600"
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
                      const letter = ['B', 'I', 'N', 'G', 'O'][colIndex];

                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`
                            aspect-square rounded-lg flex flex-col items-center justify-center 
                            font-bold transition-all duration-200 relative
                            ${isMarked
                              ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                              : isFreeSpace
                              ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                              : isCalled
                              ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-white hover:scale-105 cursor-pointer'
                              : 'bg-white/10 text-white hover:bg-white/20'
                            }
                            ${isCalled && !isMarked && !isFreeSpace ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                          `}
                          onClick={() => 
                            !isFreeSpace && isCalled && !isMarked && handleMarkNumber(number as number)
                          }
                          title={
                            isFreeSpace ? 'FREE SPACE' :
                            isMarked ? `Marked: ${letter}${number}` :
                            isCalled ? `Click to mark ${letter}${number}` :
                            `${letter}${number}`
                          }
                        >
                          {isFreeSpace ? (
                            <>
                              <div className="text-xs opacity-80">FREE</div>
                              <div className="text-[10px] opacity-60">SPACE</div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs opacity-70">{letter}</div>
                              <div className={`text-sm ${isMarked ? 'line-through' : ''}`}>
                                {number}
                              </div>
                              {isMarked && (
                                <div className="text-[8px] mt-0.5 opacity-80">✓</div>
                              )}
                            </>
                          )}
                          {isCalled && !isMarked && !isFreeSpace && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Card Stats */}
                <div className="mt-3 flex justify-between items-center text-white/60 text-sm">
                  <div>
                    Matches: {displayBingoCard.markedPositions?.length || 0} numbers
                  </div>
                  <div>
                    Total Called: {calledNumbersHistory.length} numbers
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-white/60 py-8">
                <p>No bingo card found</p>
                <p className="text-sm mt-2">{cardError}</p>
                <button 
                  onClick={() => router.push('/')}
                  className="mt-4 bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
                >
                  Select a Card
                </button>
              </div>
            )}
          </div>

          {/* Game Controls & Info */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Game Status Card - ENHANCED */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <h4 className="text-white font-bold mb-2">Game Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/70 text-sm">Status:</span>
                  <span className={`text-sm font-medium ${
                    game.status === 'ACTIVE' ? 'text-green-300' :
                    game.status === 'WAITING' ? 'text-yellow-300' :
                    'text-red-300'
                  }`}>
                    {game.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70 text-sm">Players:</span>
                  <span className="text-white text-sm">{game.currentPlayers || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70 text-sm">Called Numbers:</span>
                  <span className="text-white text-sm">{calledNumbersHistory.length}/75</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70 text-sm">Next Number In:</span>
                  <span className="text-white text-sm">
                    {game?.status === 'ACTIVE' ? `${nextNumberCountdown}s` : '--'}
                  </span>
                </div>
                {game?.status === 'ACTIVE' && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>Auto-calling active</span>
                      <span>Every 5-8s</span>
                    </div>
                    <div className="w-full bg-green-400/20 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-cyan-400 h-1.5 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${((8 - nextNumberCountdown) / 8) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions - ENHANCED */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <h4 className="text-white font-bold mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    console.log('🔄 Manual refresh triggered');
                    refreshGame();
                  }}
                  className="w-full bg-blue-500/20 text-blue-300 py-2 rounded-lg text-sm hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Game
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-white/20 text-white py-2 rounded-lg text-sm hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Lobby
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleManualCallNumber}
                    className="w-full bg-yellow-500/20 text-yellow-300 py-2 rounded-lg text-sm hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Call Next Number (Dev)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Debug Info - ENHANCED */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-500/10 backdrop-blur-lg rounded-2xl p-4 mt-4 border border-yellow-500/20">
              <h4 className="text-yellow-300 font-bold mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Debug Information
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-yellow-200/70">Card Status:</p>
                  <p className="text-yellow-200">{displayBingoCard ? '✅ Loaded' : '❌ Missing'}</p>
                </div>
                <div>
                  <p className="text-yellow-200/70">Card #:</p>
                  <p className="text-yellow-200">{selectedNumber || 'None'}</p>
                </div>
                <div>
                  <p className="text-yellow-200/70">Marked:</p>
                  <p className="text-yellow-200">{displayBingoCard?.markedPositions?.length || 0}</p>
                </div>
                <div>
                  <p className="text-yellow-200/70">Current #:</p>
                  <p className="text-yellow-200">{currentNumberDisplay.number || 'None'}</p>
                </div>
                <div>
                  <p className="text-yellow-200/70">Total Called:</p>
                  <p className="text-yellow-200">{calledNumbersHistory.length}</p>
                </div>
                <div>
                  <p className="text-yellow-200/70">Polling:</p>
                  <p className="text-yellow-200">
                    {game?.status === 'ACTIVE' ? '2s' : 
                     game?.status === 'WAITING' ? '8s' : 
                     '15s'}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-yellow-500/20">
                <p className="text-yellow-200/70 text-xs mb-1">Called Numbers (Latest 10):</p>
                <div className="flex flex-wrap gap-1">
                  {calledNumbersHistory.slice(-10).map((num, index) => (
                    <span key={`debug-${num}`} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-200 rounded text-xs">
                      {getNumberLetter(num)}{num}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <p className="text-yellow-200/70 text-xs">Game ID:</p>
                <p className="text-yellow-200 text-xs break-all">{id}</p>
              </div>
              
              {/* Test buttons */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    console.log('🎮 Manual game refresh');
                    refreshGame();
                  }}
                  className="bg-blue-500/20 text-blue-300 py-1.5 rounded text-xs hover:bg-blue-500/30"
                >
                  Force Refresh
                </button>
                <button
                  onClick={handleManualCallNumber}
                  className="bg-green-500/20 text-green-300 py-1.5 rounded text-xs hover:bg-green-500/30"
                >
                  Test Call Number
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
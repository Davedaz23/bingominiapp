// app/game/[id]/page.tsx - COMPLETE FIXED VERSION
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
    manualCallNumber // Add this for testing
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
  
  // Refs for tracking
  const calledNumbersRef = useRef<number[]>([]);
  const autoMarkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          
          console.log(`🔢 New number called: ${letter}${latestNumber}`);
          
          // Auto-mark this number on the user's card if they have it
          if (localBingoCard) {
            autoMarkNumberOnCard(latestNumber);
          }
        }
      }
    }
  }, [gameState.calledNumbers, localBingoCard]);

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
        {/* Left: Called Numbers */}
        <div className="col-span-1">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold">Called Numbers</h3>
              <span className="text-white/60 text-sm">
                {calledNumbersHistory.length}/75
              </span>
            </div>
            
            {/* Current Number Display */}
            {currentNumberDisplay.number && (
              <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl border border-white/20">
                <p className="text-white/80 text-xs mb-1 text-center">Current Number</p>
                <div className="flex items-center justify-center">
                  <span className="text-4xl font-bold text-white mr-2">
                    {currentNumberDisplay.letter}
                  </span>
                  <span className="text-5xl font-bold text-yellow-300">
                    {currentNumberDisplay.number}
                  </span>
                </div>
                <p className="text-white/60 text-xs text-center mt-1">
                  Click on called numbers to mark your card
                </p>
              </div>
            )}
            
            {/* Called Numbers Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto p-2">
              {Array.from({ length: 75 }, (_, i) => i + 1).map((number: number) => {
                const isCalled = gameState.calledNumbers.includes(number);
                const isCurrent = number === currentNumberDisplay.number;
                const letter = getNumberLetter(number);
                
                return (
                  <div
                    key={number}
                    className={`
                      aspect-square rounded-lg flex flex-col items-center justify-center 
                      font-bold text-xs transition-all duration-200 cursor-pointer
                      ${isCurrent
                        ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white scale-110 ring-2 ring-yellow-400'
                        : isCalled
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:scale-105'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }
                    `}
                    onClick={() => isCalled && handleMarkNumber(number)}
                    title={isCalled ? `Click to mark ${letter}${number} on your card` : 'Not called yet'}
                  >
                    <div className="text-xs opacity-70">{letter}</div>
                    <div className="text-sm">{number}</div>
                    {isCalled && (
                      <div className="text-[8px] mt-0.5 opacity-80">✓</div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Last Called Numbers List */}
            {calledNumbersHistory.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-white/80 text-xs mb-2">Recently Called:</p>
                <div className="flex flex-wrap gap-1">
                  {[...calledNumbersHistory].reverse().slice(0, 10).map((num, index) => (
                    <div 
                      key={`recent-${num}`}
                      className="px-2 py-1 bg-white/10 rounded text-xs text-white"
                    >
                      {getNumberLetter(num)}{num}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                            font-bold transition-all duration-200
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
            {/* Game Status Card */}
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
                  <span className="text-white text-sm">~5-8s</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <h4 className="text-white font-bold mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => router.refresh()}
                  className="w-full bg-white/20 text-white py-2 rounded-lg text-sm hover:bg-white/30 transition-colors"
                >
                  ↻ Refresh Game
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-white/20 text-white py-2 rounded-lg text-sm hover:bg-white/30 transition-colors"
                >
                  ← Back to Lobby
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleManualCallNumber}
                    className="w-full bg-yellow-500/20 text-yellow-300 py-2 rounded-lg text-sm hover:bg-yellow-500/30 transition-colors"
                  >
                    🎲 Call Next Number (Dev)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-500/10 backdrop-blur-lg rounded-2xl p-4 mt-4 border border-yellow-500/20">
              <h4 className="text-yellow-300 font-bold mb-2">Debug Info</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-yellow-200/70">Card:</p>
                  <p className="text-yellow-200">{displayBingoCard ? 'Loaded' : 'Missing'}</p>
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
                  <p className="text-yellow-200/70">Error:</p>
                  <p className="text-yellow-200">{cardError || 'None'}</p>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-yellow-200/70 text-xs">Called Numbers:</p>
                <p className="text-yellow-200 text-xs">
                  {calledNumbersHistory.slice(-10).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// app/game/[id]/page.tsx - IMPROVED ERROR HANDLING
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  
  const { game, bingoCard: gameBingoCard, gameState, markNumber, isLoading } = useGame(id);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [localBingoCard, setLocalBingoCard] = useState<LocalBingoCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState<boolean>(true);
  const [cardError, setCardError] = useState<string>('');

  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Load wallet balance
        const walletResponse = await walletAPIAuto.getBalance();
        if (walletResponse.data.success) {
          setWalletBalance(walletResponse.data.balance);
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
          // Check if it's the ObjectId casting error
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

  const handleMarkNumber = async (number: number) => {
    try {
      await markNumber(number);
      setSelectedNumber(number);
      
      // Update local bingo card marked positions with proper typing
      if (localBingoCard) {
        setLocalBingoCard((prev: LocalBingoCard | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            markedPositions: [...(prev.markedPositions || []), number]
          };
        });
      }
    } catch (error) {
      console.error('Failed to mark number:', error);
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
        <div className="grid grid-cols-5 gap-4 text-center">
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
            <h3 className="text-white font-bold mb-3 text-center">Called Numbers</h3>
            <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto">
              {Array.from({ length: 75 }, (_, i) => i + 1).map((number: number) => (
                <div
                  key={number}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center font-bold text-sm
                    ${gameState.calledNumbers.includes(number)
                      ? 'bg-green-500 text-white'
                      : selectedNumber === number
                      ? 'bg-yellow-500 text-white'
                      : 'bg-white/20 text-white'
                    }
                    ${gameState.currentNumber === number ? 'ring-2 ring-yellow-400 scale-110' : ''}
                  `}
                  onClick={() => gameState.calledNumbers.includes(number) && handleMarkNumber(number)}
                >
                  {number}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Bingo Card */}
        <div className="col-span-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold">Your Bingo Card</h3>
              {selectedNumber && (
                <span className="text-white/80 text-sm bg-white/20 px-3 py-1 rounded-full">
                  Card #{selectedNumber}
                </span>
              )}
            </div>
            
            {displayBingoCard ? (
              <div className="grid grid-cols-5 gap-2">
                {displayBingoCard.numbers.map((row: (number | string)[], rowIndex: number) =>
                  row.map((number: number | string, colIndex: number) => {
                    const isMarked = displayBingoCard.markedPositions?.includes(number as number) || 
                                    (displayBingoCard.selected && displayBingoCard.selected[rowIndex]?.[colIndex]);
                    const isCalled = gameState.calledNumbers.includes(number as number);
                    const isFreeSpace = rowIndex === 2 && colIndex === 2;

                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`
                          aspect-square rounded-lg flex items-center justify-center font-bold
                          ${isMarked
                            ? 'bg-green-500 text-white'
                            : isCalled
                            ? 'bg-yellow-500 text-white'
                            : isFreeSpace
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/20 text-white'
                          }
                          transition-all duration-200 hover:scale-105 cursor-pointer
                        `}
                        onClick={() => 
                          !isFreeSpace && isCalled && !isMarked && handleMarkNumber(number as number)
                        }
                      >
                        {isFreeSpace ? 'FREE' : number}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="text-center text-white/60 py-8">
                <p>No bingo card found</p>
                <p className="text-sm mt-2">{cardError}</p>
                <button 
                  onClick={() => router.push('/')}
                  className="mt-4 bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30"
                >
                  Select a Card
                </button>
              </div>
            )}
          </div>

          {/* Current Number */}
          {gameState.currentNumber && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mt-4 border border-white/20 text-center">
              <p className="text-white/80 text-sm mb-2">Current Number</p>
              <p className="text-6xl font-bold text-white">{gameState.currentNumber}</p>
            </div>
          )}

          {/* Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 mt-4 border border-yellow-500/30">
              <h4 className="text-yellow-300 font-bold mb-2">Debug Info</h4>
              <p className="text-yellow-200 text-xs">
                Card Loaded: {displayBingoCard ? 'Yes' : 'No'} | 
                Card Number: {selectedNumber || 'None'} | 
                Marked: {displayBingoCard?.markedPositions?.length || 0} |
                Card Error: {cardError || 'None'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
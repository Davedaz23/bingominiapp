// app/game/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useGame } from '../../../hooks/useGame';
import { walletAPIAuto } from '../../../services/api';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const { game, bingoCard, gameState, markNumber, isLoading } = useGame(id);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        const response = await walletAPIAuto.getBalance();
        if (response.data.success) {
          setWalletBalance(response.data.balance);
        }
      } catch (error) {
        console.error('Failed to load wallet:', error);
      }
    };

    loadWallet();
  }, []);

  const handleMarkNumber = async (number: number) => {
    try {
      await markNumber(number);
      setSelectedNumber(number);
    } catch (error) {
      console.error('Failed to mark number:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading game...</p>
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
        <div className="grid grid-cols-4 gap-4 text-center">
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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Called Numbers */}
        <div className="col-span-1">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <h3 className="text-white font-bold mb-3 text-center">Called Numbers</h3>
            <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto">
              {Array.from({ length: 75 }, (_, i) => i + 1).map((number) => (
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
            <h3 className="text-white font-bold mb-3 text-center">Your Bingo Card</h3>
            {bingoCard ? (
              <div className="grid grid-cols-5 gap-2">
                {bingoCard.numbers.map((row, rowIndex) =>
                  row.map((number, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`
                        aspect-square rounded-lg flex items-center justify-center font-bold
                        ${bingoCard.markedPositions?.includes(number) || bingoCard.selected?.[rowIndex]?.[colIndex]
                          ? 'bg-green-500 text-white'
                          : gameState.calledNumbers.includes(number)
                          ? 'bg-yellow-500 text-white'
                          : rowIndex === 2 && colIndex === 2
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/20 text-white'
                        }
                      `}
                      onClick={() => 
                        gameState.calledNumbers.includes(number) && 
                        handleMarkNumber(number)
                      }
                    >
                      {number === 0 ? 'FREE' : number}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center text-white/60 py-8">
                Loading your bingo card...
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
        </div>
      </div>
    </div>
  );
}
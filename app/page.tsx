// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { walletAPIAuto, gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [showNumberSelection, setShowNumberSelection] = useState<boolean>(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [joining, setJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const initializeApp = async () => {
      if (!isAuthenticated) return;

      try {
        setLoading(true);
        
        // Load wallet balance
        const walletResponse = await walletAPIAuto.getBalance();
        if (walletResponse.data.success) {
          setWalletBalance(walletResponse.data.balance);
        }

        // Check for active games
        const activeGamesResponse = await gameAPI.getActiveGames();
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          // Redirect to the first active game
          const game = activeGamesResponse.data.games[0];
          setActiveGame(game);
          router.push(`/game/${game._id}`);
        } else {
          // No active games, show number selection
          setShowNumberSelection(true);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setShowNumberSelection(true);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, [isAuthenticated, router]);

  const handleNumberSelect = async (number: number) => {
    setSelectedNumber(number);
    setJoining(true);
    setJoinError('');

    try {
      // Find waiting games
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        // Join existing waiting game
        const game = waitingGamesResponse.data.games[0];
        const joinResponse = await gameAPI.joinGameWithWallet(game.code, user!.id, 10);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          
          // Redirect to game page after short delay
          setTimeout(() => {
            router.push(`/game/${updatedGame._id}`);
          }, 3000);
        } else {
          setJoinError(joinResponse.data.success || 'Failed to join game');
        }
      } else {
        setJoinError('No available games at the moment. Please try again later.');
      }
    } catch (error: any) {
      console.error('Failed to join game:', error);
      const errorMessage = error.response?.data?.message || 'Failed to join game. Please try again.';
      setJoinError(errorMessage);
      
      // Even if join fails, keep the selection so user can see what's happening
      // They can still observe the game
      if (error.response?.data?.game) {
        // If we have game data despite the error, redirect to watch mode
        setTimeout(() => {
          router.push(`/game/${error.response.data.game._id}?spectator=true`);
        }, 3000);
      }
    } finally {
      setJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">Loading Bingo Game...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!showNumberSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Looking for active games...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      {/* Header with Wallet */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white font-bold text-xl">Bingo Game</h1>
            <p className="text-white/60 text-sm">Select your card number</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg">{walletBalance} ብር</p>
            <p className="text-white/60 text-xs">Balance</p>
          </div>
        </div>
      </div>

      {/* Selected Number Display */}
      {selectedNumber && (
        <div className={`backdrop-blur-lg rounded-2xl p-4 mb-6 border text-center ${
          joinError 
            ? 'bg-red-500/20 border-red-500/30' 
            : 'bg-yellow-500/20 border-yellow-500/30'
        }`}>
          <p className="text-white font-bold text-lg">
            Selected Card: #{selectedNumber}
          </p>
          <p className={`text-sm ${
            joinError ? 'text-red-300' : 'text-yellow-300'
          }`}>
            {joining 
              ? 'Joining game...' 
              : joinError 
                ? joinError
                : 'Redirecting to game...'
            }
          </p>
          {joinError && walletBalance < 10 && (
            <p className="text-white/80 text-sm mt-2">
              You can still watch the game as a spectator!
            </p>
          )}
        </div>
      )}

      {/* Number Selection Grid */}
      <div className="grid grid-cols-8 gap-2 max-h-[70vh] overflow-y-auto">
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => (
          <button
            key={number}
            onClick={() => handleNumberSelect(number)}
            disabled={selectedNumber !== null || joining}
            className={`
              aspect-square rounded-xl font-bold text-sm transition-all
              ${selectedNumber === number
                ? joinError
                  ? 'bg-red-500 text-white scale-105'
                  : 'bg-yellow-500 text-white scale-105'
                : walletBalance >= 10
                ? 'bg-white/20 text-white hover:bg-white/30 hover:scale-105'
                : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
              }
              border-2 ${
                selectedNumber === number
                  ? joinError
                    ? 'border-red-400'
                    : 'border-yellow-400'
                  : 'border-white/20'
              }
              ${joining ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {number}
          </button>
        ))}
      </div>

      {/* Game Info */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mt-6 border border-white/20">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-white font-bold">10 ብር</p>
            <p className="text-white/60 text-xs">Bet Amount</p>
          </div>
          <div>
            <p className="text-white font-bold">30s</p>
            <p className="text-white/60 text-xs">Wait Time</p>
          </div>
        </div>
        
        {/* Informational messages */}
        <div className="mt-3 space-y-2">
          {walletBalance < 10 && !selectedNumber && (
            <p className="text-yellow-300 text-sm text-center">
              Insufficient balance to play, but you can still select a card to watch the game
            </p>
          )}
          <p className="text-white/60 text-xs text-center">
            Select any card number to join the game or watch others play
          </p>
        </div>
      </div>
    </div>
  );
}
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
    if (walletBalance < 10) {
      alert('Insufficient balance. Minimum 10 ብር required to play.');
      return;
    }

    setSelectedNumber(number);
    setJoining(true);

    try {
      // Find or create a waiting game
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      let game;

      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        // Join existing waiting game
        game = waitingGamesResponse.data.games[0];
        const joinResponse = await gameAPI.joinGameWithWallet(game.code, user!.id, 10);
        if (joinResponse.data.success) {
          game = joinResponse.data.game;
        }
      } 

      if (game) {
        // Redirect to game page after 30 seconds
        setTimeout(() => {
          router.push(`/game/${game._id}`);
        }, 30000);
      }
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to join game. Please try again.');
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
        <div className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-yellow-500/30 text-center">
          <p className="text-yellow-300 font-bold text-lg">
            Selected Card: #{selectedNumber}
          </p>
          <p className="text-yellow-400/80 text-sm">
            {joining ? 'Joining game...' : 'Game starts in 30 seconds'}
          </p>
        </div>
      )}

      {/* Number Selection Grid */}
      <div className="grid grid-cols-8 gap-2 max-h-[70vh] overflow-y-auto">
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => (
          <button
            key={number}
            onClick={() => handleNumberSelect(number)}
            disabled={walletBalance < 10 || selectedNumber !== null || joining}
            className={`
              aspect-square rounded-xl font-bold text-sm transition-all
              ${selectedNumber === number
                ? 'bg-yellow-500 text-white scale-105'
                : walletBalance >= 10
                ? 'bg-white/20 text-white hover:bg-white/30 hover:scale-105'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
              }
              border-2 ${
                selectedNumber === number
                  ? 'border-yellow-400'
                  : 'border-white/20'
              }
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
        {walletBalance < 10 && (
          <p className="text-red-300 text-sm text-center mt-3">
            Minimum 10 ብር required to play
          </p>
        )}
      </div>
    </div>
  );
}
// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { walletAPIAuto } from '../services/api';
import Link from 'next/link';
import { Play, Users, Trophy, Star, Zap, Gamepad2 } from 'lucide-react';

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [activeGames, setActiveGames] = useState<number>(0);
  const [waitingGames, setWaitingGames] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadWallet = async () => {
      if (!isAuthenticated) {
        setWalletBalance(0);
        setActiveGames(0);
        setWaitingGames(0);
        return;
      }

      try {
        setWalletLoading(true);
        console.log('Loading wallet for authenticated user...');
        
        // Use walletAPIAuto which automatically gets the user ID
        const response = await walletAPIAuto.getBalance();
        
        if (response.data.success) {
          console.log('Wallet loaded successfully:', response.data.balance);
          setWalletBalance(response.data.balance);
        } else {
          console.warn('Wallet response not successful, using fallback');
          setWalletBalance(100);
        }
      } catch (error) {
        console.error('Failed to load wallet:', error);
        // Use fallback balance
        setWalletBalance(100);
      } finally {
        setWalletLoading(false);
      }
    };

    const loadGameStats = async () => {
      if (!isAuthenticated) {
        setActiveGames(0);
        setWaitingGames(0);
        return;
      }

      try {
        // Simulate loading game stats - you can replace with actual API calls
        setActiveGames(Math.floor(Math.random() * 5) + 1);
        setWaitingGames(Math.floor(Math.random() * 3) + 1);
      } catch (error) {
        console.error('Failed to load game stats:', error);
      }
    };

    loadWallet();
    loadGameStats();
  }, [isAuthenticated]);

  // Show loading state only during initial auth loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">Loading Bingo Game...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white/60 mt-4">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Gamepad2 className="w-10 h-10 text-white" />
            <h1 className="text-4xl font-bold text-white">Bingo Blitz</h1>
          </div>
          <p className="text-white/80 text-lg">Telegram Mini App</p>
          
          {user ? (
            <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-white font-semibold">Welcome, {user.firstName}!</p>
                  <p className="text-white/80 text-sm">@{user.username || 'player'}</p>
                </div>
                <div className="text-right">
                  {walletLoading ? (
                    <div className="animate-pulse">
                      <div className="h-6 w-16 bg-white/20 rounded mb-1"></div>
                      <div className="h-3 w-12 bg-white/20 rounded"></div>
                    </div>
                  ) : (
                    <>
                      <p className="text-white font-bold text-lg">{walletBalance} ብር</p>
                      <p className="text-white/60 text-xs">Balance</p>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3 text-center">
                <div className="bg-white/5 rounded-xl p-2">
                  <p className="text-white font-bold">{user.gamesPlayed || 0}</p>
                  <p className="text-white/60 text-xs">Games Played</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2">
                  <p className="text-yellow-400 font-bold">{user.gamesWon || 0}</p>
                  <p className="text-white/60 text-xs">Games Won</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 max-w-md mx-auto">
              <p className="text-white text-lg font-semibold mb-2">Welcome to Bingo Blitz!</p>
              <p className="text-white/80 text-sm">
                Please wait while we initialize your session...
              </p>
              <div className="mt-4 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            </div>
          )}
        </header>

        {/* Only show game content if user is authenticated */}
        {user && (
          <>
            {/* Game Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-green-400" />
                  <span className="text-white font-bold text-xl">{activeGames}</span>
                </div>
                <p className="text-white/80 text-sm">Active Games</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-bold text-xl">{waitingGames}</span>
                </div>
                <p className="text-white/80 text-sm">Waiting Games</p>
              </div>
            </div>

            {/* Main Actions */}
            <div className="space-y-4 mb-8">
              <Link 
                href="/games"
                className="block bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-2xl text-center transition-all transform hover:scale-105 shadow-lg"
              >
                <div className="flex items-center justify-center gap-3">
                  <Play className="w-6 h-6" />
                  <span className="text-lg">Play Bingo</span>
                </div>
                <p className="text-white/80 text-sm mt-1">Join or create a new game</p>
              </Link>

              <Link 
                href="/deposit"
                className="block bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-4 px-6 rounded-2xl text-center transition-all transform hover:scale-105 shadow-lg"
              >
                <div className="flex items-center justify-center gap-3">
                  <Star className="w-6 h-6" />
                  <span className="text-lg">Add Funds</span>
                </div>
                <p className="text-white/80 text-sm mt-1">Deposit to your wallet</p>
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
              <h2 className="text-white font-bold text-xl mb-4 text-center">Game Features</h2>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white/5 rounded-xl p-3">
                  <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">Win Prizes</p>
                  <p className="text-white/60 text-xs">Compete for big rewards</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">Multiplayer</p>
                  <p className="text-white/60 text-xs">Play with friends</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <Zap className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">Fast Games</p>
                  <p className="text-white/60 text-xs">Quick 5-10 minute rounds</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <Star className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">Easy to Play</p>
                  <p className="text-white/60 text-xs">Simple rules, fun gameplay</p>
                </div>
              </div>
            </div>

            {/* How to Play */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-white font-bold text-xl mb-4 text-center">How to Play</h2>
              <div className="space-y-3 text-white/80">
                <div className="flex items-start gap-3">
                  <div className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">1</div>
                  <p>Join a game or create your own</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">2</div>
                  <p>Mark numbers on your bingo card as they're called</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">3</div>
                  <p>Complete a line, pattern, or full house to win!</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">4</div>
                  <p>Collect your prize and play again!</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="text-center mt-8">
          <p className="text-white/60 text-sm">
            {user 
              ? "Ready to experience the thrill of Bingo? Start playing now!"
              : "Initializing your gaming session..."
            }
          </p>
        </footer>
      </div>
    </div>
  );
}
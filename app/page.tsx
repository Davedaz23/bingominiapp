// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
// import { gameService } from '../services/gameService';
import { walletAPIAuto } from '../services/api';

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    const loadWallet = async () => {
      try {
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
      }
    };

    if (isAuthenticated) {
      loadWallet();
    } else {
      // Reset balance when not authenticated
      setWalletBalance(0);
    }
  }, [isAuthenticated]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">Bingo Game</h1>
          <p className="text-white text-lg">Telegram Mini App</p>
          {user && (
            <p className="text-white text-sm mt-2">
              Welcome, {user.firstName}! | Balance: {walletBalance} ብር
            </p>
          )}
        </header>

        <div className="text-center">
          <p className="text-white text-lg mb-4">
            Ready to play Bingo? The full game interface will be implemented next.
          </p>
        </div>
      </div>
    </div>
  );
}
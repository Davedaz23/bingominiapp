// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { walletAPIAuto, gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { Check, Grid3X3, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

// Memoized Bingo Card Component matching your design system
const BingoCardPreview = ({ cardNumber, numbers }: { cardNumber: number; numbers: (number | string)[][] }) => {
  // Transform the column-based array to row-based for proper display
  const transformCardToRows = (columnBasedCard: (number | string)[][]) => {
    const rows = [];
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      for (let col = 0; col < 5; col++) {
        rowData.push(columnBasedCard[col][row]);
      }
      rows.push(rowData);
    }
    return rows;
  };

  const rows = transformCardToRows(numbers);

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-3 border border-gray-200">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black text-gray-800 flex items-center gap-1">
          <Grid3X3 className="w-3 h-3 text-telegram-button" />
          Your Card
        </h3>
        <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
          <RotateCcw className="w-2.5 h-2.5" />
          #{cardNumber}
        </div>
      </div>

      {/* BINGO Header - Compact */}
      <div className="grid grid-cols-5 gap-0.5 mb-1">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div
            key={letter}
            className="text-center font-black text-xs text-telegram-button bg-telegram-button/10 py-1 rounded-md"
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Numbers Grid - Compact */}
      <div className="grid grid-cols-5 gap-0.5">
        {rows.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <motion.div
              key={`${rowIndex}-${colIndex}`}
              className={`
                aspect-square rounded-md flex items-center justify-center font-bold text-xs
                border transition-all duration-200 cursor-default relative
                ${cell === 'FREE' 
                  ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-sm' 
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {cell}
              
              {/* FREE indicator */}
              {cell === 'FREE' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-2 h-2 text-white drop-shadow-sm" />
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Card Info - Compact */}
      <div className="mt-2 flex justify-between items-center text-[10px] text-gray-600 border-t border-gray-200 pt-2">
        <div className="text-center">
          <div className="font-black text-telegram-button">5×5</div>
          <div>Grid</div>
        </div>
        <div className="text-center">
          <div className="font-black text-gray-400">24</div>
          <div>Numbers</div>
        </div>
        <div className="text-center">
          <div className="font-black text-green-500">1</div>
          <div>FREE</div>
        </div>
      </div>
    </div>
  );
};

// Function to generate bingo card numbers based on selected card number
const generateBingoCard = (cardNumber: number) => {
  // Use the card number as a seed for consistent card generation
  const seed = cardNumber * 12345;
  
  // Bingo card structure: 5x5 grid with FREE space in center
  const card = [];
  
  // B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
  const ranges = [
    { min: 1, max: 15 },   // B
    { min: 16, max: 30 },  // I
    { min: 31, max: 45 },  // N
    { min: 46, max: 60 },  // G
    { min: 61, max: 75 }   // O
  ];

  for (let col = 0; col < 5; col++) {
    const column = [];
    const usedNumbers = new Set();
    const range = ranges[col];
    
    for (let row = 0; row < 5; row++) {
      // Center is FREE space
      if (col === 2 && row === 2) {
        column.push('FREE');
        continue;
      }
      
      // Generate unique number for this column
      let number;
      let attempts = 0;
      do {
        const random = Math.sin(seed + col * 5 + row) * 10000;
        number = range.min + Math.floor((random - Math.floor(random)) * (range.max - range.min + 1));
        attempts++;
      } while (usedNumbers.has(number) && attempts < 10);
      
      usedNumbers.add(number);
      column.push(number);
    }
    card.push(column);
  }
  
  return card;
};

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [showNumberSelection, setShowNumberSelection] = useState<boolean>(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [bingoCard, setBingoCard] = useState<(number | string)[][] | null>(null);
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

        // Check for active games where user is already playing
        const userActiveGamesResponse = await gameAPI.getUserActiveGames(user!.id);
        if (userActiveGamesResponse.data.success && userActiveGamesResponse.data.games.length > 0) {
          // Redirect to the first active game user is in
          const game = userActiveGamesResponse.data.games[0];
          setActiveGame(game);
          router.push(`/game/${game._id}`);
          return;
        }

        setShowNumberSelection(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setShowNumberSelection(true);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, [isAuthenticated, router, user]);

  const handleNumberSelect = (number: number) => {
    setSelectedNumber(number);
    setBingoCard(generateBingoCard(number));
    setJoinError('');
  };

  const handleJoinGame = async () => {
    if (!selectedNumber) return;

    setJoining(true);
    setJoinError('');

    try {
      // Get waiting games (automatically created by backend)
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        // Join the first available waiting game
        const game = waitingGamesResponse.data.games[0];
        const joinResponse = await gameAPI.joinGame(game.code, user!.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          
          // Wait a moment for game to process, then redirect
          setTimeout(() => {
            router.push(`/game/${updatedGame._id}`);
          }, 2000);
        } else {
          setJoinError(joinResponse.data.success || 'Failed to join game');
        }
      } else {
        // No waiting games, check if there are active games to watch
        const activeGamesResponse = await gameAPI.getActiveGames();
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          setJoinError('No available spots in waiting games. You can watch active games!');
          // Redirect to watch the first active game
          setTimeout(() => {
            router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
          }, 3000);
        } else {
          setJoinError('No games available at the moment. Please try again later.');
        }
      }
    } catch (error: any) {
      console.error('Failed to join game:', error);
      const errorMessage = error.response?.data?.error || 'Failed to join game. Please try again.';
      setJoinError(errorMessage);
      
      // Even if join fails, redirect to watch any available game
      try {
        const activeGamesResponse = await gameAPI.getActiveGames();
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          setTimeout(() => {
            router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
          }, 3000);
        }
      } catch (watchError) {
        console.error('Failed to redirect to watch game:', watchError);
      }
    } finally {
      setJoining(false);
    }
  };

  const handleWatchGames = async () => {
    try {
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
      } else {
        alert('No active games to watch at the moment.');
      }
    } catch (error) {
      console.error('Failed to fetch active games:', error);
      alert('Failed to load games. Please try again.');
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
          <p>Checking your games...</p>
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

      {/* Watch Games Button */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <motion.button
          onClick={handleWatchGames}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span>👀</span>
          Watch Active Games
        </motion.button>
        <p className="text-white/60 text-xs text-center mt-2">
          Watch ongoing games without playing
        </p>
      </div>

      {/* Selected Number Display */}
      {selectedNumber && (
        <motion.div 
          className={`backdrop-blur-lg rounded-2xl p-4 mb-6 border text-center ${
            joinError 
              ? 'bg-red-500/20 border-red-500/30' 
              : 'bg-yellow-500/20 border-yellow-500/30'
          }`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
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
                : 'Review your bingo card below'
            }
          </p>
          {joinError && walletBalance < 10 && (
            <p className="text-white/80 text-sm mt-2">
              Insufficient balance. You will be redirected to watch the game.
            </p>
          )}
        </motion.div>
      )}

      {/* Number Selection Grid */}
      <motion.div 
        className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => (
          <motion.button
            key={number}
            onClick={() => handleNumberSelect(number)}
            disabled={joining}
            className={`
              aspect-square rounded-xl font-bold text-sm transition-all
              ${selectedNumber === number
                ? 'bg-yellow-500 text-white scale-105 shadow-lg'
                : walletBalance >= 10
                ? 'bg-white/20 text-white hover:bg-white/30 hover:scale-105 hover:shadow-md'
                : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
              }
              border-2 ${
                selectedNumber === number
                  ? 'border-yellow-400'
                  : 'border-white/20'
              }
              ${joining ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            whileHover={{ scale: joining ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
            layout
          >
            {number}
          </motion.button>
        ))}
      </motion.div>

      {/* Bingo Card Preview - Now much smaller */}
      {selectedNumber && bingoCard && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BingoCardPreview cardNumber={selectedNumber} numbers={bingoCard} />
          
          {/* Action Buttons */}
          <motion.div 
            className="grid grid-cols-2 gap-3 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              onClick={() => {
                setSelectedNumber(null);
                setBingoCard(null);
                setJoinError('');
              }}
              disabled={joining}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Change Card
            </motion.button>
            <motion.button
              onClick={handleJoinGame}
              disabled={joining}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {joining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Game'
              )}
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Game Info */}
      <motion.div 
        className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="grid grid-cols-2 gap-4 text-center mb-3">
          <div>
            <p className="text-white font-bold">10 ብር</p>
            <p className="text-white/60 text-xs">Entry Fee</p>
          </div>
          <div>
            <p className="text-white font-bold">Auto</p>
            <p className="text-white/60 text-xs">Game Start</p>
          </div>
        </div>
        
        {/* Informational messages */}
        <div className="space-y-2">
          {walletBalance < 10 && !selectedNumber && (
            <p className="text-yellow-300 text-sm text-center">
              💡 Insufficient balance to play, but you can still select a card to join and watch
            </p>
          )}
          <p className="text-white/60 text-xs text-center">
            Games are automatically created and managed by the system
          </p>
          <p className="text-white/40 text-xs text-center">
            Select any card number to see your bingo card
          </p>
        </div>
      </motion.div>
    </div>
  );
}
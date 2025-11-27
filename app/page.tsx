// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { walletAPIAuto, gameAPI, authAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { Check, Grid3X3, RotateCcw, Clock, Users, Play, Trophy, Target } from 'lucide-react';
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

// All Numbers Grid Component - Shows all 75 bingo numbers in compact layout
const AllBingoNumbersGrid = ({ calledNumbers = [] }: { calledNumbers?: number[] }) => {
  const bingoRanges = [
    { letter: 'B', min: 1, max: 15 },
    { letter: 'I', min: 16, max: 30 },
    { letter: 'N', min: 31, max: 45 },
    { letter: 'G', min: 46, max: 60 },
    { letter: 'O', min: 61, max: 75 }
  ];

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-white flex items-center gap-1">
          <Target className="w-3 h-3 text-yellow-400" />
          All Numbers
        </h3>
        <div className="text-xs text-gray-400 font-medium">
          {calledNumbers.length}/75 Called
        </div>
      </div>

      {/* BINGO Header */}
      <div className="grid grid-cols-5 gap-1 mb-2">
        {bingoRanges.map((range) => (
          <div
            key={range.letter}
            className="text-center font-black text-xs text-yellow-400 bg-yellow-400/10 py-1 rounded-md"
          >
            {range.letter}
          </div>
        ))}
      </div>

      {/* Numbers Grid - Compact 3x5 layout for each column */}
      <div className="grid grid-cols-5 gap-1">
        {bingoRanges.map((range, colIndex) => (
          <div key={range.letter} className="space-y-0.5">
            {Array.from({ length: 15 }, (_, i) => range.min + i).map((number, index) => {
              const isCalled = calledNumbers.includes(number);
              const row = Math.floor(index / 3);
              const col = index % 3;
              
              return (
                <motion.div
                  key={number}
                  className={`
                    aspect-square rounded-md flex items-center justify-center font-bold text-[10px]
                    border transition-all duration-200 cursor-default
                    ${isCalled 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-500 shadow-sm' 
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {number}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-600 pt-2">
        <div className="text-center">
          <div className="font-black text-green-400">{calledNumbers.length}</div>
          <div>Called</div>
        </div>
        <div className="text-center">
          <div className="font-black text-gray-300">75</div>
          <div>Total</div>
        </div>
        <div className="text-center">
          <div className="font-black text-yellow-400">{75 - calledNumbers.length}</div>
          <div>Remaining</div>
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
  const [gameStatus, setGameStatus] = useState<'WAITING' | 'ACTIVE' | 'FINISHED' | 'RESTARTING'>('WAITING');
  const [restartCountdown, setRestartCountdown] = useState<number>(30);
  const [currentPlayers, setCurrentPlayers] = useState<number>(0);
  const [gameData, setGameData] = useState<any>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [showGameView, setShowGameView] = useState<boolean>(false);
  const router = useRouter();

  // Get the correct user ID for wallet operations - FIXED
  const getWalletUserId = (): string | null => {
    if (!user) return null;
    
    // Use the user ID from MongoDB (stored in localStorage or user object)
    // This matches what the backend expects for wallet operations
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('user_id');
      if (storedUserId) return storedUserId;
    }
    
    // Fallback to user.id from the auth context
    return user.id?.toString() || null;
  };

  // Initialize wallet - NEW FUNCTION
  const initializeUserWallet = async (userId: string): Promise<boolean> => {
    try {
      // Check if wallet exists by trying to get balance
      const balanceResponse = await walletAPIAuto.getBalance();
      
      if (balanceResponse.data.success) {
        console.log('✅ Wallet already exists');
        return true;
      }
    } catch (error: any) {
      // If wallet doesn't exist, create it by making a deposit (0 amount)
      if (error.response?.status === 404) {
        try {
          console.log('🆕 Creating new wallet for user...');
          // The wallet is automatically created when we try to access it with a valid user ID
          // Just retry the balance check after a moment
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResponse = await walletAPIAuto.getBalance();
          return retryResponse.data.success;
        } catch (retryError) {
          console.error('Failed to initialize wallet:', retryError);
          return false;
        }
      }
    }
    return false;
  };

  useEffect(() => {
    const initializeApp = async () => {
      if (!isAuthenticated || !user) return;

      try {
        setLoading(true);
        
        // Get the correct user ID for wallet operations
        const walletUserId = getWalletUserId();
        if (!walletUserId) {
          console.error('No user ID available for wallet operations');
          setLoading(false);
          return;
        }

        // Initialize wallet first - WITH ERROR HANDLING
        try {
          await initializeUserWallet(walletUserId);
        } catch (error) {
          console.log('Wallet initialization completed with warnings:', error);
          // Continue even if wallet initialization has issues
        }
        
        // Load wallet balance - WITH BETTER ERROR HANDLING
        try {
          const walletResponse = await walletAPIAuto.getBalance();
          if (walletResponse.data.success) {
            setWalletBalance(walletResponse.data.balance);
          } else {
            console.warn('Wallet balance check returned unsuccessful');
            setWalletBalance(0);
          }
        } catch (error: any) {
          console.error('Error loading wallet balance:', error);
          // Set balance to 0 but continue with app initialization
          setWalletBalance(0);
          
          // If it's a 404, the wallet will be created on first transaction
          if (error.response?.status === 404) {
            console.log('Wallet not found yet - will be created on first transaction');
          }
        }

        // Check for active games where user is already playing
        try {
          const userActiveGamesResponse = await gameAPI.getUserActiveGames(user.id);
          if (userActiveGamesResponse.data.success && userActiveGamesResponse.data.games.length > 0) {
            // Redirect to the first active game user is in
            const game = userActiveGamesResponse.data.games[0];
            setActiveGame(game);
            router.push(`/game/${game._id}`);
            return;
          }
        } catch (error) {
          console.error('Error checking user active games:', error);
        }

        // Check current game status
        await checkGameStatus();
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

  // Check game status periodically
  useEffect(() => {
    if (!showNumberSelection) return;

    const interval = setInterval(async () => {
      await checkGameStatus();
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [showNumberSelection]);

  // Handle restart countdown
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    if (gameStatus === 'FINISHED' && restartCountdown > 0) {
      countdownInterval = setInterval(() => {
        setRestartCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setGameStatus('RESTARTING');
            // Check for new game after countdown
            setTimeout(() => checkGameStatus(), 1000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [gameStatus, restartCountdown]);

  // Simulate called numbers for demo (replace with actual game data)
  useEffect(() => {
    if (gameStatus === 'ACTIVE' && selectedNumber) {
      // Simulate some called numbers
      const simulatedCalledNumbers = [7, 23, 45, 61, 12, 34, 56, 72, 8, 19];
      setCalledNumbers(simulatedCalledNumbers);
    }
  }, [gameStatus, selectedNumber]);

  const checkGameStatus = async () => {
    try {
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      const activeGamesResponse = await gameAPI.getActiveGames();

      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        const game = activeGamesResponse.data.games[0];
        setGameStatus('ACTIVE');
        setCurrentPlayers(game.currentPlayers || 0);
        setGameData(game);
        setRestartCountdown(0);
        
        // If user already selected a card and game is active, show game view
        if (selectedNumber && !joining) {
          setShowGameView(true);
        }
      } else if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        setGameStatus('WAITING');
        setCurrentPlayers(game.currentPlayers || 0);
        setGameData(game);
        setRestartCountdown(0);
      } else {
        // No games available - might be in restart phase
        setGameStatus('FINISHED');
        setRestartCountdown(30); // Start 30 second countdown
        setCurrentPlayers(0);
      }
    } catch (error) {
      console.error('Error checking game status:', error);
    }
  };

  const handleNumberSelect = (number: number) => {
    setSelectedNumber(number);
    setBingoCard(generateBingoCard(number));
    setJoinError('');
    setShowGameView(false);
  };

  const handleJoinGame = async () => {
    if (!selectedNumber || !user) return;

    setJoining(true);
    setJoinError('');

    try {
      // Check wallet balance first - WITH BETTER ERROR HANDLING
      let userBalance = 0;
      try {
        const balanceResponse = await walletAPIAuto.getBalance();
        if (balanceResponse.data.success) {
          userBalance = balanceResponse.data.balance;
        }
      } catch (error: any) {
        console.warn('Could not check wallet balance:', error);
        // If we can't check balance, assume 0 to be safe
        userBalance = 0;
      }
      
      if (userBalance < 10) {
        setJoinError('Insufficient balance. Minimum 10 ብር required to play.');
        setJoining(false);
        
        // Even with insufficient balance, allow joining as spectator
        setTimeout(() => {
          handleJoinAsSpectator();
        }, 2000);
        return;
      }

      // Get waiting games (automatically created by backend)
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        // Join the first available waiting game
        const game = waitingGamesResponse.data.games[0];
        const joinResponse = await gameAPI.joinGame(game.code, user.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          setShowGameView(true);
          
          // Wait a moment for game to process, then redirect
          setTimeout(() => {
            router.push(`/game/${updatedGame._id}`);
          }, 1000);
        } else {
          setJoinError(joinResponse.data.success || 'Failed to join game');
          // Fallback to spectator mode
          handleJoinAsSpectator();
        }
      } else {
        // No waiting games, join as spectator
        handleJoinAsSpectator();
      }
    } catch (error: any) {
      console.error('Failed to join game:', error);
      const errorMessage = error.response?.data?.error || 'Failed to join game. Please try again.';
      setJoinError(errorMessage);
      
      // Fallback to spectator mode on any error
      handleJoinAsSpectator();
    } finally {
      setJoining(false);
    }
  };

  // NEW FUNCTION: Handle joining as spectator
  const handleJoinAsSpectator = async () => {
    try {
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        setShowGameView(true);
        setTimeout(() => {
          router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
        }, 1000);
      } else {
        // No active games either, show appropriate message
        setJoinError('No games available at the moment. Please try again later.');
      }
    } catch (watchError) {
      console.error('Failed to redirect to watch game:', watchError);
      setJoinError('Failed to join any game. Please try again.');
    }
  };

  const handleWatchGames = async () => {
    try {
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        setShowGameView(true);
        router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
      } else {
        alert('No active games to watch at the moment.');
      }
    } catch (error) {
      console.error('Failed to fetch active games:', error);
      alert('Failed to load games. Please try again.');
    }
  };

  const getStatusMessage = () => {
    switch (gameStatus) {
     case 'WAITING':
      const playersNeeded = gameData?.playersNeeded || 0;
      const currentPlayers = gameData?.activePlayers || 0;
      const minPlayers = gameData?.minPlayersRequired || 2;
      
      return {
        message: '🕒 Waiting for Players',
        description: playersNeeded > 0 
          ? `${currentPlayers}/${minPlayers} players - Need ${playersNeeded} more to start`
          : `${currentPlayers}/${minPlayers} players - Ready to start!`,
        color: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
        icon: <Users className="w-5 h-5" />
      };
    case 'ACTIVE':
      return {
        message: '🎯 Game in Progress',
        description: `${currentPlayers} players playing - Join to play or watch`,
        color: 'bg-green-500/20 border-green-500/30 text-green-300',
        icon: <Play className="w-5 h-5" />
      };
      case 'FINISHED':
        return {
          message: '🏁 Game Finished',
          description: `New game starting in ${restartCountdown}s - Select your card now!`,
          color: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
          icon: <Trophy className="w-5 h-5" />
        };
      case 'RESTARTING':
        return {
          message: '🔄 Starting New Game...',
          description: 'Please wait while we set up a new game',
          color: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
          icon: <Clock className="w-5 h-5" />
        };
      default:
        return {
          message: '❓ Checking Game Status...',
          description: 'Please wait...',
          color: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
          icon: <Clock className="w-5 h-5" />
        };
    }
  };

  // Game View when user has selected a card and game is active
 // Game View when user has selected a card and game is active
if (showGameView && selectedNumber && bingoCard) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      {/* Header with Wallet */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white font-bold text-xl">Bingo Game</h1>
            <p className="text-white/60 text-sm">Game Started - Good Luck! 🍀</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg">{walletBalance} ብር</p>
            <p className="text-white/60 text-xs">Balance</p>
          </div>
        </div>
      </div>

      {/* Game Status Banner */}
      <motion.div 
        className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-green-500/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center gap-2">
          <Play className="w-5 h-5 text-green-300" />
          <p className="text-white font-bold text-lg">Game Started!</p>
        </div>
        <p className="text-green-200 text-sm text-center mt-1">
          {currentPlayers} players - Card #{selectedNumber} - {calledNumbers.length}/75 numbers called
        </p>
      </motion.div>

      {/* Main Game Layout - Two Equal Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: User's Bingo Card and Controls */}
        <div className="flex flex-col space-y-6">
          {/* Bingo Card with equal height container */}
          <div className="flex-1 bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="h-full flex flex-col">
              <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-telegram-button" />
                Your Bingo Card
              </h2>
              <div className="flex-1 flex items-center justify-center">
                <BingoCardPreview cardNumber={selectedNumber} numbers={bingoCard} />
              </div>
            </div>
          </div>
          
          {/* Game Controls */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5" />
              Game Controls
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                onClick={() => setShowGameView(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <RotateCcw className="w-4 h-4" />
                Change Card
              </motion.button>
              <motion.button
                onClick={handleWatchGames}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Users className="w-4 h-4" />
                Watch Live
              </motion.button>
            </div>
          </div>
        </div>

        {/* Right Column: All Numbers Grid */}
        <div className="flex flex-col">
          <div className="flex-1 bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="h-full flex flex-col">
              <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-yellow-400" />
                Called Numbers
              </h2>
              <div className="flex-1">
                <AllBingoNumbersGrid calledNumbers={calledNumbers} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mt-6 border border-white/20">
        <h3 className="text-white font-bold mb-4 flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Game Statistics
        </h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-white font-bold text-xl">{calledNumbers.length}</p>
            <p className="text-white/60 text-sm">Numbers Called</p>
          </div>
          <div>
            <p className="text-white font-bold text-xl">{75 - calledNumbers.length}</p>
            <p className="text-white/60 text-sm">Remaining</p>
          </div>
          <div>
            <p className="text-white font-bold text-xl">{currentPlayers}</p>
            <p className="text-white/60 text-sm">Active Players</p>
          </div>
          <div>
            <p className="text-white font-bold text-xl">#{selectedNumber}</p>
            <p className="text-white/60 text-sm">Your Card</p>
          </div>
        </div>
      </div>
    </div>
  );
}

  // Rest of the original code remains the same for the selection view...
  // [The rest of your original component code for the selection view goes here]
  // This includes the number selection grid, status displays, etc.

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

  const statusInfo = getStatusMessage();

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

      {/* Game Status Display */}
      <motion.div 
        className={`backdrop-blur-lg rounded-2xl p-4 mb-6 border ${statusInfo.color}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          {statusInfo.icon}
          <p className="font-bold text-lg">{statusInfo.message}</p>
        </div>
        <p className="text-sm text-center">{statusInfo.description}</p>
        
        {/* Countdown Progress Bar */}
        {gameStatus === 'FINISHED' && restartCountdown > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/80 mb-1">
              <span>Next game starts in:</span>
              <span className="font-bold">{restartCountdown}s</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${((30 - restartCountdown) / 30) * 100}%` }}
              />
            </div>
          </div>
          
        )}
        {gameStatus === 'WAITING' && (
  <p className="text-yellow-300 text-sm text-center">
    ⏳ Need at least 2 players to start the game. Currently: {currentPlayers}/2
  </p>
)}
      </motion.div>

      {/* Watch Games Button - Only show when game is active */}
      {gameStatus === 'ACTIVE' && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
          <motion.button
            onClick={handleWatchGames}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>👀</span>
            Watch Live Game
          </motion.button>
          <p className="text-white/60 text-xs text-center mt-2">
            Watch the ongoing game without playing
          </p>
        </div>
      )}

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

      {/* Number Selection Grid - Only show when game is not active or user is selecting */}
      {(gameStatus !== 'ACTIVE' || selectedNumber) && (
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
              disabled={joining || gameStatus === 'ACTIVE'}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all
                ${selectedNumber === number
                  ? 'bg-yellow-500 text-white scale-105 shadow-lg'
                  : walletBalance >= 10 && gameStatus !== 'ACTIVE'
                  ? 'bg-white/20 text-white hover:bg-white/30 hover:scale-105 hover:shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                }
                border-2 ${
                  selectedNumber === number
                    ? 'border-yellow-400'
                    : 'border-white/20'
                }
                ${joining || gameStatus === 'ACTIVE' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              whileHover={{ scale: (joining || gameStatus === 'ACTIVE') ? 1 : 1.05 }}
              whileTap={{ scale: 0.95 }}
              layout
            >
              {number}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Bingo Card Preview */}
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
              disabled={joining || gameStatus === 'ACTIVE'}
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
          
          {gameStatus === 'FINISHED' && (
            <p className="text-yellow-300 text-sm text-center">
              ⏳ Select your card now! Game starts in {restartCountdown} seconds
            </p>
          )}
          
          {gameStatus === 'ACTIVE' && !selectedNumber && (
            <p className="text-green-300 text-sm text-center">
              🎯 Game is running! You can join to play or watch the live game
            </p>
          )}
          
          <p className="text-white/60 text-xs text-center">
            Games restart automatically 30 seconds after completion
          </p>
          <p className="text-white/40 text-xs text-center">
            Minimum 2 players required to start the game
          </p>
        </div>
      </motion.div>
    </div>
  );
}
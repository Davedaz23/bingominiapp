// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { walletAPIAuto, gameAPI, authAPI, walletAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { Check, Grid3X3, RotateCcw, Clock, Users, Play, Trophy, Target } from 'lucide-react';
import { motion } from 'framer-motion';

// Memoized Bingo Card Component matching your design system
const BingoCardPreview = ({ cardNumber, numbers }: { cardNumber: number; numbers: (number | string)[][] }) => {
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
              
              {cell === 'FREE' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-2 h-2 text-white drop-shadow-sm" />
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-white flex items-center gap-1">
          <Target className="w-3 h-3 text-yellow-400" />
          All Numbers
        </h3>
        <div className="text-xs text-gray-400 font-medium">
          {calledNumbers.length}/75 Called
        </div>
      </div>

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

      <div className="grid grid-cols-5 gap-1">
        {bingoRanges.map((range, colIndex) => (
          <div key={range.letter} className="space-y-0.5">
            {Array.from({ length: 15 }, (_, i) => range.min + i).map((number, index) => {
              const isCalled = calledNumbers.includes(number);
              
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
  const seed = cardNumber * 12345;
  const card = [];
  
  const ranges = [
    { min: 1, max: 15 },
    { min: 16, max: 30 },
    { min: 31, max: 45 },
    { min: 46, max: 60 },
    { min: 61, max: 75 }
  ];

  for (let col = 0; col < 5; col++) {
    const column = [];
    const usedNumbers = new Set();
    const range = ranges[col];
    
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        column.push('FREE');
        continue;
      }
      
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
  const [autoRedirected, setAutoRedirected] = useState<boolean>(false);
// Add to your existing state in app/page.tsx
const [availableCards, setAvailableCards] = useState<number[]>([]);
const [takenCards, setTakenCards] = useState<{cardNumber: number, userId: string}[]>([]);
const [cardSelectionStatus, setCardSelectionStatus] = useState<{
  isSelectionActive: boolean;
  selectionEndTime: Date | null;
  timeRemaining: number;
}>({
  isSelectionActive: false,
  selectionEndTime: null,
  timeRemaining: 0
});
const [cardSelectionError, setCardSelectionError] = useState<string>('');

  const router = useRouter();

const getWalletUserId = (): string | null => {
  if (!user) return null;
  
  // Prefer Telegram ID for wallet operations
  if (user.telegramId) {
    console.log('💰 Using Telegram ID from user object:', user.telegramId);
    return user.telegramId;
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const telegramId = localStorage.getItem('telegram_user_id');
    if (telegramId) {
      console.log('💰 Using Telegram ID from localStorage:', telegramId);
      return telegramId;
    }
    
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      console.log('💰 Using MongoDB ID from localStorage:', storedUserId);
      return storedUserId;
    }
  }
  
  // Last resort - use user ID from auth context
  console.log('💰 Using user ID from auth context:', user.id);
  return user.id?.toString() || null;
};
 const initializeUserWallet = async (userId: string): Promise<boolean> => {
  try {
    console.log('💰 Initializing wallet for user:', userId);
    
    // First, try to get balance directly
    const balanceResponse = await walletAPIAuto.getBalance();
    
    if (balanceResponse.data.success) {
      console.log('✅ Wallet exists with balance:', balanceResponse.data.balance);
      setWalletBalance(balanceResponse.data.balance);
      return true;
    }
  } catch (error: any) {
    console.log('🔄 Wallet initialization attempt:', error.message);
    
    // If wallet doesn't exist, try to initialize it
    if (error.response?.status === 404 || error.message?.includes('not found')) {
      try {
        console.log('🆕 Creating new wallet for user...');
        
        // Use the direct API call to initialize wallet
        const initResponse = await walletAPI.updateBalance(userId, 0);
        
        if (initResponse.data.success) {
          console.log('✅ Wallet initialized successfully');
          setWalletBalance(0);
          return true;
        }
      } catch (initError) {
        console.error('❌ Failed to initialize wallet:', initError);
      }
    }
  }
  return false;
};

  // Add these useEffect hooks to your component

// Fetch available cards when game data changes
useEffect(() => {
  if (gameData?._id && shouldEnableCardSelection()) {
    fetchAvailableCards();
  }
}, [gameData, gameStatus, walletBalance]);


// Check card selection status periodically
useEffect(() => {
  if (!gameData?._id || !cardSelectionStatus.isSelectionActive) return;

  const interval = setInterval(() => {
    checkCardSelectionStatus();
  }, 1000);

  return () => clearInterval(interval);
}, [gameData, cardSelectionStatus.isSelectionActive]);

// Auto-select card when selection period is about to end
useEffect(() => {
  if (cardSelectionStatus.isSelectionActive && 
      cardSelectionStatus.timeRemaining < 5000 && 
      !selectedNumber && 
      availableCards.length > 0) {
    
    const timer = setTimeout(async () => {
      const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
      await handleCardSelect(randomCard);
    }, 2000);
    
    return () => clearTimeout(timer);
  }
}, [cardSelectionStatus, selectedNumber, availableCards]);

 useEffect(() => {
  const initializeApp = async () => {
    if (!isAuthenticated || !user) return;

    try {
      setLoading(true);
      
      const walletUserId = getWalletUserId();
      if (!walletUserId) {
        console.error('No user ID available for wallet operations');
        setLoading(false);
        return;
      }

      console.log('💰 Starting wallet initialization for:', walletUserId);
      
      // Initialize wallet first
      await initializeUserWallet(walletUserId);
      
      // Then load balance with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          const walletResponse = await walletAPIAuto.getBalance();
          if (walletResponse.data.success) {
            console.log('💰 Balance loaded successfully:', walletResponse.data.balance);
            setWalletBalance(walletResponse.data.balance);
            break;
          }
        } catch (balanceError: any) {
          console.warn(`💰 Balance load attempt ${4 - retries} failed:`, balanceError.message);
          retries--;
          
          if (retries === 0) {
            console.error('💰 All balance load attempts failed');
            setWalletBalance(0);
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Rest of your initialization code...
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
}, [isAuthenticated, user]);
useEffect(() => {
  console.log('💰 Wallet balance state updated:', walletBalance);
}, [walletBalance]);

// Add this debug function to test wallet API directly:


  // Auto-redirect when game starts and user has selected a card with balance
  useEffect(() => {
    if (gameStatus === 'ACTIVE' && selectedNumber && !autoRedirected && walletBalance >= 10) {
      console.log('🚀 Auto-redirecting to game - user has card and sufficient balance');
      setAutoRedirected(true);
      setShowGameView(true);
    }
  }, [gameStatus, selectedNumber, autoRedirected, walletBalance]);

  // Check game status periodically
  useEffect(() => {
    if (!showNumberSelection) return;

    const interval = setInterval(async () => {
      await checkGameStatus();
    }, 3000);

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
  
  //Card save

// COMPREHENSIVE CARD SELECTION LOGIC
const shouldEnableCardSelection = () => {
  console.log('🎯 Card Selection Check:', {
    gameStatus,
    walletBalance,
    selectedNumber,
    isSelectionActive: cardSelectionStatus.isSelectionActive,
    hasGameData: !!gameData?._id
  });

  // If user already selected a card, they can't select another one
  if (selectedNumber) {
    console.log('🎯 User already has card #', selectedNumber);
    return false;
  }

  // If no game data, can't select cards
  if (!gameData?._id) {
    console.log('🎯 No game data available');
    return false;
  }

  // SCENARIO 1: User has sufficient balance AND card selection is active
  if (walletBalance >= 10 && cardSelectionStatus.isSelectionActive) {
    console.log('🎯 Scenario 1: Sufficient balance + Active selection');
    return true;
  }

  // SCENARIO 2: User has sufficient balance AND game is WAITING
  if (walletBalance >= 10 && gameStatus === 'WAITING') {
    console.log('🎯 Scenario 2: Sufficient balance + Game waiting');
    return true;
  }

  // SCENARIO 3: User has sufficient balance AND game is FINISHED (next game preparation)
  if (walletBalance >= 10 && gameStatus === 'FINISHED' && restartCountdown > 0) {
    console.log('🎯 Scenario 3: Sufficient balance + Game finished (next game soon)');
    return true;
  }

  // SCENARIO 4: User has sufficient balance AND game is RESTARTING
  if (walletBalance >= 10 && gameStatus === 'RESTARTING') {
    console.log('🎯 Scenario 4: Sufficient balance + Game restarting');
    return true;
  }

  // SCENARIO 5: Game is ACTIVE but user has balance - allow late entry if cards available
  if (walletBalance >= 10 && gameStatus === 'ACTIVE' && availableCards.length > 0) {
    console.log('🎯 Scenario 5: Sufficient balance + Game active (late entry)');
    return true;
  }

  console.log('🎯 Card selection disabled - conditions not met');
  return false;
};
const fetchAvailableCards = async () => {
  try {
    if (!gameData?._id) return;
    
    const response = await gameAPI.getAvailableCards(gameData._id);
    if (response.data.success) {
      setAvailableCards(response.data.availableCards);
      setTakenCards(response.data.takenCards);
      setCardSelectionStatus({
        isSelectionActive: response.data.isSelectionActive,
        selectionEndTime: new Date(response.data.selectionEndTime),
        timeRemaining: response.data.timeRemaining
      });
    }
  } catch (error) {
    console.error('Error fetching available cards:', error);
  }
};

const handleCardSelect = async (cardNumber: number) => {
  if (!user || !gameData?._id) return;
  
  try {
    setCardSelectionError('');
    
    const response = await gameAPI.selectCard(gameData._id, user.id, cardNumber);
    
    if (response.data.success) {
      setSelectedNumber(cardNumber);
      setBingoCard(generateBingoCard(cardNumber));
      setJoinError('');
      setShowGameView(false);
      setAutoRedirected(false);
      
      // Refresh available cards
      await fetchAvailableCards();
      
      console.log(`✅ Card #${cardNumber} selected successfully`);
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Failed to select card';
    setCardSelectionError(errorMessage);
    console.error('Card selection error:', error);
  }
};

const handleCardRelease = async () => {
  if (!user || !gameData?._id) return;
  
  try {
    const response = await gameAPI.releaseCard(gameData._id, user.id);
    
    if (response.data.success) {
      setSelectedNumber(null);
      setBingoCard(null);
      setJoinError('');
      
      // Refresh available cards
      await fetchAvailableCards();
      
      console.log('🔄 Card released successfully');
    }
  } catch (error: any) {
    console.error('Card release error:', error);
  }
};

const checkCardSelectionStatus = async () => {
  if (!gameData?._id) return;
  
  try {
    const response = await gameAPI.getCardSelectionStatus(gameData._id);
    if (response.data.success) {
      setCardSelectionStatus({
        isSelectionActive: response.data.isSelectionActive,
        selectionEndTime: new Date(response.data.selectionEndTime),
        timeRemaining: response.data.timeRemaining
      });
      
      // Auto-select only if selection is active and user hasn't selected
      if (response.data.isSelectionActive && !selectedNumber && availableCards.length > 0) {
        // Only auto-select in the last 5 seconds
        if (response.data.timeRemaining < 5000) {
          const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
          await handleCardSelect(randomCard);
        }
      }
    }
  } catch (error) {
    console.error('Error checking card selection status:', error);
  }
};
  //card

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
        setAutoRedirected(false);
        
      } else if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        setGameStatus('WAITING');
        setCurrentPlayers(game.currentPlayers || 0);
        setGameData(game);
        setRestartCountdown(0);
        setAutoRedirected(false);
      } else {
        setGameStatus('FINISHED');
        setRestartCountdown(30);
        setCurrentPlayers(0);
        setAutoRedirected(false);
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
    setAutoRedirected(false);
  };

  const handleJoinGame = async () => {
    if (!selectedNumber || !user) return;

    setJoining(true);
    setJoinError('');

    try {
      let userBalance = 0;
      try {
        const balanceResponse = await walletAPIAuto.getBalance();
        if (balanceResponse.data.success) {
          userBalance = balanceResponse.data.balance;
        }
      } catch (error: any) {
        userBalance = 0;
      }
      
      if (userBalance < 10) {
        setJoinError('Insufficient balance. Minimum 10 ብር required to play.');
        setJoining(false);
        setTimeout(() => {
          handleJoinAsSpectator();
        }, 2000);
        return;
      }

      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        const joinResponse = await gameAPI.joinGame(game.code, user.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          router.push(`/game/${updatedGame._id}`);
        } else {
          setJoinError(joinResponse.data.success || 'Failed to join game');
          handleJoinAsSpectator();
        }
      } else {
        handleJoinAsSpectator();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to join game. Please try again.';
      setJoinError(errorMessage);
      handleJoinAsSpectator();
    } finally {
      setJoining(false);
    }
  };

  const handleJoinAsSpectator = async () => {
    try {
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
      } else {
        setJoinError('No games available at the moment. Please try again later.');
      }
    } catch (watchError) {
      console.error('Failed to redirect to watch game:', watchError);
      setJoinError('Failed to join any game. Please try again.');
    }
  };

  const handleAutoJoinGame = async () => {
    if (!selectedNumber || !user) return;

    try {
      console.log('🤖 Auto-joining game...');
      
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        const joinResponse = await gameAPI.joinGame(game.code, user.id);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          console.log('✅ Auto-joined game successfully');
          router.push(`/game/${updatedGame._id}`);
        } else {
          console.log('⚠️ Auto-join failed, redirecting to watch');
          router.push(`/game/${game._id}?spectator=true`);
        }
      } else {
        const activeGamesResponse = await gameAPI.getActiveGames();
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
        }
      }
    } catch (error: any) {
      console.error('Auto-join failed:', error);
      const activeGamesResponse = await gameAPI.getActiveGames();
      if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
        router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
      }
    }
  };

  // Auto-join when game view is shown
  useEffect(() => {
    if (showGameView && selectedNumber && walletBalance >= 10) {
      const timer = setTimeout(() => {
        handleAutoJoinGame();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showGameView, selectedNumber, walletBalance]);

//  getStatusMessage function:
const getStatusMessage = () => {
  const players = currentPlayers || 0;
  const minPlayers = 2;
  
  // Check if user can select cards
  const canSelectCards = shouldEnableCardSelection();
  
  switch (gameStatus) {
    case 'WAITING':
      const playersNeeded = Math.max(0, minPlayers - players);
      
      return {
        message: canSelectCards ? '🎯 Select Your Card!' : '🕒 Waiting for Players',
        description: canSelectCards 
          ? `${players}/${minPlayers} players - Choose your card number to join`
          : playersNeeded > 0 
            ? `${players}/${minPlayers} players - Need ${playersNeeded} more to start`
            : `${players}/${minPlayers} players - Ready to start!`,
        color: canSelectCards 
          ? 'bg-green-500/20 border-green-500/30 text-green-300'
          : 'bg-blue-500/20 border-blue-500/30 text-blue-300',
        icon: canSelectCards ? <Target className="w-5 h-5" /> : <Users className="w-5 h-5" />
      };
    
    case 'ACTIVE':
      const activeMessage = !selectedNumber 
        ? `${players} players playing - ${walletBalance >= 10 ? 'Game in progress' : 'Watch live game'}`
        : walletBalance >= 10 
          ? `${players} players playing - Auto-joining with card #${selectedNumber}...`
          : `${players} players playing - Joining as spectator...`;
      
      return {
        message: selectedNumber && walletBalance >= 10 ? '🚀 Joining Game!' : '🎯 Game in Progress',
        description: activeMessage,
        color: 'bg-green-500/20 border-green-500/30 text-green-300',
        icon: <Play className="w-5 h-5" />
      };
    
    case 'FINISHED':
      return {
        message: canSelectCards ? '🔄 Next Game Starting Soon!' : '🏁 Game Finished',
        description: canSelectCards 
          ? `Select your card for the next game (${restartCountdown}s)`
          : `New game starting in ${restartCountdown}s`,
        color: canSelectCards 
          ? 'bg-orange-500/20 border-orange-500/30 text-orange-300'
          : 'bg-purple-500/20 border-purple-500/30 text-purple-300',
        icon: canSelectCards ? <Clock className="w-5 h-5" /> : <Trophy className="w-5 h-5" />
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

  // Auto-join loading screen
  if (showGameView && selectedNumber && walletBalance >= 10) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-white font-bold text-xl">Bingo Game</h1>
              <p className="text-white/60 text-sm">Joining Game Automatically</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-lg">{walletBalance} ብር</p>
              <p className="text-white/60 text-xs">Balance</p>
            </div>
          </div>
        </div>

        <motion.div 
          className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-green-500/30"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Play className="w-6 h-6 text-green-300" />
            <p className="text-white font-bold text-xl">Joining Game...</p>
          </div>
          <p className="text-green-200 text-center mb-4">
            Auto-joining with Card #{selectedNumber}
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-300"></div>
          </div>
        </motion.div>

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <BingoCardPreview cardNumber={selectedNumber} numbers={bingoCard!} />
        </div>
      </div>
    );
  }

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
          <p className="text-yellow-300 text-sm text-center mt-2">
            ⏳ Need at least 2 players to start the game. Currently: {currentPlayers}/2
          </p>
        )}
      </motion.div>

{shouldEnableCardSelection() && cardSelectionStatus.isSelectionActive && (
  <motion.div 
    className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-green-500/30"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-green-300" />
        <p className="text-green-300 font-bold text-sm">Card Selection Active</p>
      </div>
      <p className="text-green-200 text-sm">
        {Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s remaining
      </p>
    </div>
    <div className="mt-2">
      <div className="flex justify-between text-xs text-green-200 mb-1">
        <span>Choose your card number to join the game</span>
        <span>{takenCards.length}/400 cards taken</span>
      </div>
      <div className="w-full bg-green-400/20 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full transition-all duration-1000"
          style={{ 
            width: `${((30000 - cardSelectionStatus.timeRemaining) / 30000) * 100}%` 
          }}
        />
      </div>
    </div>
    {cardSelectionError && (
      <p className="text-red-300 text-xs mt-2 text-center">
        {cardSelectionError}
      </p>
    )}
  </motion.div>
)}

{shouldEnableCardSelection() && !cardSelectionStatus.isSelectionActive && (
  <motion.div 
    className="bg-orange-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-orange-500/30"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-center gap-2">
      <Clock className="w-4 h-4 text-orange-300" />
      <p className="text-orange-300 font-bold text-sm">Card Selection Starting Soon</p>
    </div>
    <p className="text-orange-200 text-xs text-center mt-1">
      Card selection will begin when the game is ready
    </p>
  </motion.div>
)}
      {/* Only show watch button for users with insufficient balance */}
      {gameStatus === 'ACTIVE' && !selectedNumber && walletBalance < 10 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
          <motion.button
            onClick={handleJoinAsSpectator}
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
                : 'Ready to join game'
            }
          </p>
          {joinError && walletBalance < 10 && (
            <p className="text-white/80 text-sm mt-2">
              Insufficient balance. You will be redirected to watch the game.
            </p>
          )}
        </motion.div>
      )}

{(gameStatus !== 'ACTIVE' || selectedNumber) && (
  <motion.div 
    className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.2 }}
  >
    {/* Number grid */}
  </motion.div>
)}


{!selectedNumber && (
  <motion.div 
    className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.2 }}
  >
    {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
      const isTaken = takenCards.some(card => card.cardNumber === number);
      const isAvailable = availableCards.includes(number);
      const canSelect = shouldEnableCardSelection();
      const isSelectable = canSelect && isAvailable && !isTaken;
      
      return (
        <motion.button
          key={number}
          onClick={() => isSelectable && handleCardSelect(number)}
          disabled={!isSelectable || joining}
          className={`
            aspect-square rounded-xl font-bold text-sm transition-all relative
            ${selectedNumber === number
              ? 'bg-yellow-500 text-white scale-105 shadow-lg'
              : isTaken
              ? 'bg-red-500/50 text-white/50 cursor-not-allowed border-red-400/50'
              : isSelectable
              ? 'bg-white/20 text-white hover:bg-white/30 hover:scale-105 hover:shadow-md cursor-pointer border-white/20'
              : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
            }
            border-2
            ${!isSelectable ? 'opacity-50' : ''}
          `}
          whileHover={isSelectable ? { scale: 1.05 } : {}}
          whileTap={isSelectable ? { scale: 0.95 } : {}}
          layout
        >
          {number}
          {isTaken && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 text-red-300">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
          {!isTaken && !isSelectable && (
            <div className="absolute inset-0 flex items-center justify-center opacity-40">
              <div className="w-3 h-3 text-white/50">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
        </motion.button>
      );
    })}
  </motion.div>
)}

{selectedNumber && bingoCard && (
  <motion.div
    className="mb-6"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
  >
    <BingoCardPreview cardNumber={selectedNumber} numbers={bingoCard} />
    
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
        disabled={joining || (gameStatus === 'ACTIVE' && walletBalance >= 10)}
        className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Change Card
      </motion.button>
      <motion.button
        onClick={handleJoinGame}
        disabled={joining || (gameStatus === 'ACTIVE' && walletBalance >= 10)}
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

      {selectedNumber && bingoCard && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BingoCardPreview cardNumber={selectedNumber} numbers={bingoCard} />
          
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
              disabled={joining || (gameStatus === 'ACTIVE' && walletBalance >= 10)}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Change Card
            </motion.button>
            <motion.button
              onClick={handleJoinGame}
              disabled={joining || (gameStatus === 'ACTIVE' && walletBalance >= 10)}
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
        

<div className="space-y-2">
  {!selectedNumber && shouldEnableCardSelection() && (
    <p className="text-green-300 text-sm text-center">
      🎯 Select a card number to join the next game automatically
    </p>
  )}
  
  {!selectedNumber && !shouldEnableCardSelection() && walletBalance >= 10 && (
    <p className="text-blue-300 text-sm text-center">
      ⏳ Card selection will be available when the next game starts
    </p>
  )}
  
  {!selectedNumber && walletBalance < 10 && (
    <p className="text-yellow-300 text-sm text-center">
      💡 Add balance to play - Watch mode available
    </p>
  )}
  
  {selectedNumber && walletBalance >= 10 && gameStatus === 'WAITING' && (
    <p className="text-blue-300 text-sm text-center">
      ⏳ Game will start automatically when enough players join
    </p>
  )}
  
  {selectedNumber && walletBalance >= 10 && gameStatus === 'ACTIVE' && (
    <p className="text-green-300 text-sm text-center">
      🚀 Game started! Auto-joining with card #{selectedNumber}...
    </p>
  )}
  
  {selectedNumber && walletBalance < 10 && (
    <p className="text-yellow-300 text-sm text-center">
      👀 You'll join as spectator with card #{selectedNumber}
    </p>
  )}
  
  {gameStatus === 'FINISHED' && !shouldEnableCardSelection() && (
    <p className="text-yellow-300 text-sm text-center">
      ⏳ New game starting in {restartCountdown} seconds
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
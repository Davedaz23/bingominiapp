// app/page.tsx - COMPLETE FIXED VERSION
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';
import { Check, Grid3X3, RotateCcw, Clock, Users, Play, Trophy, Target, User, Shield, Crown } from 'lucide-react';
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

// User Info Display Component with Role Badges
const UserInfoDisplay = ({ user, userRole }: { user: any; userRole: string }) => {
  const { walletBalance } = useAuth(); // Get balance from context

  const getUserDisplayName = () => {
    if (!user) {
      console.log('❌ No user object provided to UserInfoDisplay');
      return 'Guest';
    }

    // More robust display name logic
    if (user.firstName && user.firstName !== 'User' && user.firstName !== 'Development') {
      return user.firstName;
    }
    
    if (user.telegramUsername) {
      return user.telegramUsername;
    }
    
    if (user.username && !user.username.startsWith('user_') && user.username !== 'dev_user') {
      return user.username;
    }
    
    if (user.telegramId) {
      return `User${user.telegramId.toString().slice(-4)}`;
    }
    
    if (user.id) {
      return `User${user.id.toString().slice(-4)}`;
    }
    
    return 'Player';
  };

  const getRoleBadge = () => {
    switch (userRole) {
      case 'admin':
        return {
          bg: 'bg-yellow-500/20 border-yellow-400/50',
          text: 'text-yellow-300',
          icon: <Crown className="w-3 h-3" />,
          label: 'ADMIN'
        };
      case 'moderator':
        return {
          bg: 'bg-blue-500/20 border-blue-400/50',
          text: 'text-blue-300',
          icon: <Shield className="w-3 h-3" />,
          label: 'MOD'
        };
      default:
        return null;
    }
  };

  const roleBadge = getRoleBadge();
  const displayName = getUserDisplayName();

  return (
    <div className="flex items-center gap-3">
      {/* Balance Display */}
      <div className="text-right">
        <p className="text-white font-bold text-lg">{walletBalance} ብር</p>
        <p className="text-white/60 text-xs">Balance</p>
      </div>
      
      {/* User Name Display with Role Badge */}
      <div className={`flex items-center gap-2 backdrop-blur-lg rounded-xl px-3 py-2 border ${
        roleBadge ? roleBadge.bg : 'bg-white/20 border-white/30'
      }`}>
        <User className={`w-4 h-4 ${roleBadge ? roleBadge.text : 'text-white'}`} />
        <div className="flex flex-col">
          <p className={`font-medium text-sm ${roleBadge ? roleBadge.text : 'text-white'}`}>
            {displayName}
          </p>
          {roleBadge && (
            <div className="flex items-center gap-1">
              {roleBadge.icon}
              <p className="text-xs font-bold">{roleBadge.label}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Admin Controls Component
const AdminControls = ({ onStartGame, onEndGame, onManageUsers }: { 
  onStartGame: () => void;
  onEndGame: () => void;
  onManageUsers: () => void;
}) => (
  <motion.div 
    className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-yellow-500/30"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-yellow-300" />
        <p className="text-yellow-300 font-bold text-sm">Admin Controls</p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <button 
        onClick={onStartGame}
        className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Play className="w-3 h-3" />
        Start Game
      </button>
      <button 
        onClick={onEndGame}
        className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Trophy className="w-3 h-3" />
        End Game
      </button>
      <button 
        onClick={onManageUsers}
        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Users className="w-3 h-3" />
        Manage Users
      </button>
    </div>
  </motion.div>
);

// Moderator Controls Component
const ModeratorControls = ({ onModerateGames, onViewReports }: { 
  onModerateGames: () => void;
  onViewReports: () => void;
}) => (
  <motion.div 
    className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-blue-500/30"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-300" />
        <p className="text-blue-300 font-bold text-sm">Moderator Controls</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <button 
        onClick={onModerateGames}
        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Play className="w-3 h-3" />
        Moderate Games
      </button>
      <button 
        onClick={onViewReports}
        className="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Trophy className="w-3 h-3" />
        View Reports
      </button>
    </div>
  </motion.div>
);

export default function Home() {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    isAdmin, 
    isModerator, 
    userRole, 
    walletBalance,  // Get wallet balance from AuthContext
    refreshWalletBalance,
    hasPermission 
  } = useAuth();

  // REMOVED: const [walletBalance, setWalletBalance] = useState<number>(0);

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

  // Admin control handlers
  const handleStartGame = async () => {
    if (hasPermission('manage_games')) {
      try {
        if (!gameData?._id) return;
        
        const response = await gameAPI.startGame(gameData._id);
        
        if (response.data.success) {
          console.log('🔄 Admin starting game...');
          await checkGameStatus();
        }
      } catch (error) {
        console.error('❌ Failed to start game by admin:', error);
        setJoinError('Failed to start game');
      }
    }
  };

  const handleEndGame = () => {
    if (hasPermission('manage_games')) {
      console.log('🛑 Admin ending game...');
      // Implement game end logic
    }
  };

  const handleManageUsers = () => {
    if (hasPermission('manage_users')) {
      console.log('👥 Admin managing users...');
      // Navigate to user management
    }
  };

  const handleModerateGames = () => {
    if (hasPermission('moderate_games')) {
      console.log('🛡️ Moderator moderating games...');
      // Implement moderation logic
    }
  };

  const handleViewReports = () => {
    if (hasPermission('view_reports')) {
      console.log('📊 Moderator viewing reports...');
      // Navigate to reports
    }
  };

  // FIXED: Proper user ID detection for wallet operations
  const getCurrentUserId = (): string | null => {
    if (!user) return null;
    
    console.log('🔍 Current user object:', user);
    
    // Use the authenticated user's ID from context (most reliable)
    if (user.id) {
      console.log('✅ Using authenticated user ID:', user.id);
      return user.id.toString();
    }
    
    // Fallback to localStorage with proper validation
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('user_id');
      if (storedUserId && storedUserId !== 'undefined' && storedUserId !== 'null') {
        console.log('📱 Using user ID from localStorage:', storedUserId);
        return storedUserId;
      }
    }
    
    console.warn('❌ No valid user ID found');
    return null;
  };

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

  // FIXED: Main initialization with proper user context
  useEffect(() => {
    const initializeApp = async () => {
      if (!isAuthenticated || !user) return;

      try {
        setLoading(true);
        
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
          console.error('No valid user ID available for current user');
          setLoading(false);
          return;
        }

        console.log('👤 Initializing app for user:', {
          id: currentUserId,
          name: user.firstName || user.username,
          telegramId: user.telegramId,
          role: userRole,
          balance: walletBalance // Already available from context
        });
        
        // Refresh wallet balance to ensure it's current
        await refreshWalletBalance();
        
        // Rest of initialization...
        await checkGameStatus();
        setShowNumberSelection(true);
        
      } catch (error) {
        console.error('Initialization error for current user:', error);
        setShowNumberSelection(true);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, [isAuthenticated, user, userRole]);

  useEffect(() => {
    console.log('💰 Wallet balance state updated for current user:', walletBalance);
  }, [walletBalance]);

  // Auto-redirect when game starts and user has selected a card with balance
  useEffect(() => {
    if (!user) return;
    
    if (gameStatus === 'ACTIVE' && selectedNumber && walletBalance >= 10 && !autoRedirected) {
      console.log('🚀 Auto-redirecting current user to game');
      setAutoRedirected(true);
      
      const joinGameWithRetry = async (retries = 3) => {
        try {
          console.log('🤖 Auto-joining game for current user...');
          
          const waitingGamesResponse = await gameAPI.getWaitingGames();
          const activeGamesResponse = await gameAPI.getActiveGames();
          
          let targetGame = null;
          
          if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
            targetGame = waitingGamesResponse.data.games[0];
          } else if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
            targetGame = activeGamesResponse.data.games[0];
          }
          
          if (targetGame) {
            const currentUserId = getCurrentUserId();
            if (!currentUserId) {
              throw new Error('No user ID available for current user');
            }
            
            const joinResponse = await gameAPI.joinGame(targetGame.code, currentUserId);
            
            if (joinResponse.data.success) {
              console.log('✅ Current user auto-joined game successfully');
              router.push(`/game/${targetGame._id}`);
            } else {
              throw new Error('Join game API call failed for current user');
            }
          } else {
            throw new Error('No games available for current user');
          }
        } catch (error) {
          console.error('Auto-join attempt failed for current user:', error);
          
          if (retries > 0) {
            console.log(`🔄 Retrying auto-join for current user... (${retries} attempts left)`);
            setTimeout(() => joinGameWithRetry(retries - 1), 2000);
          } else {
            console.error('❌ All auto-join attempts failed for current user');
            // Fallback: redirect to watch mode
            const activeGamesResponse = await gameAPI.getActiveGames();
            if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
              router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
            }
          }
        }
      };
      
      joinGameWithRetry();
    }
  }, [gameStatus, selectedNumber, autoRedirected, walletBalance, user, router]);

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
  
  const shouldEnableCardSelection = () => {
    console.log('🎯 CARD SELECTION DEBUG for current user:', {
      gameStatus,
      walletBalance,
      selectedNumber,
      hasGameData: !!gameData?._id,
      availableCardsCount: availableCards.length,
      isSelectionActive: cardSelectionStatus.isSelectionActive
    });

    if (selectedNumber) {
      console.log('🎯 Current user already has card #', selectedNumber);
      return false;
    }

    if (!gameData?._id) {
      console.log('🎯 No game data available for current user');
      return false;
    }

    if (walletBalance >= 10) {
      console.log('🎯 Current user has sufficient balance, enabling card selection');
      return true;
    }

    console.log('🎯 Card selection disabled for current user - insufficient balance');
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
      console.error('Error fetching available cards for current user:', error);
    }
  };

  const handleLateEntryJoin = async (cardNumber: number) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId || !gameData?._id) return;

    try {
      setJoining(true);
      setCardSelectionError('');

      const cardResponse = await gameAPI.selectCard(gameData._id, currentUserId, cardNumber);
      
      if (cardResponse.data.success) {
        setSelectedNumber(cardNumber);
        setBingoCard(generateBingoCard(cardNumber));
        
        const joinResponse = await gameAPI.joinGame(gameData.code, currentUserId);
        
        if (joinResponse.data.success) {
          console.log('✅ Late entry successful for current user with card #', cardNumber);
          router.push(`/game/${gameData._id}`);
        } else {
          setJoinError('Failed to join active game for current user');
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to join game for current user';
      setCardSelectionError(errorMessage);
      console.error('Late entry error for current user:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleCardSelect = async (cardNumber: number) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId || !gameData?._id) return;
    
    try {
      setCardSelectionError('');
      
      const response = await gameAPI.selectCard(gameData._id, currentUserId, cardNumber);
      
      if (response.data.success) {
        setSelectedNumber(cardNumber);
        setBingoCard(generateBingoCard(cardNumber));
        setJoinError('');
        setShowGameView(false);
        setAutoRedirected(false);
        
        await fetchAvailableCards();
        
        console.log(`✅ Card #${cardNumber} selected successfully for current user`);
        
        if (gameStatus === 'ACTIVE') {
          console.log('🚀 Auto-joining active game for current user with late entry...');
          setTimeout(() => {
            handleAutoJoinGame();
          }, 1000);
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to select card for current user';
      setCardSelectionError(errorMessage);
      console.error('Card selection error for current user:', error);
    }
  };

  const handleCardRelease = async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId || !gameData?._id) return;
    
    try {
      const response = await gameAPI.releaseCard(gameData._id, currentUserId);
      
      if (response.data.success) {
        setSelectedNumber(null);
        setBingoCard(null);
        setJoinError('');
        
        await fetchAvailableCards();
        
        console.log('🔄 Card released successfully for current user');
      }
    } catch (error: any) {
      console.error('Card release error for current user:', error);
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
        
        if (response.data.isSelectionActive && !selectedNumber && availableCards.length > 0) {
          if (response.data.timeRemaining < 5000) {
            const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
            await handleCardSelect(randomCard);
          }
        }
      }
    } catch (error) {
      console.error('Error checking card selection status for current user:', error);
    }
  };

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

  const handleJoinGame = async () => {
    const currentUserId = getCurrentUserId();
    if (!selectedNumber || !currentUserId) return;

    setJoining(true);
    setJoinError('');

    try {
      // Use walletBalance directly from context
      if (walletBalance < 10) {
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
        const joinResponse = await gameAPI.joinGame(game.code, currentUserId);
        
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
    const currentUserId = getCurrentUserId();
    if (!selectedNumber || !currentUserId) return;

    try {
      console.log('🤖 Auto-joining game for current user...');
      
      const waitingGamesResponse = await gameAPI.getWaitingGames();
      
      if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
        const game = waitingGamesResponse.data.games[0];
        const joinResponse = await gameAPI.joinGame(game.code, currentUserId);
        
        if (joinResponse.data.success) {
          const updatedGame = joinResponse.data.game;
          console.log('✅ Current user auto-joined game successfully');
          router.push(`/game/${updatedGame._id}`);
        } else {
          console.log('⚠️ Auto-join failed for current user, redirecting to watch');
          router.push(`/game/${game._id}?spectator=true`);
        }
      } else {
        const activeGamesResponse = await gameAPI.getActiveGames();
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          router.push(`/game/${activeGamesResponse.data.games[0]._id}?spectator=true`);
        }
      }
    } catch (error: any) {
      console.error('Auto-join failed for current user:', error);
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

  const getStatusMessage = () => {
    const players = currentPlayers || 0;
    const minPlayers = 2;
    
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
            <UserInfoDisplay user={user} userRole={userRole} />
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
      {/* Updated Navbar with Role Info */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white font-bold text-xl">Bingo Game {user?.telegramId}</h1>
            <p className="text-white/60 text-sm">
              {isAdmin ? 'Admin Dashboard' : 
               isModerator ? 'Moderator View' : 
               'Select your card number'}
            </p>
          </div>
          
          {/* User Info with Role Badge */}
          <UserInfoDisplay user={user} userRole={userRole} />
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <AdminControls 
          onStartGame={handleStartGame}
          onEndGame={handleEndGame}
          onManageUsers={handleManageUsers}
        />
      )}

      {/* Moderator Controls */}
      {isModerator && !isAdmin && (
        <ModeratorControls 
          onModerateGames={handleModerateGames}
          onViewReports={handleViewReports}
        />
      )}

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

      {walletBalance >= 10 && (
        <motion.div 
          className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-blue-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-300" />
              <p className="text-blue-300 font-bold text-sm">Ready to Play!</p>
            </div>
            <p className="text-blue-200 text-sm font-bold">
              Balance: {walletBalance} ብር
            </p>
          </div>

          {shouldEnableCardSelection() && cardSelectionStatus.isSelectionActive && (
            <div>
              <div className="flex justify-between text-xs text-blue-200 mb-1">
                <span>Choose your card number to join the game</span>
                <span>{takenCards.length}/400 cards taken</span>
              </div>
              <div className="w-full bg-blue-400/20 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${((30000 - cardSelectionStatus.timeRemaining) / 30000) * 100}%` 
                  }}
                />
              </div>
              <p className="text-blue-200 text-xs mt-2 text-center">
                {Math.ceil(cardSelectionStatus.timeRemaining / 1000)}s remaining to select
              </p>
            </div>
          )}

          {shouldEnableCardSelection() && !cardSelectionStatus.isSelectionActive && gameStatus === 'WAITING' && (
            <p className="text-blue-200 text-xs text-center">
              🎯 Select a card number to join the waiting game
            </p>
          )}

          {shouldEnableCardSelection() && !cardSelectionStatus.isSelectionActive && gameStatus === 'ACTIVE' && (
            <p className="text-green-200 text-xs text-center">
              🚀 Game in progress - Select a card for late entry!
            </p>
          )}

          {shouldEnableCardSelection() && gameStatus === 'FINISHED' && (
            <p className="text-orange-200 text-xs text-center">
              🔄 Select a card for the next game (starting in {restartCountdown}s)
            </p>
          )}

          {!shouldEnableCardSelection() && walletBalance >= 10 && (
            <p className="text-yellow-200 text-xs text-center">
              ⏳ Waiting for card selection to become available...
            </p>
          )}

          {cardSelectionError && (
            <p className="text-red-300 text-xs mt-2 text-center">
              {cardSelectionError}
            </p>
          )}
        </motion.div>
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
            const canSelect = walletBalance >= 10;
            const isSelectable = canSelect && isAvailable && !isTaken;

            return (
              <motion.button
                key={number}
                onClick={() => isSelectable && handleCardSelect(number)}
                disabled={!isSelectable}
                className={`
                  aspect-square rounded-xl font-bold text-sm transition-all relative
                  ${isTaken
                    ? 'bg-red-500/50 text-white/50 cursor-not-allowed border-red-400/50'
                    : isSelectable
                    ? gameStatus === 'ACTIVE' 
                      ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                      : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
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
                
                {!isTaken && isSelectable && gameStatus === 'ACTIVE' && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                
                {!isTaken && !isSelectable && walletBalance < 10 && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-60">
                    <div className="w-3 h-3 text-yellow-400">
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
          {!selectedNumber && walletBalance >= 10 && (
            <>
              {gameStatus === 'WAITING' && (
                <p className="text-blue-300 text-sm text-center">
                  🎯 Select a card number to join the waiting game
                </p>
              )}
              {gameStatus === 'ACTIVE' && (
                <p className="text-green-300 text-sm text-center">
                  🚀 Game in progress - Select a card for late entry!
                </p>
              )}
              {gameStatus === 'FINISHED' && (
                <p className="text-orange-300 text-sm text-center">
                  🔄 Select a card for the next game (starting in {restartCountdown}s)
                </p>
              )}
              {gameStatus === 'RESTARTING' && (
                <p className="text-purple-300 text-sm text-center">
                  ⚡ New game starting soon - Select your card!
                </p>
              )}
            </>
          )}
          
          {!selectedNumber && walletBalance < 10 && (
            <p className="text-yellow-300 text-sm text-center">
              💡 Add balance to play - Watch mode available
            </p>
          )}
          
          {selectedNumber && walletBalance >= 10 && (
            <>
              {gameStatus === 'WAITING' && (
                <p className="text-blue-300 text-sm text-center">
                  ⏳ Ready! Game will start when enough players join
                </p>
              )}
              {gameStatus === 'ACTIVE' && (
                <p className="text-green-300 text-sm text-center">
                  🚀 Auto-joining active game with card #{selectedNumber}...
                </p>
              )}
              {gameStatus === 'FINISHED' && (
                <p className="text-orange-300 text-sm text-center">
                  🔄 Card #{selectedNumber} reserved for next game
                </p>
              )}
            </>
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
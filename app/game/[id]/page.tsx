// app/game/[id]/page.tsx - COMPLETE FIXED VERSION
'use client'

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from '../../../hooks/useGame';
import { useTelegram } from '../../../hooks/useTelegram';
import { BingoCard } from '../../../components/ui/BingoCard';
import { NumberGrid } from '../../../components/ui/NumberGrid';
import { GameLobby } from '../../../components/ui/GameLobby';
import { gameAPI } from '../../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Volume2, Home, Crown, Sparkles, Zap, Gamepad2, ArrowLeft, Clock, User, Eye, Clock3, AlertCircle } from 'lucide-react';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, WebApp } = useTelegram();
  
  // Use useGame hook with stable references
  const { game, bingoCard, gameState, markNumber, refreshGame, isLoading, getWinnerInfo } = useGame(id);
  
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);

  // Stable currentUserId setup
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (userId && userId !== currentUserId) {
      setCurrentUserId(userId);
    }
  }, [currentUserId]);

  // Memoize late joiner status to prevent unnecessary re-renders
  const isLateJoiner = useMemo(() => 
    bingoCard?.isLateJoiner || false, 
    [bingoCard?.isLateJoiner]
  );
  
  const numbersCalledAtJoin = useMemo(() => 
    bingoCard?.numbersCalledAtJoin || [], 
    [bingoCard?.numbersCalledAtJoin]
  );

  // Optimized timestamp updates - only update when meaningful changes occur
  useEffect(() => {
    if (gameState.currentNumber || game?.numbersCalled?.length) {
      setLastUpdate(new Date());
    }
  }, [gameState.currentNumber, game?.numbersCalled?.length]);

  // Optimized winner check
  useEffect(() => {
    if (game?.status === 'FINISHED' && game.winner && !showWinnerModal) {
      const fetchWinnerInfo = async () => {
        try {
          const winnerData = await getWinnerInfo();
          setWinnerInfo(winnerData || {
            winner: game.winner,
            gameCode: game.code,
            totalPlayers: game.currentPlayers,
            numbersCalled: game.numbersCalled?.length || 0
          });
          setShowWinnerModal(true);
        } catch (error) {
          console.error('Error fetching winner info:', error);
          setWinnerInfo({
            winner: game.winner,
            gameCode: game.code,
            totalPlayers: game.currentPlayers,
            numbersCalled: game.numbersCalled?.length || 0
          });
          setShowWinnerModal(true);
        }
      };
      
      fetchWinnerInfo();
    }
  }, [game?.status, game?.winner, showWinnerModal, getWinnerInfo]);

  // Optimized win animation check
  useEffect(() => {
    if (game?.status === 'FINISHED' && bingoCard?.isWinner && !showWinAnimation) {
      setShowWinAnimation(true);
    }
  }, [game?.status, bingoCard?.isWinner, showWinAnimation]);

  // Stable callback functions
  const handleStartGame = useCallback(async () => {
    if (!game) return;
    
    try {
      await gameAPI.startGame(game._id);
      refreshGame();
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  }, [game, refreshGame]);

  const handleMarkNumber = useCallback(async (number: number) => {
    if (!currentUserId) return;
    
    try {
      const isWinner = await markNumber(number);
      if (isWinner && !showWinAnimation) {
        setShowWinAnimation(true);
      }
    } catch (error) {
      console.error('Error marking number:', error);
    }
  }, [currentUserId, markNumber, showWinAnimation]);

  const handleBackToLobby = useCallback(() => {
    router.push('/');
  }, [router]);

  const handlePlayAgain = useCallback(() => {
    setShowWinAnimation(false);
    setShowWinnerModal(false);
    router.push('/games');
  }, [router]);

  const handleManualRefresh = useCallback(() => {
    refreshGame();
  }, [refreshGame]);

  const togglePlayersPanel = useCallback(() => {
    setShowPlayersPanel(prev => !prev);
  }, []);

  // Optimized time calculation
  const getTimeSinceLastNumber = useCallback(() => {
    if (!gameState.lastCalledAt) return 'Waiting for first number...';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - gameState.lastCalledAt.getTime()) / 1000);
    
    if (diffInSeconds < 5) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  }, [gameState.lastCalledAt]);

  // Memoized player data
  const getPlayerDisplayName = useCallback((player: any) => {
    if (!player.user) return 'Unknown Player';
    return player.user.firstName || player.user.username || 'Unknown Player';
  }, []);

  const isCurrentUser = useCallback((player: any) => {
    return player.userId === currentUserId || player.user?._id === currentUserId;
  }, [currentUserId]);

  const getPlayerLateJoinerStatus = useCallback((player: any) => {
    return player.isLateJoiner || false;
  }, []);

  // Memoize derived game data
  const calledNumbers = useMemo(() => 
    gameState.calledNumbers || game?.numbersCalled || [], 
    [gameState.calledNumbers, game?.numbersCalled]
  );
  
  const calledNumbersCount = useMemo(() => calledNumbers.length, [calledNumbers]);
  const currentNumber = gameState.currentNumber;
  
  const playersData = useMemo(() => ({
    active: game?.players?.filter(p => p.playerType === 'PLAYER') || [],
    spectators: game?.players?.filter(p => p.playerType === 'SPECTATOR') || [],
    total: game?.players?.length || 0
  }), [game?.players]);

  // Players Panel Component - Memoized
  const PlayersPanel = useMemo(() => {
    if (!showPlayersPanel || !game?.players) return null;

    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/30 shadow-2xl w-full max-w-sm max-h-96 overflow-hidden"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-xl">Players ({playersData.total})</h3>
              <motion.button
                onClick={togglePlayersPanel}
                className="text-white/80 hover:text-white transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {game.players.map((player, index) => {
                const isLate = getPlayerLateJoinerStatus(player);
                return (
                  <motion.div
                    key={player._id || index}
                    className={`flex items-center justify-between p-3 rounded-2xl border ${
                      isCurrentUser(player) 
                        ? 'bg-blue-500/20 border-blue-500/30' 
                        : 'bg-white/10 border-white/20'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCurrentUser(player) ? 'bg-blue-500' : 'bg-white/20'
                      }`}>
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium flex items-center gap-2">
                          {getPlayerDisplayName(player)}
                          {isCurrentUser(player) && (
                            <span className="text-blue-300 text-sm">(You)</span>
                          )}
                        </div>
                        <div className="text-white/60 text-xs flex items-center gap-1">
                          {player.playerType === 'SPECTATOR' ? (
                            <>
                              <Eye className="w-3 h-3" />
                              Spectator
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" />
                              Player
                              {isLate && (
                                <span className="text-yellow-400 flex items-center gap-1">
                                  <Clock3 className="w-3 h-3" />
                                  Late Joiner
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {player.playerType === 'PLAYER' && (
                      <div className="text-right">
                        <div className="text-white text-sm">
                          {bingoCard?.markedPositions?.length || 0}/25
                        </div>
                        <div className="text-white/60 text-xs">marked</div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="grid grid-cols-2 gap-4 text-center text-white/80 text-sm">
                <div>
                  <div className="font-bold text-white">{playersData.active.length}</div>
                  <div>Players</div>
                </div>
                <div>
                  <div className="font-bold text-white">{playersData.spectators.length}</div>
                  <div>Spectators</div>
                </div>
              </div>
              
              {isLateJoiner && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-2 bg-yellow-500/20 rounded-xl border border-yellow-500/30"
                >
                  <div className="flex items-center gap-2 text-yellow-300 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span>Late joiners get credit for all called numbers!</span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }, [showPlayersPanel, game?.players, playersData, isLateJoiner, togglePlayersPanel, getPlayerLateJoinerStatus, isCurrentUser, getPlayerDisplayName, bingoCard?.markedPositions?.length]);

  // Winner Modal Component - Memoized
  const WinnerModal = useMemo(() => {
    if (!showWinnerModal || !winnerInfo) return null;

    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-3xl p-8 mx-4 text-center shadow-2xl border-2 border-white/30 w-full max-w-sm"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl"
                  initial={{
                    x: Math.random() * 300 - 150,
                    y: -50,
                    rotate: 0,
                    scale: 0,
                  }}
                  animate={{
                    y: 400,
                    rotate: 360,
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 1,
                    delay: Math.random() * 0.5,
                  }}
                  style={{
                    left: `${Math.random() * 100}%`,
                  }}
                >
                  🎉
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="relative z-10"
            >
              <Trophy className="w-16 h-16 text-white mx-auto mb-4 drop-shadow-2xl" />
              <h2 className="text-3xl font-black text-white mb-4 drop-shadow-lg">
                GAME OVER!
              </h2>
              
              <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/30">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Crown className="w-8 h-8 fill-yellow-400 text-yellow-400" />
                  <h3 className="text-xl font-black text-white">
                    {winnerInfo.winner?.firstName || winnerInfo.winner?.username || 'Unknown Player'}
                  </h3>
                </div>
                <p className="text-white/90 font-bold text-lg">is the Winner! 🏆</p>
                
                {bingoCard?.isLateJoiner && winnerInfo.winner?._id === currentUserId && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-2 p-2 bg-yellow-500/30 rounded-lg border border-yellow-500/50"
                  >
                    <p className="text-yellow-200 text-sm font-bold flex items-center justify-center gap-2">
                      <Clock3 className="w-4 h-4" />
                      Late Joiner Victory! 🎯
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-white/80 mb-6">
                <div>
                  <div className="font-bold">{winnerInfo.totalPlayers || game?.currentPlayers}</div>
                  <div>Players</div>
                </div>
                <div>
                  <div className="font-bold">{winnerInfo.numbersCalled || game?.numbersCalled?.length || 0}</div>
                  <div>Numbers Called</div>
                </div>
              </div>
              
              <motion.button
                onClick={handlePlayAgain}
                className="w-full bg-white text-orange-600 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Play Again
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }, [showWinnerModal, winnerInfo, game?.currentPlayers, game?.numbersCalled?.length, bingoCard?.isLateJoiner, currentUserId, handlePlayAgain]);

  // Late Joiner Info Banner - Memoized
  const LateJoinerInfo = useMemo(() => {
    if (!isLateJoiner || game?.status !== 'ACTIVE') return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <div className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 border border-yellow-500/30">
          <div className="flex items-center gap-3">
            <Clock3 className="w-6 h-6 text-yellow-400" />
            <div>
              <h4 className="text-yellow-300 font-bold text-lg">Late Joiner</h4>
              <p className="text-yellow-400/80 text-sm">
                You joined when {numbersCalledAtJoin.length} numbers were already called.
                All numbers count towards your bingo! 🎯
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }, [isLateJoiner, game?.status, numbersCalledAtJoin.length]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.5, repeat: Infinity }
            }}
            className="w-20 h-20 border-4 border-white border-t-transparent rounded-full mx-auto mb-6"
          />
          <motion.p 
            className="text-white text-xl font-bold"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Loading Game...
          </motion.p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Game Not Found</h1>
          <button 
            onClick={handleBackToLobby}
            className="bg-white text-purple-600 px-6 py-3 rounded-2xl font-bold"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  if (game.status === 'WAITING') {
    return (
      <GameLobby
        game={game}
        currentUserId={currentUserId}
        onStartGame={handleStartGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 relative overflow-hidden">
      {/* Memoized Components */}
      {PlayersPanel}
      {WinnerModal}
      {LateJoinerInfo}

      {/* Animated Background */}
      <div className="absolute inset-0">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 bg-white/10 rounded-full"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 100),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 100),
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-md mx-auto p-4 safe-area-padding">
        {/* Header with Navigation */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between mb-6 pt-4"
        >
          <motion.button
            onClick={handleBackToLobby}
            className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Home</span>
          </motion.button>

          <div className="flex gap-2">
            <motion.button
              onClick={togglePlayersPanel}
              className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Users className="w-5 h-5" />
              <span className="font-bold">{playersData.total}</span>
            </motion.button>

            <motion.button
              onClick={handleManualRefresh}
              className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Clock className="w-5 h-5" />
              <span className="font-bold">Refresh</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Game Header */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/30 shadow-2xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <motion.h1 
                className="text-3xl font-black text-white mb-2"
                initial={{ x: -20 }}
                animate={{ x: 0 }}
              >
                Game {game.code}
              </motion.h1>
              <div className="flex items-center gap-3 text-white/80 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{playersData.active.length} players</span>
                  {playersData.spectators.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {playersData.spectators.length} spectators
                    </span>
                  )}
                </div>
                <span>•</span>
                <span>{calledNumbersCount} numbers called</span>
                {isLateJoiner && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400 flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      Late Joiner
                    </span>
                  </>
                )}
                {currentNumber && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeSinceLastNumber()}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-2 bg-white/20 rounded-2xl px-4 py-2"
            >
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-black text-lg">{playersData.active.length}</span>
            </motion.div>
          </div>

          {/* Game Status Badge */}
          <div className="flex justify-between items-center">
            <div className={`px-4 py-2 rounded-2xl font-black text-sm ${
              game.status === 'ACTIVE' 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
            }`}>
              {game.status === 'ACTIVE' ? 'LIVE' : game.status}
            </div>
            
            <motion.button
              className="p-3 bg-white/20 rounded-2xl border border-white/30 hover:bg-white/30 transition-colors"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
            >
              <Volume2 className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </motion.div>

        {/* Current Number Display */}
        {currentNumber && (
          <motion.div
            key={currentNumber}
            className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 text-center mb-6 border border-white/30 shadow-2xl"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <div className="text-white/80 text-lg font-bold mb-3">Current Number</div>
            <motion.div
              className="text-8xl font-black text-white drop-shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              {currentNumber}
            </motion.div>
            <motion.div
              className="text-white/60 text-sm mt-3 flex items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Clock className="w-4 h-4" />
              Last called {getTimeSinceLastNumber()}
            </motion.div>
          </motion.div>
        )}

        {/* No numbers called message */}
        {game.status === 'ACTIVE' && calledNumbersCount === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-orange-500/20 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-orange-500/30 text-center"
          >
            <p className="text-orange-300 font-bold">
              ⏳ Waiting for numbers to be called...
            </p>
            <p className="text-orange-400/80 text-sm mt-1">
              Numbers are called automatically every 8-12 seconds
            </p>
          </motion.div>
        )}

        {/* Main Game Content */}
        <div className="space-y-6">
          {/* Bingo Card */}
          {bingoCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <BingoCard
                card={bingoCard}
                calledNumbers={calledNumbers}
                onMarkNumber={handleMarkNumber}
                isInteractive={game.status === 'ACTIVE'}
                isWinner={bingoCard.isWinner}
                isLateJoiner={isLateJoiner}
                numbersCalledAtJoin={numbersCalledAtJoin}
              />
            </motion.div>
          )}

          {/* Number Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <NumberGrid
              calledNumbers={calledNumbers}
              currentNumber={currentNumber}
              isLateJoiner={isLateJoiner}
              numbersCalledAtJoin={numbersCalledAtJoin}
            />
          </motion.div>
        </div>

        {/* Win Animation for current user */}
        <AnimatePresence>
          {showWinAnimation && (
            <motion.div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-3xl p-8 mx-4 text-center shadow-2xl border-2 border-white/30 w-full max-w-sm"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                {/* Confetti Effect */}
                <div className="absolute inset-0 overflow-hidden rounded-3xl">
                  {[...Array(30)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute text-2xl"
                      initial={{
                        x: Math.random() * 300 - 150,
                        y: -50,
                        rotate: 0,
                        scale: 0,
                      }}
                      animate={{
                        y: 400,
                        rotate: 360,
                        scale: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 1,
                        delay: Math.random() * 0.5,
                      }}
                      style={{
                        left: `${Math.random() * 100}%`,
                      }}
                    >
                      🎉
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="relative z-10"
                >
                  <Trophy className="w-24 h-24 text-white mx-auto mb-6 drop-shadow-2xl" />
                  <h2 className="text-4xl font-black text-white mb-4 drop-shadow-lg">
                    BINGO!
                  </h2>
                  
                  {/* Late joiner victory message */}
                  {isLateJoiner && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mb-4 p-3 bg-yellow-500/30 rounded-xl border border-yellow-500/50"
                    >
                      <p className="text-yellow-200 font-bold text-lg flex items-center justify-center gap-2">
                        <Clock3 className="w-5 h-5" />
                        Late Joiner Victory! 🎯
                      </p>
                      <p className="text-yellow-300 text-sm mt-1">
                        You won with numbers called before you joined!
                      </p>
                    </motion.div>
                  )}
                  
                  <p className="text-white/90 text-lg mb-2 font-bold">
                    Congratulations!
                  </p>
                  <p className="text-white/80 mb-6">
                    You're the champion! 🏆
                  </p>
                  
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => setShowWinAnimation(false)}
                      className="flex-1 bg-white/20 backdrop-blur-lg text-white py-4 rounded-2xl font-bold border border-white/30 hover:bg-white/30 transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      View Results
                    </motion.button>
                    <motion.button
                      onClick={handlePlayAgain}
                      className="flex-1 bg-white text-orange-600 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Play Again
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Stats Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-black text-white">{calledNumbersCount}</div>
                <div className="text-white/60 text-xs">Numbers Called</div>
              </div>
              <div>
                <div className="text-xl font-black text-white">
                  {bingoCard?.markedPositions?.length || 0}
                </div>
                <div className="text-white/60 text-xs">Marked</div>
              </div>
              <div>
                <div className="text-xl font-black text-white">
                  {Math.round(((bingoCard?.markedPositions?.length || 0) / 25) * 100)}%
                </div>
                <div className="text-white/60 text-xs">Progress</div>
              </div>
            </div>
            
            {/* Late joiner stats */}
            {isLateJoiner && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 pt-3 border-t border-white/20"
              >
                <div className="text-yellow-400 text-sm font-bold flex items-center justify-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  Late Joiner: {numbersCalledAtJoin.length} pre-called numbers counted
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Auto-refresh indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-4"
        >
          <p className="text-white/40 text-xs">
            Auto-refreshing every {game.status === 'ACTIVE' ? '3' : '8'} seconds
          </p>
        </motion.div>
      </div>
    </div>
  );
}
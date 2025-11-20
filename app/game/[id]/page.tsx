'use client'

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useGame } from '../../../hooks/useGame';
import { useTelegram } from '../../../hooks/useTelegram';
import { BingoCard } from '../../../components/ui/BingoCard';
import { NumberGrid } from '../../../components/ui/NumberGrid';
import { GameLobby } from '../../../components/ui/GameLobby';
import { gameAPI } from '../../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Volume2, Home, Crown, Sparkles, Zap, Gamepad2, ArrowLeft } from 'lucide-react';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, WebApp } = useTelegram();
  const { game, bingoCard, gameState, markNumber, refreshGame } = useGame(id);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    // Get user ID from localStorage
    const userId = localStorage.getItem('user_id');
    if (userId) {
      setCurrentUserId(userId);
    }
  }, []);

  useEffect(() => {
    if (game?.status === 'FINISHED' && bingoCard?.isWinner) {
      setShowWinAnimation(true);
    }
  }, [game?.status, bingoCard?.isWinner]);

  const handleStartGame = async () => {
    if (!game || !currentUserId) return;
    
    try {
      await gameAPI.startGame(game._id, currentUserId);
      refreshGame();
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  const handleMarkNumber = async (number: number) => {
    if (!currentUserId) return;
    
    const isWinner = await markNumber(number);
    if (isWinner) {
      setShowWinAnimation(true);
    }
  };

  const handleBackToLobby = () => {
    router.push('/');
  };

  const handleBackToGames = () => {
    router.push('/games');
  };

  const handlePlayAgain = () => {
    setShowWinAnimation(false);
    router.push('/games');
  };

  // Animation variants
  const backgroundVariants = {
    animate: (i: number) => ({
      y: [0, -100, 0],
      opacity: [0.3, 0.8, 0.3],
      transition: {
        duration: 4 + Math.random() * 3,
        repeat: Infinity,
        delay: Math.random() * 2,
      }
    })
  };

  // Safe access to host properties
  const getHostName = () => {
    if (!game?.host) return 'Unknown Host';
    return game.host.firstName || game.host.username || 'Unknown Host';
  };

  // Check if current user is host
  const isUserHost = () => {
    if (!game?.host || !currentUserId) return false;
    return game.host._id === currentUserId;
  };

  if (!game) {
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
            variants={backgroundVariants}
            animate="animate"
            custom={i}
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

          <motion.button
            onClick={handleBackToGames}
            className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
            whileHover={{ scale: 1.05, x: 2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="font-bold">Games</span>
          </motion.button>
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
              <div className="flex items-center gap-3 text-white/80">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{game.currentPlayers} players</span>
                </div>
                <span>•</span>
                <span>{game.numbersCalled?.length || 0} numbers called</span>
                {isUserHost() && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Crown className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-yellow-300">Host</span>
                    </div>
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
              <span className="text-white font-black text-lg">{game.currentPlayers}</span>
            </motion.div>
          </div>

          {/* Game Status Badge */}
          <div className="flex justify-between items-center">
            <div className={`px-4 py-2 rounded-2xl font-black text-sm ${
              game.status === 'ACTIVE' 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
            }`}>
              {game.status}
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
        {gameState.currentNumber && (
          <motion.div
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
              {gameState.currentNumber}
            </motion.div>
            <motion.div
              className="text-white/60 text-sm mt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Keep marking your numbers!
            </motion.div>
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
                calledNumbers={gameState.calledNumbers}
                onMarkNumber={handleMarkNumber}
                isInteractive={game.status === 'ACTIVE'}
                isWinner={bingoCard.isWinner}
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
              calledNumbers={gameState.calledNumbers}
              currentNumber={gameState.currentNumber}
            />
          </motion.div>
        </div>

        {/* Win Animation */}
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
                      Continue
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
                <div className="text-xl font-black text-white">{game.numbersCalled?.length || 0}</div>
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
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-6 pb-8"
        >
          <p className="text-white/40 text-sm">
            Good luck and have fun!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
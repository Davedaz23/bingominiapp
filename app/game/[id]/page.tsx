// app/game/[id]/page.tsx - FIXED VERSION
'use client'

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from '../../../hooks/useGame';
import { BingoCard } from '../../../components/ui/BingoCard';
import { NumberGrid } from '../../../components/ui/NumberGrid';
import { GameLobby } from '../../../components/ui/GameLobby';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, ArrowLeft, Clock, User, Eye, Clock3, Crown, Sparkles } from 'lucide-react';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const { game, bingoCard, gameState, markNumber, refreshGame, isLoading } = useGame(id);
  
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);

  // Get current user ID
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (userId) setCurrentUserId(userId);
  }, []);

  // Handle win animation for current user
  useEffect(() => {
    if (game?.status === 'FINISHED' && bingoCard?.isWinner) {
      setShowWinAnimation(true);
    }
  }, [game?.status, bingoCard?.isWinner]);

  // Handle winner modal for all players when game finishes
  useEffect(() => {
    if (game?.status === 'FINISHED' && game.winner) {
      const winnerData = {
        winner: game.winner,
        gameCode: game.code,
        totalPlayers: game.players?.length || 0,
        numbersCalled: game.numbersCalled?.length || 0,
        isCurrentUserWinner: bingoCard?.isWinner || false
      };
      setWinnerInfo(winnerData);
      setShowWinnerModal(true);
    }
  }, [game?.status, game?.winner, game?.code, game?.players, game?.numbersCalled, bingoCard?.isWinner]);

  // Memoized handlers
  const handleMarkNumber = useCallback(async (number: number) => {
    if (!currentUserId) return;
    const isWinner = await markNumber(number);
    if (isWinner) setShowWinAnimation(true);
  }, [currentUserId, markNumber]);

  const handleBackToLobby = useCallback(() => {
    router.push('/');
  }, [router]);

  const togglePlayersPanel = useCallback(() => {
    setShowPlayersPanel(prev => !prev);
  }, []);

  const handleCloseWinnerModal = useCallback(() => {
    setShowWinnerModal(false);
    setShowWinAnimation(false);
  }, []);

  // Memoized derived data
  const calledNumbers = useMemo(() => 
    gameState.calledNumbers || [], 
    [gameState.calledNumbers]
  );

  const playersData = useMemo(() => ({
    active: game?.players?.filter(p => p.playerType === 'PLAYER') || [],
    spectators: game?.players?.filter(p => p.playerType === 'SPECTATOR') || [],
    total: game?.players?.length || 0
  }), [game?.players]);

  // Fixed player display name function
  const getPlayerDisplayName = useCallback((player: any) => {
    // If player has user object with properties
    if (player.user && typeof player.user === 'object') {
      return player.user.firstName || player.user.username || 'Unknown Player';
    }
    // If userId is an object with properties
    if (player.userId && typeof player.userId === 'object') {
      return player.userId.firstName || player.userId.username || 'Unknown Player';
    }
    // If userId is just a string ID
    if (typeof player.userId === 'string') {
      // For now, just show a generic name since we don't have user details
      return `Player ${player.userId.substring(0, 6)}`;
    }
    return 'Unknown Player';
  }, []);

  // Check if player is current user
  const isCurrentUser = useCallback((player: any) => {
    if (!currentUserId) return false;
    
    // Check different possible ID locations
    if (player.userId === currentUserId) return true;
    if (player.user && player.user._id === currentUserId) return true;
    if (typeof player.userId === 'object' && player.userId._id === currentUserId) return true;
    
    return false;
  }, [currentUserId]);

  // Get winner display name
  const getWinnerDisplayName = useCallback(() => {
    if (!winnerInfo?.winner) return 'Unknown Player';
    
    const winner = winnerInfo.winner;
    if (winner.firstName || winner.username) {
      return winner.firstName || winner.username;
    }
    
    // If winner is just an ID string, try to find in players
    if (typeof winner === 'string' && game?.players) {
      const winnerPlayer = game.players.find(p => 
        p.userId === winner || 
        (p.user && p.user._id === winner) ||
        (typeof p.userId === 'object' && p.user?._id === winner)
      );
      if (winnerPlayer) {
        return getPlayerDisplayName(winnerPlayer);
      }
    }
    
    return 'Unknown Player';
  }, [winnerInfo, game?.players, getPlayerDisplayName]);

  // Winner Modal Component
  const WinnerModal = () => (
    <AnimatePresence>
      {showWinnerModal && winnerInfo && (
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
              <Trophy className="w-16 h-16 text-white mx-auto mb-4 drop-shadow-2xl" />
              
              {winnerInfo.isCurrentUserWinner ? (
                <>
                  <h2 className="text-3xl font-black text-white mb-4 drop-shadow-lg">
                    BINGO! YOU WON! 🏆
                  </h2>
                  <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/30">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <Crown className="w-8 h-8 fill-yellow-400 text-yellow-400" />
                      <h3 className="text-xl font-black text-white">Congratulations!</h3>
                    </div>
                    <p className="text-white/90 font-bold text-lg">You are the Winner! 🎉</p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black text-white mb-4 drop-shadow-lg">
                    GAME OVER!
                  </h2>
                  <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/30">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <Crown className="w-8 h-8 fill-yellow-400 text-yellow-400" />
                      <h3 className="text-xl font-black text-white">
                        {getWinnerDisplayName()}
                      </h3>
                    </div>
                    <p className="text-white/90 font-bold text-lg">is the Winner! 🏆</p>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm text-white/80 mb-6">
                <div>
                  <div className="font-bold">{winnerInfo.totalPlayers}</div>
                  <div>Players</div>
                </div>
                <div>
                  <div className="font-bold">{winnerInfo.numbersCalled}</div>
                  <div>Numbers Called</div>
                </div>
              </div>

              <motion.button
                onClick={handleCloseWinnerModal}
                className="w-full bg-white text-orange-600 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Continue
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1.5, repeat: Infinity } }}
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
    return <GameLobby game={game} currentUserId={currentUserId} onStartGame={function (): void {
      throw new Error('Function not implemented.');
    } } />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 relative overflow-hidden">
      {/* Winner Modal - Shows for all players when game finishes */}
      <WinnerModal />

      {/* Players Panel */}
      <AnimatePresence>
        {showPlayersPanel && (
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
                <button onClick={togglePlayersPanel} className="text-white/80 hover:text-white">✕</button>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {game.players?.map((player, index) => (
                  <motion.div
                    key={player._id || index}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${
                      isCurrentUser(player) 
                        ? 'bg-blue-500/20 border-blue-500/30' 
                        : 'bg-white/10 border-white/20'
                    } ${
                      game.status === 'FINISHED' && game.winner && 
                      (player.userId === game.winner?._id || 
                       (typeof game.winner === 'string' && player.userId === game.winner) ||
                       (player.user && player.user._id === game.winner?._id))
                        ? 'ring-2 ring-yellow-400 shadow-lg'
                        : ''
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      {game.status === 'FINISHED' && game.winner && 
                       (player.userId === game.winner?._id || 
                        (typeof game.winner === 'string' && player.userId === game.winner) ||
                        (player.user && player.user._id === game.winner?._id)) && (
                        <motion.div
                          className="absolute -top-1 -right-1"
                          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Crown className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        </motion.div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium flex items-center gap-2">
                        {getPlayerDisplayName(player)}
                        {isCurrentUser(player) && (
                          <span className="text-blue-300 text-sm">(You)</span>
                        )}
                        {game.status === 'FINISHED' && game.winner && 
                         (player.userId === game.winner?._id || 
                          (typeof game.winner === 'string' && player.userId === game.winner) ||
                          (player.user && player.user._id === game.winner?._id)) && (
                          <motion.span
                            className="text-yellow-400 text-sm font-bold"
                            animate={{ opacity: [1, 0.7, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            🏆 Winner
                          </motion.span>
                        )}
                      </div>
                      <div className="text-white/60 text-xs">
                        {player.playerType === 'SPECTATOR' ? 'Spectator' : 'Player'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Personal Win Animation - Only shows for the winner */}
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
              {/* Personal confetti for winner */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl">
                {[...Array(50)].map((_, i) => (
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
                <Trophy className="w-16 h-16 text-white mx-auto mb-4" />
                <h2 className="text-4xl font-black text-white mb-4">BINGO!</h2>
                <p className="text-white/90 text-xl mb-2">Congratulations!</p>
                <p className="text-white/80 text-lg mb-6">You won the game! 🏆</p>
                <button
                  onClick={() => setShowWinAnimation(false)}
                  className="w-full bg-white text-orange-600 py-4 rounded-2xl font-bold hover:shadow-xl transition-all"
                >
                  Celebrate!
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-md mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={handleBackToLobby}
            className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Home</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={togglePlayersPanel}
              className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
            >
              <Users className="w-5 h-5" />
              <span className="font-bold">{playersData.total}</span>
            </button>

            <button
              onClick={refreshGame}
              className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
            >
              <Clock className="w-5 h-5" />
              <span className="font-bold">Refresh</span>
            </button>
          </div>
        </div>

        {/* Game Header */}
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/30">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-black text-white mb-2">Game {game.code}</h1>
              <div className="flex items-center gap-3 text-white/80 text-sm">
                <span>{playersData.active.length} players</span>
                <span>•</span>
                <span>{calledNumbers.length} numbers called</span>
                {game.status === 'FINISHED' && game.winner && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-300 font-bold">
                      🏆 {getWinnerDisplayName()} won!
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className={`px-4 py-2 rounded-2xl font-black text-sm ${
              game.status === 'ACTIVE' 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : game.status === 'FINISHED'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {game.status === 'ACTIVE' ? 'LIVE' : 
               game.status === 'FINISHED' ? 'FINISHED' : 
               game.status}
            </div>
          </div>

          {/* Winner Banner */}
          {game.status === 'FINISHED' && game.winner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-yellow-500/20 rounded-2xl p-4 border border-yellow-500/30 mt-4"
            >
              <div className="flex items-center justify-center gap-3">
                <Crown className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-yellow-300 font-bold text-lg">
                  {winnerInfo?.isCurrentUserWinner ? 'You won the game! 🎉' : `${getWinnerDisplayName()} won the game!`}
                </span>
                <Crown className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              </div>
            </motion.div>
          )}
        </div>

        {/* Current Number */}
        {gameState.currentNumber && game.status === 'ACTIVE' && (
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 text-center mb-6 border border-white/30">
            <div className="text-white/80 text-lg font-bold mb-3">Current Number</div>
            <div className="text-8xl font-black text-white">{gameState.currentNumber}</div>
          </div>
        )}

        {/* Game Finished Banner */}
        {game.status === 'FINISHED' && !gameState.currentNumber && (
          <div className="bg-yellow-500/20 backdrop-blur-lg rounded-3xl p-6 text-center mb-6 border border-yellow-500/30">
            <div className="text-yellow-300 text-xl font-bold mb-2">Game Finished</div>
            <p className="text-yellow-400/80">
              {winnerInfo?.isCurrentUserWinner 
                ? 'Congratulations on your victory! 🏆' 
                : `Better luck next time! ${getWinnerDisplayName()} won this round.`
              }
            </p>
          </div>
        )}

        {/* Game Content */}
        <div className="space-y-6">
          {bingoCard && (
            <BingoCard
              card={bingoCard}
              calledNumbers={calledNumbers}
              onMarkNumber={handleMarkNumber}
              isInteractive={game.status === 'ACTIVE'}
              isWinner={bingoCard.isWinner}
            />
          )}

          <NumberGrid
            calledNumbers={calledNumbers}
            currentNumber={gameState.currentNumber}
          />
        </div>

        {/* Stats Footer */}
        <div className="text-center mt-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-black text-white">{calledNumbers.length}</div>
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
        </div>
      </div>
    </div>
  );
}
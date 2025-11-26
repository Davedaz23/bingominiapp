'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../hooks/useTelegram';
import { gameAPI } from '../../services/api';
import { Game } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, Crown, Sparkles, Gamepad2, Eye } from 'lucide-react';

export default function GamesPage() {
  const { user, isReady } = useTelegram();
  const router = useRouter();
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [joinError, setJoinError] = useState<string>('');

  useEffect(() => {
    if (isReady) {
      const userId = localStorage.getItem('user_id');
      if (userId) {
        setCurrentUserId(userId);
      }
      loadActiveGames();
    }
  }, [isReady]);

  const loadActiveGames = async () => {
    try {
      const response = await gameAPI.getActiveGames();
      setActiveGames(response.data.games || []);
    } catch (error) {
      console.error('Failed to load games:', error);
      setActiveGames([]);
    } finally {
      setIsLoading(false);
    }
  };

  const joinGame = async (game: Game) => {
    try {
      setJoinError('');
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      
      await gameAPI.joinGame(game.code, userId);
      router.push(`/game/${game._id}`);
    } catch (error: any) {
      console.error('Failed to join game:', error);
      
      // Handle specific error cases
      if (error.response?.data?.error === 'Game already started') {
        // Game is active but user can still join as spectator
        try {
          await gameAPI.joinGame(game.code, localStorage.getItem('user_id')!);
          router.push(`/game/${game._id}`);
        } catch (spectatorError) {
          setJoinError('Failed to join as spectator. Please try again.');
        }
      } else {
        setJoinError(error.response?.data?.error || 'Failed to join game');
      }
    }
  };

  const joinFirstGame = async () => {
    if (activeGames.length > 0) {
      await joinGame(activeGames[0]);
    }
  };

  // Get button text based on game status
  const getJoinButtonText = (game: Game) => {
    if (game.status === 'ACTIVE') {
      return 'JOIN AS SPECTATOR';
    } else if (game.status === 'FINISHED') {
      return 'GAME ENDED';
    }
    return 'JOIN GAME';
  };

  // Get status badge color and text
  const getStatusBadge = (game: Game) => {
    switch (game.status) {
      case 'ACTIVE':
        return {
          text: 'LIVE',
          color: 'bg-green-500/20 text-green-300 border-green-500/30'
        };
      case 'FINISHED':
        return {
          text: 'ENDED',
          color: 'bg-red-500/20 text-red-300 border-red-500/30'
        };
      default:
        return {
          text: 'WAITING',
          color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        };
    }
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

  if (!isReady || isLoading) {
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
            Loading Games...
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 max-w-md mx-auto p-4 safe-area-padding"
      >
        {/* Header */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8 pt-8"
        >
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl mb-4"
          >
            🎮
          </motion.div>
          <h1 className="text-5xl font-black text-white mb-3 drop-shadow-lg">
            GAME SESSIONS
          </h1>
          <p className="text-white/80 text-lg font-medium">Join • Play • Spectate • Win</p>
        </motion.div>

        {/* Error Message */}
        {joinError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-red-500/20 backdrop-blur-lg rounded-2xl p-4 border border-red-500/30 text-center"
          >
            <p className="text-red-300 text-sm font-medium">{joinError}</p>
          </motion.div>
        )}

        {/* Main Join Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <motion.button
            onClick={joinFirstGame}
            disabled={activeGames.length === 0 || (activeGames[0]?.status === 'FINISHED')}
            className={`w-full py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 group relative overflow-hidden ${
              activeGames.length > 0 && activeGames[0]?.status !== 'FINISHED'
                ? activeGames[0]?.status === 'ACTIVE'
                  ? 'bg-gradient-to-r from-blue-400 to-purple-400 text-white hover:shadow-3xl'
                  : 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:shadow-3xl'
                : 'bg-white/20 text-white/60 cursor-not-allowed'
            }`}
            whileHover={activeGames.length > 0 && activeGames[0]?.status !== 'FINISHED' ? { 
              scale: 1.02,
              y: -2
            } : {}}
            whileTap={activeGames.length > 0 && activeGames[0]?.status !== 'FINISHED' ? { scale: 0.98 } : {}}
          >
            {activeGames.length > 0 && activeGames[0]?.status !== 'FINISHED' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            )}
            
            {activeGames[0]?.status === 'ACTIVE' ? (
              <Eye className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
            
            {activeGames.length > 0 
              ? activeGames[0]?.status === 'FINISHED'
                ? 'GAME ENDED - NEW GAME SOON'
                : getJoinButtonText(activeGames[0])
              : 'NO SESSIONS AVAILABLE'
            }
            
            {activeGames.length > 0 && activeGames[0]?.status !== 'FINISHED' && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold"
              >
                {activeGames[0].currentPlayers} {activeGames[0].status === 'ACTIVE' ? 'playing' : 'online'}
              </motion.div>
            )}
          </motion.button>
        </motion.div>

        {/* Games List */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-6 h-6 text-white" />
              <h3 className="font-black text-xl text-white">
                Available Sessions
              </h3>
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1"
            >
              <Users className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">{activeGames.length}</span>
            </motion.div>
          </div>
          
          <AnimatePresence>
            {activeGames.length === 0 ? (
              <motion.div 
                className="text-center py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="text-white/50 w-8 h-8" />
                </div>
                <p className="text-white/80 font-medium mb-2">
                  No active sessions
                </p>
                <p className="text-white/60 text-sm">
                  Check back soon for new sessions
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {activeGames.map((game, index) => {
                  const statusBadge = getStatusBadge(game);
                  const isGameFinished = game.status === 'FINISHED';
                  
                  return (
                    <motion.div
                      key={game._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className={`bg-white/10 hover:bg-white/20 rounded-2xl p-4 border transition-all duration-300 backdrop-blur-sm ${
                        isGameFinished 
                          ? 'border-white/10 cursor-not-allowed' 
                          : 'border-white/10 hover:border-white/30 cursor-pointer group'
                      }`}
                      onClick={isGameFinished ? undefined : () => joinGame(game)}
                      whileHover={isGameFinished ? {} : { scale: 1.02 }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className={`font-black text-lg ${
                              isGameFinished 
                                ? 'text-white/60' 
                                : 'text-white group-hover:text-yellow-300 transition-colors'
                            }`}>
                              Session {game.code}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-black ${statusBadge.color}`}>
                              {statusBadge.text}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <div className={`flex items-center gap-1 ${
                              isGameFinished ? 'text-white/50' : 'text-white/70'
                            }`}>
                              <Users className="w-4 h-4" />
                              <span>{game.currentPlayers}/{game.maxPlayers}</span>
                            </div>
                            <span className={isGameFinished ? 'text-white/30' : 'text-white/50'}>•</span>
                            {/* <div className="flex items-center gap-2">
                              <span className={`text-sm ${
                                isGameFinished ? 'text-white/50' : 'text-white/70'
                              }`}>
                                Host: {game.host.firstName || game.host.username}
                              </span>
                              {game.host._id === currentUserId && (
                                <Crown className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              )}
                            </div> */}
                          </div>

                          {/* Game Status Message */}
                          {game.status === 'ACTIVE' && (
                            <div className="mt-2 flex items-center gap-2 text-blue-300 text-xs">
                              <Eye className="w-3 h-3" />
                              <span>Join as spectator to watch and practice</span>
                            </div>
                          )}
                          {game.status === 'FINISHED' && (
                            <div className="mt-2 text-white/50 text-xs">
                              New game starting soon...
                            </div>
                          )}
                        </div>
                        
                        <motion.div 
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg ${
                            isGameFinished
                              ? 'bg-gray-500/50 cursor-not-allowed'
                              : game.status === 'ACTIVE'
                              ? 'bg-gradient-to-br from-blue-400 to-purple-400'
                              : 'bg-gradient-to-br from-green-400 to-teal-400'
                          }`}
                          whileHover={isGameFinished ? {} : { rotate: 5, scale: 1.1 }}
                        >
                          {game.status === 'ACTIVE' ? (
                            <Eye className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                        </motion.div>
                      </div>

                      {/* Game Progress Bar */}
                      {/* {!isGameFinished && (
                        <div className="mt-3">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-white/70">Session Progress</span>
                            <span className="text-white font-bold">
                              {Math.round((game.currentPlayers / game.maxPlayers) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-1.5">
                            <motion.div 
                              className={`h-1.5 rounded-full ${
                                game.status === 'ACTIVE'
                                  ? 'bg-gradient-to-r from-blue-400 to-purple-400'
                                  : 'bg-gradient-to-r from-green-400 to-cyan-400'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${(game.currentPlayers / game.maxPlayers) * 100}%` }}
                              transition={{ duration: 1, delay: index * 0.1 + 0.5 }}
                            />
                          </div>
                        </div>
                      )} */}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Stats Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-black text-white">{activeGames.length}</div>
                <div className="text-white/60 text-xs">Total Sessions</div>
              </div>
              <div>
                {/* <div className="text-2xl font-black text-white">
                  {activeGames.reduce((sum, game) => sum + game.currentPlayers, 0)}
                </div> */}
                <div className="text-white/60 text-xs">Active Players</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">
                  {activeGames.filter(g => g.status === 'ACTIVE').length}
                </div>
                <div className="text-white/60 text-xs">Live Now</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-8 pb-8"
        >
          <p className="text-white/40 text-sm">
            Jump in anytime - play or watch!
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
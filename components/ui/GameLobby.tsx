// components/GameLobby.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Play, Copy, Share2, Crown, Zap, Sparkles, Gamepad2 } from 'lucide-react';
import { Game, GamePlayer } from '../../types';
import { useState, useEffect } from 'react';

interface GameLobbyProps {
  game: Game;
  currentUserId: string;
  onStartGame: () => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  game,
  currentUserId,
  onStartGame,
}) => {
  const [copied, setCopied] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);

  // FIXED: Move isHost function declaration to the top
  const isHost = () => {
    if (!game?.host || !currentUserId) return false;
    return game.host._id === currentUserId;
  };

  // Check if game is auto-created by system
  const isAutoCreatedGame = () => {
    return game.host?.username === 'system_bot' || game.host?.firstName === 'System';
  };

  const currentPlayersCount = game.players?.length || 0;
  const canStart = currentPlayersCount >= 2;

  // Auto-start countdown effect - FIXED: Now isHost is declared before use
  useEffect(() => {
    if (canStart && isHost() && game.status === 'WAITING') {
      setAutoStartCountdown(10); // 10 second countdown
      
      const interval = setInterval(() => {
        setAutoStartCountdown((prev) => {
          if (prev === 1) {
            clearInterval(interval);
            onStartGame(); // Auto-start the game
            return null;
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setAutoStartCountdown(null);
    }
  }, [canStart, game.status, onStartGame]); // REMOVED: isHost() from dependencies

  const copyGameCode = async () => {
    await navigator.clipboard.writeText(game.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareGame = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join My Bingo Game!',
          text: `Join my Bingo game! Code: ${game.code}. ${currentPlayersCount} players waiting!`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      copyGameCode();
    }
  };

  // Safe access to host properties
  const getHostName = () => {
    if (!game?.host) return 'System Host';
    return game.host.firstName || game.host.username || 'System Host';
  };

  // Fixed animation variants for background elements
  const getBackgroundAnimation = (index: number) => {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 100;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 100;
    
    return {
      initial: {
        x: Math.random() * windowWidth,
        y: Math.random() * windowHeight,
      },
      animate: {
        y: [0, -100, 0],
        opacity: [0.3, 0.8, 0.3],
      },
      transition: {
        duration: 4 + Math.random() * 3,
        repeat: Infinity,
        delay: Math.random() * 2,
      }
    };
  };

  // CORRECTED: Based on your types, player data is in player.user
  const getPlayerDisplayName = (player: GamePlayer) => {
    if (!player?.user) return 'Unknown Player';
    return player.user.firstName || player.user.username || 'Unknown Player';
  };

  // CORRECTED: Get player initial from user object
  const getPlayerInitial = (player: GamePlayer) => {
    if (!player?.user) return '?';
    
    const firstName = player.user.firstName;
    const username = player.user.username;
    
    if (firstName) return firstName[0].toUpperCase();
    if (username) return username[0].toUpperCase();
    
    return '?';
  };

  // CORRECTED: Get player username from user object
  const getPlayerUsername = (player: GamePlayer) => {
    if (!player?.user) return 'user';
    return player.user.username || 'user';
  };

  // CORRECTED: Check if player is host by comparing user IDs
  const isPlayerHost = (player: GamePlayer) => {
    if (!player?.user || !game?.host) return false;
    return player.user._id === game.host._id;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 bg-white/10 rounded-full"
            initial={getBackgroundAnimation(i).initial}
            animate={getBackgroundAnimation(i).animate}
            transition={getBackgroundAnimation(i).transition}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md mx-auto p-4 safe-area-padding"
      >
        {/* System Game Banner */}
        {isAutoCreatedGame() && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4"
          >
            <div className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-4 border border-green-500/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-green-400" />
                <span className="text-green-300 font-bold text-lg">Always Available Game</span>
                <Sparkles className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-green-400/80 text-sm">
                This game is automatically managed by the system. Join anytime!
              </p>
            </div>
          </motion.div>
        )}

        {/* Header Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-4 border border-white/30 shadow-2xl"
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
              <div className="flex items-center gap-2 text-white/80">
                <span>Hosted by {getHostName()}</span>
                {isAutoCreatedGame() && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full font-bold border border-green-500/30">
                    SYSTEM
                  </span>
                )}
              </div>
            </div>
            
            {/* Game Code */}
            <motion.button
              onClick={copyGameCode}
              className="flex items-center gap-2 px-4 py-3 bg-white/20 rounded-2xl hover:bg-white/30 transition-all group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-green-400"
                  >
                    ✓
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="font-mono font-black text-white text-lg">
                {game.code}
              </span>
            </motion.button>
          </div>

          {/* Game Info */}
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-white" />
              <span className="text-white font-bold">
                {currentPlayersCount}/{game.maxPlayers}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-white" />
              <span className="text-white font-bold">
                {autoStartCountdown ? `Starting in ${autoStartCountdown}s` : 'Waiting...'}
              </span>
            </div>
            <motion.button
              onClick={shareGame}
              className="flex items-center gap-2 ml-auto px-3 py-1 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              <Share2 className="w-4 h-4 text-white" />
            </motion.button>
          </div>
        </motion.div>

        {/* Players List */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-4 border border-white/30 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-xl text-white">
              Players ({currentPlayersCount})
            </h3>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1"
            >
              <Users className="w-4 h-4 text-white" />
              <span className="text-white font-bold text-sm">{currentPlayersCount}</span>
            </motion.div>
          </div>
          
          {currentPlayersCount === 0 ? (
            <motion.div 
              className="text-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Gamepad2 className="text-white/50 w-8 h-8" />
              </div>
              <p className="text-white/80 font-medium mb-2">Waiting for players...</p>
              <p className="text-white/60 text-sm">Be the first to join!</p>
            </motion.div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {game.players?.map((player: GamePlayer, index: number) => (
                <motion.div
                  key={player._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-all group"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="relative"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-black text-lg shadow-lg">
                      {getPlayerInitial(player)}
                    </div>
                    {isPlayerHost(player) && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-1 -right-1"
                      >
                        <Crown className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      </motion.div>
                    )}
                  </motion.div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-lg">
                        {getPlayerDisplayName(player)}
                      </span>
                      {isPlayerHost(player) && (
                        <span className="px-2 py-1 bg-yellow-400/20 text-yellow-300 text-xs rounded-full font-bold border border-yellow-400/30">
                          HOST
                        </span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm">
                      @{getPlayerUsername(player)}
                    </p>
                  </div>
                  
                  {player.isReady && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-3 h-3 bg-green-400 rounded-full"
                    />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Start Game Button */}
        <AnimatePresence>
          {isHost() && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.4 }}
            >
              <motion.button
                onClick={onStartGame}
                disabled={!canStart}
                className={`
                  w-full py-5 rounded-3xl font-black text-xl shadow-2xl 
                  flex items-center justify-center gap-3 relative overflow-hidden
                  ${canStart 
                    ? 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:shadow-3xl' 
                    : 'bg-white/20 text-white/60 cursor-not-allowed'
                  }
                `}
                whileHover={canStart ? { 
                  scale: 1.02,
                  y: -2
                } : {}}
                whileTap={canStart ? { scale: 0.98 } : {}}
              >
                {canStart && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                )}
                
                {canStart ? (
                  <>
                    <Zap className="w-6 h-6 fill-white" />
                    {autoStartCountdown ? `STARTING IN ${autoStartCountdown}s` : 'START GAME'}
                    <Play className="w-6 h-6" />
                  </>
                ) : (
                  <>
                    <Users className="w-6 h-6" />
                    NEED {2 - currentPlayersCount} MORE PLAYERS
                  </>
                )}
              </motion.button>

              {!canStart && (
                <motion.p 
                  className="text-center text-white/60 mt-3 text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  Invite friends to start playing!
                </motion.p>
              )}

              {/* Auto-start info */}
              {canStart && isAutoCreatedGame() && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-center mt-3"
                >
                  <p className="text-green-300 text-sm font-medium">
                    🎯 Game will start automatically when ready!
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waiting for Host Message */}
        {!isHost() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/30">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"
              />
              <h4 className="font-black text-white text-lg mb-2">
                {isAutoCreatedGame() ? 'Game Starting Soon' : 'Waiting for Host'}
              </h4>
              <p className="text-white/70">
                {isAutoCreatedGame() 
                  ? `The game will start automatically when there are at least 2 players...`
                  : `${getHostName()} will start the game when there are at least 2 players...`
                }
                <br />(Currently {currentPlayersCount} player{currentPlayersCount !== 1 ? 's' : ''})
              </p>
              
              {isAutoCreatedGame() && currentPlayersCount >= 2 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-4 p-3 bg-green-500/20 rounded-xl border border-green-500/30"
                >
                  <p className="text-green-300 text-sm font-bold">
                    ✅ Ready to start! Waiting for auto-start...
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <h5 className="text-white font-bold mb-2">🎮 Quick Tips</h5>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
              <div>• Share code to invite friends</div>
              <div>• Need 2+ players to start</div>
              <div>• Mark numbers on your card</div>
              <div>• First to complete a line wins!</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
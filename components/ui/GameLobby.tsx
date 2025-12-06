/* eslint-disable @typescript-eslint/no-explicit-any */
// components/GameLobby.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Play, Copy, Share2, Crown, Zap, Sparkles, Gamepad2, Eye, Trophy } from 'lucide-react';
import { Game, GamePlayer } from '../../types';
import { useState, useEffect, useMemo } from 'react';

interface GameLobbyProps {
  game: Game;
  currentUserId: string;
  onStartGame: () => void;
  onJoinAsSpectator?: () => void;
}

interface WinnerModalProps {
  showWinnerModal: boolean;
  winnerInfo: any;
  onClose: () => void;
}

// Helper function to generate random values outside of React component
const generateRandomBackgroundConfigs = (count: number) => {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 100;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 100;
  
  return Array.from({ length: count }, () => ({
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
  }));
};

// Helper function for confetti configs
const generateRandomConfettiConfigs = (count: number) => {
  return Array.from({ length: count }, () => ({
    initialX: Math.random() * 300 - 150,
    initialLeft: `${Math.random() * 100}%`,
    duration: 2 + Math.random() * 1,
    delay: Math.random() * 0.5,
  }));
};

// Generate configs once outside the component
const BACKGROUND_CONFIGS = generateRandomBackgroundConfigs(15);

// Moved WinnerModal component outside
const WinnerModal: React.FC<WinnerModalProps> = ({ showWinnerModal, winnerInfo, onClose }) => {
  // Generate confetti configs outside of render using a constant
  const CONFETTI_CONFIGS = useMemo(() => generateRandomConfettiConfigs(30), []);

  return (
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
              {CONFETTI_CONFIGS.map((config, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl"
                  initial={{
                    x: config.initialX,
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
                    duration: config.duration,
                    delay: config.delay,
                  }}
                  style={{
                    left: config.initialLeft,
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
                    {winnerInfo.winner.firstName || winnerInfo.winner.username}
                  </h3>
                </div>
                <p className="text-white/90 font-bold text-lg">is the Winner! 🏆</p>
              </div>

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
                onClick={onClose}
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
};

export const GameLobby: React.FC<GameLobbyProps> = ({
  game,
  currentUserId,
  onStartGame,
  onJoinAsSpectator,
}) => {
  const [copied, setCopied] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<any>(null);

  // Check if game is auto-created by system
  const isAutoCreatedGame = (): boolean => {
    return game.isAutoCreated === true;
  };

  // Check if user is already in the game
  const isUserInGame = (): boolean => {
    if (!game?.players || !currentUserId) return false;
    return game.players.some(player => player?.user?._id === currentUserId);
  };

  // Get user's role in the game
  const getUserRole = (): 'PLAYER' | 'SPECTATOR' | null => {
    if (!game?.players || !currentUserId) return null;
    const player = game.players.find(p => p?.user?._id === currentUserId);
    return player?.playerType || 'PLAYER';
  };

  const currentPlayersCount = game.players?.length || 0;
  const canStart = currentPlayersCount >= 2;
  const userRole = getUserRole();
  const userInGame = isUserInGame();

  // Check for winner when game finishes
useEffect(() => {
  if (game.status === 'FINISHED' && game.winner) {
    // Use setTimeout to defer the state updates
    const timer = setTimeout(() => {
      setWinnerInfo({
        winner: game.winner,
        gameCode: game.code,
        totalPlayers: game.currentPlayers,
        numbersCalled: game.numbersCalled?.length || 0
      });
      setShowWinnerModal(true);
    }, 0);
    
    return () => clearTimeout(timer);
  }
}, [game.status, game.winner, game.code, game.currentPlayers, game.numbersCalled]);

  // Auto-start countdown effect for system games
   useEffect(() => {
    // Only set up the interval if we have a countdown value
    if (autoStartCountdown !== null && autoStartCountdown > 0) {
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

      return () => {
        clearInterval(interval);
      };
    }
  }, [autoStartCountdown, onStartGame]);
  const copyGameCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(game.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareGame = async (): Promise<void> => {
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

  // Get player display name
  const getPlayerDisplayName = (player: GamePlayer): string => {
    if (!player?.user) return 'Unknown Player';
    return player.user.firstName || player.user.username || 'Unknown Player';
  };

  // Get player initial from user object
  const getPlayerInitial = (player: GamePlayer): string => {
    if (!player?.user) return '?';
    
    const firstName = player.user.firstName;
    const username = player.user.username;
    
    if (firstName) return firstName[0].toUpperCase();
    if (username) return username[0].toUpperCase();
    
    return '?';
  };

  // Get player username from user object
  const getPlayerUsername = (player: GamePlayer): string => {
    if (!player?.user) return 'user';
    return player.user.username || 'user';
  };

  // Get player type badge
  interface PlayerBadge {
    label: string;
    color: string;
  }

  const getPlayerTypeBadge = (player: GamePlayer): PlayerBadge => {
    if (player.playerType === 'SPECTATOR') {
      return { 
        label: 'SPECTATOR', 
        color: 'bg-blue-400/20 text-blue-300 border-blue-400/30' 
      };
    }
    return { 
      label: 'PLAYER', 
      color: 'bg-green-400/20 text-green-300 border-green-400/30' 
    };
  };

  // Handle join based on game status
  const handleJoinGame = (): void => {
    if (game.status === 'ACTIVE' && onJoinAsSpectator) {
      onJoinAsSpectator();
    } else {
      onStartGame();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
      {/* Winner Modal */}
      <WinnerModal 
        showWinnerModal={showWinnerModal}
        winnerInfo={winnerInfo}
        onClose={() => setShowWinnerModal(false)}
      />

      {/* Animated Background */}
      <div className="absolute inset-0">
        {BACKGROUND_CONFIGS.map((config, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 bg-white/10 rounded-full"
            initial={config.initial}
            animate={config.animate}
            transition={config.transition}
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

        {/* Game Status Banner */}
        {game.status === 'ACTIVE' && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4"
          >
            <div className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-4 border border-blue-500/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <span className="text-blue-300 font-bold text-lg">Game In Progress</span>
                <Eye className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-blue-400/80 text-sm">
                This game has already started. You can join as a spectator!
              </p>
            </div>
          </motion.div>
        )}

        {game.status === 'FINISHED' && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4"
          >
            <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-4 border border-red-500/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-red-400" />
                <span className="text-red-300 font-bold text-lg">Game Finished</span>
                <Trophy className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-red-400/80 text-sm">
                This game has ended. A new game will start soon!
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
                <span>System&apos;s Managed Game</span>
                {isAutoCreatedGame() && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full font-bold border border-green-500/30">
                    AUTO
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
                {game.status === 'ACTIVE' 
                  ? 'Game In Progress' 
                  : game.status === 'FINISHED'
                  ? 'Game Finished'
                  : autoStartCountdown 
                    ? `Starting in ${autoStartCountdown}s` 
                    : 'Waiting...'
                }
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

          {/* User Status */}
          {userInGame && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-white/10 rounded-xl border border-white/20"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/80">Your role:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  userRole === 'SPECTATOR' 
                    ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                    : 'bg-green-400/20 text-green-300 border border-green-400/30'
                }`}>
                  {userRole === 'SPECTATOR' ? 'SPECTATOR' : 'PLAYER'}
                </span>
              </div>
            </motion.div>
          )}
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
              Participants ({currentPlayersCount})
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
              {game.players?.map((player: GamePlayer, index: number) => {
                const badge = getPlayerTypeBadge(player);
                return (
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
                    </motion.div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-white text-lg">
                          {getPlayerDisplayName(player)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-white/60 text-sm">
                        @{getPlayerUsername(player)}
                      </p>
                    </div>
                    
                    {player.isReady && player.playerType !== 'SPECTATOR' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-3 h-3 bg-green-400 rounded-full"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <AnimatePresence>
          {/* Auto-start info for system games */}
          {isAutoCreatedGame() && game.status === 'WAITING' && (
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
                    {autoStartCountdown ? `STARTING IN ${autoStartCountdown}s` : 'JOIN GAME'}
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
              {canStart && (
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

          {/* Join/Spectate Button */}
          {game.status !== 'FINISHED' && !userInGame && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.button
                onClick={handleJoinGame}
                className={`
                  w-full py-5 rounded-3xl font-black text-xl shadow-2xl 
                  flex items-center justify-center gap-3 relative overflow-hidden
                  ${game.status === 'ACTIVE'
                    ? 'bg-gradient-to-r from-blue-400 to-purple-400 text-white hover:shadow-3xl'
                    : 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:shadow-3xl'
                  }
                `}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                
                {game.status === 'ACTIVE' ? (
                  <>
                    <Eye className="w-6 h-6" />
                    JOIN AS SPECTATOR
                    <Play className="w-6 h-6" />
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6" />
                    JOIN GAME
                    <Play className="w-6 h-6" />
                  </>
                )}
              </motion.button>

              {game.status === 'ACTIVE' && (
                <motion.p 
                  className="text-center text-white/60 mt-3 text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  Watch the game in progress and practice marking numbers!
                </motion.p>
              )}
            </motion.div>
          )}

          {/* User Already in Game Message */}
          {userInGame && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/30">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Users className="w-6 h-6 text-green-400" />
                </motion.div>
                <h4 className="font-black text-white text-lg mb-2">
                  You&apos;re in this game!
                </h4>
                <p className="text-white/70">
                  {userRole === 'SPECTATOR' 
                    ? 'You are watching this game as a spectator.'
                    : 'You are playing in this game.'
                  }
                  <br />Waiting for the game to continue...
                </p>
              </div>
            </motion.div>
          )}

          {/* Game Finished Message */}
          {game.status === 'FINISHED' && !userInGame && (
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
                  Game Finished
                </h4>
                <p className="text-white/70">
                  This game has ended. A new game will start automatically soon!
                  <br />Check back in a moment to join the next game.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            {game.status === 'ACTIVE' && (
              <div className="mt-2 text-blue-300 text-xs">
                • Spectators can practice but can&apos;t win
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
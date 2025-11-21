'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '../hooks/useTelegram'
import { authAPI, gameAPI } from '../services/api'
import { Game, User } from '../types'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, 
  Users, 
  Play, 
  Zap, 
  Crown, 
  Sparkles,
  TrendingUp,
  Gamepad2,
  Clock,
  Eye
} from 'lucide-react'

// Animation variants
const backgroundVariants = {
  animate: (i: number) => ({
    y: [0, -100, 0],
    opacity: [0.2, 0.8, 0.2],
    transition: {
      duration: 3 + Math.random() * 2,
      repeat: Infinity,
      delay: Math.random() * 2,
    }
  })
}

const confettiVariants = {
  animate: (i: number) => ({
    y: (typeof window !== 'undefined' ? window.innerHeight : 500) + 100,
    rotate: 360,
    transition: {
      duration: 2 + Math.random() * 2,
      ease: "easeOut",
    }
  }),
  initial: {
    y: -50,
    rotate: 0,
  },
  exit: {
    opacity: 0
  }
}

export default function Home() {
  const { user, isReady, WebApp, initData } = useTelegram()
  const router = useRouter()
  const [mainGame, setMainGame] = useState<Game | null>(null)
  const [userStats, setUserStats] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [authAttempted, setAuthAttempted] = useState(false)
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (isReady && user && !authAttempted) {
      initializeUser()
      loadMainGame()
    }
  }, [isReady, user, authAttempted])

  // Auto-start countdown for system games
  useEffect(() => {
    if (mainGame?.status === 'WAITING' && 
        mainGame.currentPlayers >= 2 && 
        isSystemGame(mainGame)) {
      setAutoStartCountdown(10)
      
      const interval = setInterval(() => {
        setAutoStartCountdown((prev) => {
          if (prev === 1) {
            clearInterval(interval)
            // The game will auto-start on the server side
            loadMainGame() // Reload to get updated status
            return null
          }
          return prev ? prev - 1 : null
        })
      }, 1000)

      return () => clearInterval(interval)
    } else {
      setAutoStartCountdown(null)
    }
  }, [mainGame?.status, mainGame?.currentPlayers, mainGame])

  const initializeUser = async () => {
    try {
      setAuthAttempted(true)
      
      const response = await authAPI.telegramLogin(initData || 'development')
      const { token, user: userData } = response.data
      
      localStorage.setItem('bingo_token', token)
      localStorage.setItem('user_id', userData.id)
      setUserStats(userData)

      if (userData.gamesWon > 0) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
      }

      console.log('User authenticated successfully')
    } catch (error) {
      console.error('Authentication failed:', error)
      const fallbackUser = {
        _id: 'fallback',
        id: 'fallback',
        telegramId: user?.id?.toString() || 'fallback',
        firstName: user?.first_name || 'Guest',
        username: user?.username || 'guest',
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        createdAt: new Date().toISOString()
      }
      setUserStats(fallbackUser as User)
    }
  }

  const loadMainGame = async () => {
    try {
      const response = await gameAPI.getActiveGames()
      const games = response.data.games || []
      // Since we have a single game system, take the first game
      setMainGame(games[0] || null)
    } catch (error) {
      console.error('Failed to load main game:', error)
      setMainGame(null)
    } finally {
      setIsLoading(false)
    }
  }

  const joinGame = async () => {
    if (!mainGame) return
    
    const userId = localStorage.getItem('user_id')
    if (!userId) return
    
    try {
      await gameAPI.joinGame(mainGame.code, userId)
      router.push(`/game/${mainGame._id}`)
    } catch (error) {
      console.error('Failed to join game:', error)
      // Reload game data if join fails
      loadMainGame()
    }
  }

  const isSystemGame = (game: Game): boolean => {
    return game.host?.username === 'system_bot' || 
           game.host?.firstName === 'System' || 
           game.isAutoCreated === true
  }

  const isUserInGame = (): boolean => {
    if (!mainGame?.players || !userStats) return false
    return mainGame.players.some(player => player.user._id === userStats._id)
  }

  const getUserRole = (): 'PLAYER' | 'SPECTATOR' | null => {
    if (!mainGame?.players || !userStats) return null
    const player = mainGame.players.find(p => p.user._id === userStats._id)
    return player?.playerType || 'PLAYER'
  }

  const displayUser = userStats || (user ? {
    _id: 'pending',
    id: 'pending', 
    telegramId: user.id.toString(),
    firstName: user.first_name,
    username: user.username,
    gamesPlayed: 0,
    gamesWon: 0,
    totalScore: 0,
    createdAt: new Date().toISOString()
  } as User : null)

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
            {initData === 'development' ? 'Development Mode' : 'Loading Bingo...'}
          </motion.p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-20"
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

      {/* Confetti Effect */}
      <AnimatePresence>
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                initial={{
                  x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 100),
                  ...confettiVariants.initial
                }}
                variants={confettiVariants}
                animate="animate"
                exit="exit"
                custom={i}
                style={{
                  left: `${Math.random() * 100}%`,
                }}
              >
                🎉
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Development Mode Banner */}
      {initData === 'development' && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-4 left-4 right-4 z-20"
        >
          <div className="bg-yellow-500/90 backdrop-blur-lg text-yellow-900 rounded-2xl p-3 text-center border border-yellow-600/30">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-bold text-sm">Development Mode</span>
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </motion.div>
      )}

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
            🎯
          </motion.div>
          <h1 className="text-5xl font-black text-white mb-3 drop-shadow-lg">
            BINGO
          </h1>
          <p className="text-white/80 text-lg font-medium">Always Ready • Always Fun</p>
        </motion.div>

        {/* System Game Banner */}
        {mainGame && isSystemGame(mainGame) && (
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
        {mainGame?.status === 'ACTIVE' && (
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
                Jump in and play! You can join as a player or spectator.
              </p>
            </div>
          </motion.div>
        )}

        {/* User Stats Card */}
        {displayUser && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/30 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="relative"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                  {displayUser.firstName?.[0]?.toUpperCase() || displayUser.username?.[0]?.toUpperCase() || '?'}
                </div>
                {displayUser.gamesWon > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-2 -right-2"
                  >
                    <Crown className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                  </motion.div>
                )}
              </motion.div>
              
              <div className="flex-1">
                <h3 className="font-black text-xl text-white">
                  {displayUser.firstName || displayUser.username}
                </h3>
                <p className="text-white/70">@{displayUser.username}</p>
                <motion.div 
                  className="flex items-center gap-1 mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 text-sm font-bold">
                    Level {Math.floor((displayUser.totalScore || 0) / 100) + 1}
                  </span>
                </motion.div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <motion.div 
                className="bg-white/20 rounded-2xl p-3 text-center backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="text-2xl font-black text-white">
                  {displayUser.gamesPlayed || 0}
                </div>
                <div className="text-white/70 text-xs font-medium">Played</div>
              </motion.div>
              
              <motion.div 
                className="bg-white/20 rounded-2xl p-3 text-center backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="text-2xl font-black text-white flex items-center justify-center gap-1">
                  {displayUser.gamesWon || 0}
                  {displayUser.gamesWon > 0 && <Trophy className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                </div>
                <div className="text-white/70 text-xs font-medium">Wins</div>
              </motion.div>
              
              <motion.div 
                className="bg-white/20 rounded-2xl p-3 text-center backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="text-2xl font-black text-white">
                  {displayUser.totalScore || 0}
                </div>
                <div className="text-white/70 text-xs font-medium">Score</div>
              </motion.div>
            </div>

            {/* Win Rate */}
            {(displayUser.gamesPlayed || 0) > 0 && (
              <motion.div 
                className="mt-4 bg-white/10 rounded-xl p-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-white/80 font-medium">Win Rate</span>
                  <span className="text-white font-bold">
                    {(((displayUser.gamesWon || 0) / (displayUser.gamesPlayed || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <motion.div 
                    className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((displayUser.gamesWon || 0) / (displayUser.gamesPlayed || 1)) * 100}%` }}
                    transition={{ duration: 1.5, delay: 1 }}
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Main Play Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <motion.button
            onClick={joinGame}
            disabled={!mainGame || mainGame.status === 'FINISHED'}
            className={`w-full py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 group relative overflow-hidden ${
              mainGame && mainGame.status !== 'FINISHED'
                ? mainGame.status === 'ACTIVE'
                  ? 'bg-gradient-to-r from-blue-400 to-purple-400 text-white hover:shadow-3xl'
                  : 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:shadow-3xl'
                : 'bg-white/20 text-white/60 cursor-not-allowed'
            }`}
            whileHover={mainGame && mainGame.status !== 'FINISHED' ? { 
              scale: 1.02,
              y: -2
            } : {}}
            whileTap={mainGame && mainGame.status !== 'FINISHED' ? { scale: 0.98 } : {}}
          >
            {mainGame && mainGame.status !== 'FINISHED' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            )}
            
            {!mainGame ? (
              <>
                <Clock className="w-6 h-6" />
                LOADING GAME...
              </>
            ) : mainGame.status === 'FINISHED' ? (
              <>
                <Trophy className="w-6 h-6" />
                GAME FINISHED
              </>
            ) : mainGame.status === 'ACTIVE' ? (
              <>
                <Eye className="w-6 h-6" />
                {isUserInGame() ? 'REJOIN GAME' : 'JOIN GAME'}
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold"
                >
                  {mainGame.currentPlayers} playing
                </motion.div>
              </>
            ) : (
              <>
                <Play className="w-6 h-6" />
                {autoStartCountdown ? `STARTING IN ${autoStartCountdown}s` : 'PLAY NOW'}
                {mainGame.currentPlayers >= 2 && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold"
                  >
                    {mainGame.currentPlayers} ready
                  </motion.div>
                )}
              </>
            )}
          </motion.button>
          
          {!mainGame && (
            <motion.p 
              className="text-center text-white/60 mt-3 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Preparing your game experience...
            </motion.p>
          )}

          {mainGame?.status === 'WAITING' && mainGame.currentPlayers < 2 && (
            <motion.p 
              className="text-center text-white/60 mt-3 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Need {2 - mainGame.currentPlayers} more players to start
            </motion.p>
          )}

          {mainGame?.status === 'ACTIVE' && (
            <motion.p 
              className="text-center text-white/60 mt-3 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Game in progress - {mainGame.numbersCalled?.length || 0} numbers called
            </motion.p>
          )}
        </motion.div>

        {/* Current Game Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-6 h-6 text-white" />
              <h3 className="font-black text-xl text-white">Current Session</h3>
            </div>
            {mainGame && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1"
              >
                <Users className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-bold">{mainGame.currentPlayers}</span>
              </motion.div>
            )}
          </div>
          
          {!mainGame ? (
            <motion.div 
              className="text-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="text-white/50 w-8 h-8" />
              </div>
              <p className="text-white/80 font-medium mb-2">Game session loading</p>
              <p className="text-white/60 text-sm">Ready in a moment...</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* Game Status Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/10 hover:bg-white/20 rounded-2xl p-4 border border-white/10 hover:border-white/30 transition-all duration-300 backdrop-blur-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-black text-white">
                        Game {mainGame.code}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-black ${
                        mainGame.status === 'ACTIVE' 
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : mainGame.status === 'FINISHED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      }`}>
                        {mainGame.status === 'ACTIVE' ? 'LIVE' : 
                         mainGame.status === 'FINISHED' ? 'FINISHED' : 'WAITING'}
                      </span>
                      {isSystemGame(mainGame) && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full font-bold border border-green-500/30">
                          SYSTEM
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-white/70">
                        <Users className="w-4 h-4" />
                        <span>{mainGame.currentPlayers} players</span>
                      </div>
                      <span className="text-white/50">•</span>
                      <div className="flex items-center gap-1 text-white/70">
                        <Clock className="w-4 h-4" />
                        <span>
                          {mainGame.status === 'ACTIVE' 
                            ? `${mainGame.numbersCalled?.length || 0} numbers called`
                            : mainGame.status === 'FINISHED'
                            ? 'Game completed'
                            : 'Waiting for players'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Game Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-white/70">Session Progress</span>
                    <span className="text-white font-bold">
                      {mainGame.status === 'ACTIVE' 
                        ? `${mainGame.numbersCalled?.length || 0}/75 numbers`
                        : `${Math.round((mainGame.currentPlayers / mainGame.maxPlayers) * 100)}%`
                      }
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-1.5">
                    <motion.div 
                      className={`h-1.5 rounded-full ${
                        mainGame.status === 'ACTIVE'
                          ? 'bg-gradient-to-r from-blue-400 to-purple-400'
                          : 'bg-gradient-to-r from-green-400 to-cyan-400'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ 
                        width: mainGame.status === 'ACTIVE'
                          ? `${((mainGame.numbersCalled?.length || 0) / 75) * 100}%`
                          : `${(mainGame.currentPlayers / mainGame.maxPlayers) * 100}%`
                      }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                </div>
              </motion.div>

              {/* User Status in Game */}
              {isUserInGame() && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-white/10 rounded-xl border border-white/20"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/80">Your status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      getUserRole() === 'SPECTATOR' 
                        ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                        : 'bg-green-400/20 text-green-300 border border-green-400/30'
                    }`}>
                      {getUserRole() === 'SPECTATOR' ? 'SPECTATOR' : 'PLAYER'}
                    </span>
                    <span className="text-white/60 text-xs">
                      • Click above to rejoin
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-black text-white">
                  {mainGame ? 1 : 0}
                </div>
                <div className="text-white/60 text-xs">Active Session</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">
                  {mainGame?.currentPlayers || 0}
                </div>
                <div className="text-white/60 text-xs">Players Online</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">
                  {mainGame?.status === 'ACTIVE' ? 1 : 0}
                </div>
                <div className="text-white/60 text-xs">Live Game</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-6"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <h5 className="text-white font-bold mb-2">🎮 Quick Tips</h5>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
              <div>• Always one game available</div>
              <div>• Need 2+ players to start</div>
              <div>• Mark numbers on your card</div>
              <div>• First to complete a line wins!</div>
            </div>
            {mainGame?.status === 'ACTIVE' && (
              <div className="mt-2 text-blue-300 text-xs">
                • Join anytime - spectators welcome!
              </div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center mt-8 pb-8"
        >
          <p className="text-white/40 text-sm">
            Jump in and play anytime!
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
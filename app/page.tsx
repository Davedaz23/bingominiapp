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
  Gamepad2
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
  const [activeGames, setActiveGames] = useState<Game[]>([])
  const [userStats, setUserStats] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [authAttempted, setAuthAttempted] = useState(false)

  useEffect(() => {
    if (isReady && user && !authAttempted) {
      initializeUser()
      loadActiveGames()
    }
  }, [isReady, user, authAttempted])

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

  const loadActiveGames = async () => {
    try {
      const response = await gameAPI.getActiveGames()
      setActiveGames(response.data.games || [])
    } catch (error) {
      console.error('Failed to load games:', error)
      setActiveGames([])
    } finally {
      setIsLoading(false)
    }
  }

  const joinFirstGame = async () => {
    if (activeGames.length > 0) {
      const firstGame = activeGames[0]
      const userId = localStorage.getItem('user_id')
      if (!userId) return
      
      try {
        await gameAPI.joinGame(firstGame.code, userId)
        router.push(`/game/${firstGame._id}`)
      } catch (error) {
        console.error('Failed to join game:', error)
      }
    }
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
            onClick={joinFirstGame}
            disabled={activeGames.length === 0}
            className={`w-full py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 group relative overflow-hidden ${
              activeGames.length > 0 
                ? 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:shadow-3xl' 
                : 'bg-white/20 text-white/60 cursor-not-allowed'
            }`}
            whileHover={activeGames.length > 0 ? { 
              scale: 1.02,
              y: -2
            } : {}}
            whileTap={activeGames.length > 0 ? { scale: 0.98 } : {}}
          >
            {activeGames.length > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            )}
            
            <Play className="w-6 h-6" />
            {activeGames.length > 0 ? 'PLAY NOW' : 'LOADING GAME...'}
            
            {activeGames.length > 0 && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold"
              >
                {activeGames[0].currentPlayers} playing
              </motion.div>
            )}
          </motion.button>
          
          {activeGames.length === 0 && (
            <motion.p 
              className="text-center text-white/60 mt-3 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Preparing your game experience...
            </motion.p>
          )}
        </motion.div>

        {/* Active Games Section */}
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
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1"
            >
              <Users className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">{activeGames.length}</span>
            </motion.div>
          </div>
          
          {activeGames.length === 0 ? (
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
            <div className="space-y-3">
              {activeGames.map((game, index) => (
                <motion.div
                  key={game._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/10 hover:bg-white/20 rounded-2xl p-4 border border-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
                  onClick={joinFirstGame}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-black text-white group-hover:text-yellow-300 transition-colors">
                          Game {game.code}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-black ${
                          game.status === 'ACTIVE' 
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}>
                          {game.status === 'ACTIVE' ? 'LIVE' : 'WAITING'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-white/70">
                          <Users className="w-4 h-4" />
                          <span>{game.currentPlayers} players online</span>
                        </div>
                        <span className="text-white/50">•</span>
                        <span className="text-white/70 text-sm">
                          Click to join instantly
                        </span>
                      </div>
                    </div>
                    
                    <motion.div 
                      className="w-12 h-12 bg-gradient-to-br from-green-400 to-teal-400 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg"
                      whileHover={{ rotate: 5, scale: 1.1 }}
                    >
                      <Play className="w-5 h-5" />
                    </motion.div>
                  </div>

                  {/* Game Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-white/70">Session Progress</span>
                      <span className="text-white font-bold">
                        {Math.round((game.currentPlayers / game.maxPlayers) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-1.5">
                      <motion.div 
                        className="bg-gradient-to-r from-green-400 to-cyan-400 h-1.5 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(game.currentPlayers / game.maxPlayers) * 100}%` }}
                        transition={{ duration: 1, delay: index * 0.1 + 0.5 }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
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
                <div className="text-white/60 text-xs">Active Sessions</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">
                  {activeGames.reduce((sum, game) => sum + game.currentPlayers, 0)}
                </div>
                <div className="text-white/60 text-xs">Players Online</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">
                  {activeGames.filter(g => g.status === 'ACTIVE').length}
                </div>
                <div className="text-white/60 text-xs">Live Games</div>
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
            Jump in and play anytime!
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
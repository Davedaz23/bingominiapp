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
  Plus, 
  Search, 
  Zap, 
  Crown, 
  Sparkles,
  TrendingUp,
  Gamepad2
} from 'lucide-react'

// Define animation variants for better TypeScript support
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
  const { user, isReady, WebApp } = useTelegram()
  const router = useRouter()
  const [activeGames, setActiveGames] = useState<Game[]>([])
  const [userStats, setUserStats] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (isReady && user) {
      initializeUser()
      loadActiveGames()
    }
  }, [isReady, user])

  const initializeUser = async () => {
    try {
      const initData = WebApp?.initData || 'development'
      const response = await authAPI.telegramLogin(initData)
      const { token, user: userData } = response.data
      
      localStorage.setItem('bingo_token', token)
      localStorage.setItem('user_id', userData.id)
      setUserStats(userData)

      // Show confetti for new users or high achievers
      if (userData.gamesWon > 0) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
      }
    } catch (error) {
      console.error('Authentication failed:', error)
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

  const createGame = async () => {
    try {
      const userId = localStorage.getItem('user_id')
      if (!userId) return
      
      const response = await gameAPI.createGame(userId, 10, false)
      router.push(`/game/${response.data.game._id}`)
    } catch (error) {
      console.error('Failed to create game:', error)
    }
  }

  const joinRandomGame = async () => {
    if (activeGames.length > 0) {
      const randomGame = activeGames[Math.floor(Math.random() * activeGames.length)]
      const userId = localStorage.getItem('user_id')
      if (!userId) return
      
      try {
        await gameAPI.joinGame(randomGame.code, userId)
        router.push(`/game/${randomGame._id}`)
      } catch (error) {
        console.error('Failed to join game:', error)
      }
    }
  }

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
            Loading Bingo Magic...
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
          <p className="text-white/80 text-lg font-medium">Play • Win • Repeat</p>
        </motion.div>

        {/* User Stats Card */}
        {userStats && (
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
                  {userStats.firstName?.[0]?.toUpperCase() || userStats.username?.[0]?.toUpperCase() || '?'}
                </div>
                {userStats.gamesWon > 0 && (
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
                  {userStats.firstName || userStats.username}
                </h3>
                <p className="text-white/70">@{userStats.username}</p>
                <motion.div 
                  className="flex items-center gap-1 mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 text-sm font-bold">
                    Level {Math.floor(userStats.totalScore / 100) + 1}
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
                  {userStats.gamesPlayed}
                </div>
                <div className="text-white/70 text-xs font-medium">Played</div>
              </motion.div>
              
              <motion.div 
                className="bg-white/20 rounded-2xl p-3 text-center backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="text-2xl font-black text-white flex items-center justify-center gap-1">
                  {userStats.gamesWon}
                  {userStats.gamesWon > 0 && <Trophy className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                </div>
                <div className="text-white/70 text-xs font-medium">Wins</div>
              </motion.div>
              
              <motion.div 
                className="bg-white/20 rounded-2xl p-3 text-center backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="text-2xl font-black text-white">
                  {userStats.totalScore}
                </div>
                <div className="text-white/70 text-xs font-medium">Score</div>
              </motion.div>
            </div>

            {/* Win Rate */}
            {userStats.gamesPlayed > 0 && (
              <motion.div 
                className="mt-4 bg-white/10 rounded-xl p-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-white/80 font-medium">Win Rate</span>
                  <span className="text-white font-bold">
                    {((userStats.gamesWon / userStats.gamesPlayed) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <motion.div 
                    className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(userStats.gamesWon / userStats.gamesPlayed) * 100}%` }}
                    transition={{ duration: 1.5, delay: 1 }}
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <motion.button
            onClick={createGame}
            className="bg-white text-purple-600 py-4 rounded-2xl font-black text-lg shadow-2xl flex items-center justify-center gap-3 group relative overflow-hidden"
            whileHover={{ 
              scale: 1.05,
              y: -2
            }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Plus className="w-6 h-6" />
            Create
          </motion.button>
          
          <motion.button
            onClick={() => router.push('/games')}
            className="bg-black/30 backdrop-blur-lg text-white py-4 rounded-2xl font-black text-lg border border-white/20 shadow-2xl flex items-center justify-center gap-3 hover:bg-black/40 transition-all"
            whileHover={{ 
              scale: 1.05,
              y: -2
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Search className="w-6 h-6" />
            Join
          </motion.button>
        </motion.div>

        {/* Quick Play Button */}
        {activeGames.length > 0 && (
          <motion.button
            onClick={joinRandomGame}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-4 rounded-2xl font-black text-lg shadow-2xl mb-6 flex items-center justify-center gap-3 group relative overflow-hidden"
            whileHover={{ 
              scale: 1.02,
              y: -2
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Zap className="w-6 h-6 fill-white" />
            Quick Play
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="px-2 py-1 bg-white/20 rounded-full text-xs"
            >
              {activeGames.length} active
            </motion.div>
          </motion.button>
        )}

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
              <h3 className="font-black text-xl text-white">Active Games</h3>
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
              <p className="text-white/80 font-medium mb-2">No active games yet</p>
              <p className="text-white/60 text-sm">Be the first to create a game!</p>
            </motion.div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {activeGames.map((game, index) => (
                <motion.div
                  key={game._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/10 hover:bg-white/20 rounded-2xl p-4 border border-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
                  onClick={() => router.push(`/game/${game._id}`)}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-black text-white group-hover:text-yellow-300 transition-colors">
                          {game.code}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-black ${
                          game.status === 'ACTIVE' 
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}>
                          {game.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-white/70">
                          <Users className="w-4 h-4" />
                          <span>{game.currentPlayers}/{game.maxPlayers}</span>
                        </div>
                        <span className="text-white/50">•</span>
                        <span className="text-white/70 text-sm">
                          Host: {game.host.firstName}
                        </span>
                      </div>
                    </div>
                    
                    <motion.div 
                      className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg"
                      whileHover={{ rotate: 5, scale: 1.1 }}
                    >
                      {game.currentPlayers}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-8 pb-8"
        >
          <p className="text-white/40 text-sm">
            Made with ❤️ for Bingo lovers
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
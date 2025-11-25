'use client'

import { useEffect, useState } from 'react'
import { useTelegram, useTelegramMainButton } from '../hooks/useTelegram'
import { authAPI, gameAPI, walletAPI } from '../services/api'
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
  Eye,
  Wallet,
  CreditCard,
  RotateCcw
} from 'lucide-react'

// Import game components
import { BingoCard } from '../components/ui/BingoCard'
import { NumberGrid } from '../components/ui/NumberGrid'
import { useGame } from '../hooks/useGame'

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

export default function Home() {
  const { user, isReady, WebApp, initData, theme } = useTelegram()
  const { 
    updateButton, 
    setButtonText, 
    showButton, 
    hideButton,
    onButtonClick 
  } = useTelegramMainButton(WebApp)
  
  const [mainGame, setMainGame] = useState<Game | null>(null)
  const [userStats, setUserStats] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [authAttempted, setAuthAttempted] = useState(false)
  
  // Game state
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)
  const [gameView, setGameView] = useState<'lobby' | 'game'>('lobby')
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [isBalanceLoading, setIsBalanceLoading] = useState(true)

  // Use game hook when in game view
  const gameHook = useGame(currentGameId || '')

  // Initialize Telegram integration
  useEffect(() => {
    if (isReady && WebApp) {
      console.log('🚀 Telegram WebApp ready, initializing...')
      
      // Expand the WebApp to full height
      WebApp.expand()
      
      // Setup Main Button
      setButtonText('🎮 PLAY GAME - 10 ብር')
      updateButton({
        color: theme.button_color || '#3390ec',
        textColor: theme.button_text_color || '#ffffff',
        isVisible: true,
        isActive: true
      })
      
      // Setup Back Button behavior
      WebApp.BackButton.onClick(() => {
        if (gameView === 'game') {
          handleBackToLobby()
        }
      })
    }
  }, [isReady, WebApp, theme])

  // Update Telegram UI based on game state
  useEffect(() => {
    if (!WebApp || !isReady) return

    if (gameView === 'game') {
      // In game view - show Refresh button and Back button
      setButtonText('🔄 REFRESH GAME')
      WebApp.BackButton.show()
    } else {
      // In lobby view - show Play button and hide Back button
      setButtonText('🎮 PLAY GAME - 10 ብር')
      WebApp.BackButton.hide()
    }
  }, [WebApp, isReady, gameView])

  // Setup Main Button click handler
  useEffect(() => {
    if (!WebApp || !isReady) return

    const handleMainButtonClick = () => {
      if (gameView === 'game') {
        handleRefreshGame()
      } else {
        handlePlayGame()
      }
    }

    onButtonClick(handleMainButtonClick)

    // Cleanup
    return () => {
      if (WebApp) {
        WebApp.MainButton.offClick(handleMainButtonClick)
      }
    }
  }, [WebApp, isReady, gameView, mainGame, walletBalance])

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    try {
      setIsBalanceLoading(true)
      const userId = localStorage.getItem('user_id')
      if (!userId) return 0

      const response = await walletAPI.getBalance(userId)
      const data = response.data
      if (data.success) {
        setWalletBalance(data.balance)
        return data.balance
      }
      return 0
    } catch (error) {
      console.error('Error fetching wallet balance:', error)
      return 0
    } finally {
      setIsBalanceLoading(false)
    }
  }

  // Initialize user when Telegram is ready
  useEffect(() => {
    if (isReady && user && !authAttempted) {
      initializeUser()
    }
  }, [isReady, user, authAttempted])

  const initializeUser = async () => {
    try {
      setAuthAttempted(true)
      setIsLoading(true)

      console.log('🔐 Authenticating user with Telegram...', {
        userId: user?.id,
        initData: initData ? 'PRESENT' : 'MISSING'
      })

      const response = await authAPI.telegramLogin(initData || 'development')
      const { token, user: userData } = response.data

      localStorage.setItem('bingo_token', token)
      localStorage.setItem('user_id', userData.id)
      setUserStats(userData)

      if (userData.gamesWon > 0) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
      }

      console.log('✅ User authenticated successfully')
      
      await fetchWalletBalance()
      await loadMainGame()
      
    } catch (error) {
      console.error('Authentication failed:', error)
      
      // Create fallback user from Telegram data
      const fallbackUser: User = {
        _id: user?.id?.toString() || 'fallback',
        id: user?.id?.toString() || 'fallback',
        telegramId: user?.id?.toString() || 'fallback',
        firstName: user?.first_name || 'Telegram User',
        username: user?.username || 'telegram_user',
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        createdAt: new Date().toISOString()
      }
      setUserStats(fallbackUser)
      
      await fetchWalletBalance()
      await loadMainGame()
    } finally {
      setIsLoading(false)
    }
  }

  const loadMainGame = async () => {
    try {
      console.log('🎮 Loading main game...')
      const response = await gameAPI.getActiveGames()
      const games = response.data.games || []
      const activeGame = games[0] || null
      setMainGame(activeGame)
      
      // Auto-join if user is already in the game
      if (activeGame) {
        const userId = localStorage.getItem('user_id')
        const isUserInGame = activeGame.players?.some(player => 
          player?.user?._id === userId || player?.userId === userId
        )
        
        if (isUserInGame) {
          console.log('✅ User already in game, switching to game view')
          setCurrentGameId(activeGame._id)
          setGameView('game')
        }
      }
    } catch (error) {
      console.error('Failed to load main game:', error)
      setMainGame(null)
    }
  }

  const handlePlayGame = async () => {
    if (!mainGame) {
      console.log('❌ No main game available')
      return
    }

    const userId = localStorage.getItem('user_id')
    if (!userId) {
      console.log('❌ No user ID found')
      return
    }

    try {
      // Check balance first
      const entryFee = 10

      if (walletBalance < entryFee) {
        console.log('💰 Insufficient balance, showing deposit modal')
        setShowDepositModal(true)
        return
      }

      console.log(`🎮 Joining game with wallet balance: ${walletBalance} ብር`)

      // Show loading state on button
      if (WebApp) {
        WebApp.MainButton.showProgress()
      }

      // Join the game
      const response = await gameAPI.joinGame(mainGame.code, userId)

      if (response.data.success) {
        console.log('✅ Successfully joined game, switching to game view...')
        setCurrentGameId(mainGame._id)
        setGameView('game')
        
        // Refresh game data
        gameHook.refreshGame()
      } else {
        throw new Error('Failed to join game')
      }
    } catch (error: any) {
      console.error('Failed to join game:', error)

      if (error.response?.data?.error?.includes('already in this game')) {
        // User is already in the game, just switch to game view
        console.log('ℹ️ User already in game, switching view')
        setCurrentGameId(mainGame._id)
        setGameView('game')
        gameHook.refreshGame()
        return
      }

      // Reload game data
      loadMainGame()
    } finally {
      // Hide loading state
      if (WebApp) {
        WebApp.MainButton.hideProgress()
      }
    }
  }

  const handleRefreshGame = () => {
    console.log('🔄 Refreshing game...')
    if (gameView === 'game') {
      gameHook.refreshGame()
    } else {
      loadMainGame()
    }
  }

  const handleBackToLobby = () => {
    console.log('↩️ Returning to lobby')
    setGameView('lobby')
    setCurrentGameId(null)
  }

  // const openDeposit = () => {
  //   if (WebApp) {
  //     WebApp.openTelegramLink('https://t.me/your_bot?start=deposit')
  //   }
  // }

  // Apply Telegram theme to document
  useEffect(() => {
    if (theme.bg_color) {
      document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color)
    }
    if (theme.text_color) {
      document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color)
    }
  }, [theme])

  // Game View Component
  const GameView = () => {
    if (!currentGameId || !gameHook.game) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 border-4 border-white border-t-transparent rounded-full mx-auto mb-6"
            />
            <p className="text-white text-xl font-bold">Loading Game...</p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 relative overflow-hidden">
        <div className="relative z-10 max-w-md mx-auto p-4 safe-area-padding">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pt-4">
            <div className="text-white">
              <div className="text-sm opacity-80">Playing as</div>
              <div className="font-bold">{userStats?.firstName || 'Player'}</div>
            </div>

            <button
              onClick={handleRefreshGame}
              className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30 hover:bg-white/30 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="font-bold">Refresh</span>
            </button>
          </div>

          {/* Game Header */}
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/30">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-black text-white mb-2">Game {gameHook.game.code}</h1>
                <div className="flex items-center gap-3 text-white/80 text-sm">
                  <span>{gameHook.game.players?.length || 0} players</span>
                  <span>•</span>
                  <span>{gameHook.gameState.calledNumbers.length} numbers called</span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-2xl font-black text-sm ${
                gameHook.game.status === 'ACTIVE' 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : gameHook.game.status === 'FINISHED'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {gameHook.game.status === 'ACTIVE' ? 'LIVE' : 
                 gameHook.game.status === 'FINISHED' ? 'FINISHED' : 
                 'WAITING'}
              </div>
            </div>
          </div>

          {/* Current Number */}
          {gameHook.gameState.currentNumber && gameHook.game.status === 'ACTIVE' && (
            <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 text-center mb-6 border border-white/30">
              <div className="text-white/80 text-lg font-bold mb-3">Current Number</div>
              <div className="text-8xl font-black text-white">{gameHook.gameState.currentNumber}</div>
            </div>
          )}

          {/* Game Content */}
          <div className="space-y-6">
            {gameHook.bingoCard && (
              <BingoCard
                card={gameHook.bingoCard}
                calledNumbers={gameHook.gameState.calledNumbers}
                onMarkNumber={gameHook.markNumber}
                isInteractive={gameHook.game.status === 'ACTIVE'}
                isWinner={gameHook.bingoCard.isWinner}
              />
            )}

            <NumberGrid
              calledNumbers={gameHook.gameState.calledNumbers}
              currentNumber={gameHook.gameState.currentNumber}
            />
          </div>

          {/* Stats Footer */}
          <div className="text-center mt-8 pb-20"> {/* Extra padding for Telegram button */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-black text-white">{gameHook.gameState.calledNumbers.length}</div>
                  <div className="text-white/60 text-xs">Numbers Called</div>
                </div>
                <div>
                  <div className="text-xl font-black text-white">
                    {gameHook.bingoCard?.markedPositions?.length || 0}
                  </div>
                  <div className="text-white/60 text-xs">Marked</div>
                </div>
                <div>
                  <div className="text-xl font-black text-white">
                    {Math.round(((gameHook.bingoCard?.markedPositions?.length || 0) / 25) * 100)}%
                  </div>
                  <div className="text-white/60 text-xs">Progress</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Lobby View Component
  const LobbyView = () => (
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
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center">
                    <div className="text-2xl font-black text-white">{userStats.gamesPlayed || 0}</div>
                    <div className="text-white/70 text-xs font-medium">Played</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-white flex items-center justify-center gap-1">
                      {userStats.gamesWon || 0}
                      {userStats.gamesWon > 0 && <Trophy className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                    </div>
                    <div className="text-white/70 text-xs font-medium">Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-white">{userStats.totalScore || 0}</div>
                    <div className="text-white/70 text-xs font-medium">Score</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Wallet Card */}
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-green-500/30 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Wallet className="w-12 h-12 text-green-400" />
              <div>
                <h3 className="font-black text-xl text-white">Wallet Balance</h3>
                <div className="text-3xl font-black mt-1 text-green-400">
                  {isBalanceLoading ? '...' : `${walletBalance.toFixed(2)} ብር`}
                </div>
                <div className="text-white/70 text-sm mt-1">
                  {walletBalance >= 10 ? 'Ready to play! 🎮' : 'Need 10 ብር to play'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Game Status */}
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
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <Users className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-bold">{mainGame.players?.length || 0}</span>
              </div>
            )}
          </div>

          {!mainGame ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="text-white/50 w-8 h-8" />
              </div>
              <p className="text-white/80 font-medium mb-2">Game session loading</p>
              <p className="text-white/60 text-sm">Ready in a moment...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/10 hover:bg-white/20 rounded-2xl p-4 border border-white/10 hover:border-white/30 transition-all duration-300 backdrop-blur-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-black text-white">Game {mainGame.code}</h4>
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
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-white/70">
                        <Users className="w-4 h-4" />
                        <span>{mainGame.players?.length || 0} players</span>
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
              </div>

              {/* Status Message */}
              {mainGame.status === 'WAITING' && (
                <div className="p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
                  <div className="flex items-center gap-2 text-sm text-yellow-300">
                    <Clock className="w-4 h-4" />
                    <span>Game will start automatically when 2+ players join</span>
                  </div>
                </div>
              )}

              {mainGame.status === 'ACTIVE' && (
                <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                  <div className="flex items-center gap-2 text-sm text-green-300">
                    <Eye className="w-4 h-4" />
                    <span>Game in progress - Click PLAY to join!</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6 pb-20"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-black text-white">{mainGame ? 1 : 0}</div>
                <div className="text-white/60 text-xs">Active Session</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">{mainGame?.players?.length || 0}</div>
                <div className="text-white/60 text-xs">Players Online</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">{mainGame?.status === 'ACTIVE' ? 1 : 0}</div>
                <div className="text-white/60 text-xs">Live Game</div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )

  // Deposit Modal Component
  const DepositModal = () => (
    <AnimatePresence>
      {showDepositModal && (
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/30 shadow-2xl w-full max-w-sm"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-xl">Deposit Funds</h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
                <div className="text-white/80 text-sm mb-2">Current Balance</div>
                <div className="text-2xl font-black text-white">{walletBalance.toFixed(2)} ብር</div>
              </div>

              <div className="text-white/80 text-sm">
                You need at least <strong>10 ብር</strong> to play a game.
              </div>

              <button
                onClick={() => {
                  setShowDepositModal(false)
                  // openDeposit()
                }}
                className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold hover:bg-green-600 transition-colors"
              >
                Deposit Now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

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
    <>
      <DepositModal />
      {gameView === 'game' ? <GameView /> : <LobbyView />}
    </>
  )
}
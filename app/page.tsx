'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTelegram, useTelegramMainButton } from '../hooks/useTelegram'
import { authAPI, gameAPI, walletAPI } from '../services/api'
import { Game, User } from '../types'
import {
  Trophy,
  Users,
  Crown,
  Gamepad2,
  Clock,
  Eye,
  Wallet,
  RotateCcw,
  DollarSign,
  PhoneCall
} from 'lucide-react'

// Import game components
import { BingoCard } from '../components/ui/BingoCard'
import { NumberGrid } from '../components/ui/NumberGrid'
import { useGame } from '../hooks/useGame'

export default function Home() {
  const { user, isReady, WebApp, initData, theme } = useTelegram()
  const { 
    updateButton, 
    setButtonText, 
    onButtonClick 
  } = useTelegramMainButton(WebApp)
  
  const [mainGame, setMainGame] = useState<Game | null>(null)
  const [userStats, setUserStats] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authAttempted, setAuthAttempted] = useState(false)
  
  // Game state
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)
  const [gameView, setGameView] = useState<'lobby' | 'game'>('game')
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [isBalanceLoading, setIsBalanceLoading] = useState(true)

  // Use game hook when in game view
  const gameHook = useGame(currentGameId || '')

  // Calculate prize pool (10 birr per player)
  const prizePool = useMemo(() => (mainGame?.players?.length || 0) * 10, [mainGame?.players?.length])

  // Memoize game data to prevent unnecessary re-renders
  const gameData = useMemo(() => gameView === 'game' ? gameHook.game : mainGame, [gameView, gameHook.game, mainGame])
  const calledNumbers = useMemo(() => gameView === 'game' ? gameHook.gameState.calledNumbers : (mainGame?.numbersCalled || []), [gameView, gameHook.gameState.calledNumbers, mainGame?.numbersCalled])

  // Real-time game updates - optimized
  useEffect(() => {
    if (gameView === 'game' && currentGameId) {
      const interval = setInterval(() => {
        gameHook.refreshGame()
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [gameView, currentGameId, gameHook.refreshGame])

  // Initialize Telegram integration
  useEffect(() => {
    if (isReady && WebApp) {
      console.log('🚀 Telegram WebApp ready, initializing...')
      
      WebApp.expand()
      
      setButtonText('🔄 REFRESH GAME')
      updateButton({
        color: theme.button_color || '#3390ec',
        textColor: theme.button_text_color || '#ffffff',
        isVisible: true,
        isActive: true
      })
      
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
      setButtonText('🔄 REFRESH GAME')
      WebApp.BackButton.show()
    } else {
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

    return () => {
      if (WebApp) {
        WebApp.MainButton.offClick(handleMainButtonClick)
      }
    }
  }, [WebApp, isReady, gameView, mainGame, walletBalance])

  // Fetch wallet balance
  const fetchWalletBalance = useCallback(async () => {
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
  }, [])

  // Initialize user when Telegram is ready
  useEffect(() => {
    if (isReady && user && !authAttempted) {
      initializeUser()
    }
  }, [isReady, user, authAttempted])

  const initializeUser = useCallback(async () => {
    try {
      setAuthAttempted(true)
      setIsLoading(true)

      console.log('🔐 Authenticating user with Telegram...')

      const response = await authAPI.telegramLogin(initData || 'development')
      const { token, user: userData } = response.data

      localStorage.setItem('bingo_token', token)
      localStorage.setItem('user_id', userData.id)
      setUserStats(userData)

      console.log('✅ User authenticated successfully')
      
      await fetchWalletBalance()
      await loadMainGame()
      
    } catch (error) {
      console.error('Authentication failed:', error)
      
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
  }, [user, initData, fetchWalletBalance])

  const loadMainGame = useCallback(async () => {
    try {
      console.log('🎮 Loading main game...')
      const response = await gameAPI.getActiveGames()
      const games = response.data.games || []
      const activeGame = games[0] || null
      setMainGame(activeGame)
      
      // Always set current game and stay in game view
      if (activeGame) {
        setCurrentGameId(activeGame._id)
        setGameView('game')
      }
      
    } catch (error) {
      console.error('Failed to load main game:', error)
      setMainGame(null)
    }
  }, [])

  const handlePlayGame = useCallback(async () => {
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
      const entryFee = 10

      if (walletBalance < entryFee) {
        console.log('💰 Insufficient balance, showing deposit modal')
        setShowDepositModal(true)
        return
      }

      console.log(`🎮 Joining game with wallet balance: ${walletBalance} ብር`)

      if (WebApp) {
        WebApp.MainButton.showProgress()
      }

      const response = await gameAPI.joinGame(mainGame.code, userId)

      if (response.data.success) {
        console.log('✅ Successfully joined game, refreshing game data...')
        setCurrentGameId(mainGame._id)
        setGameView('game')
      } else {
        throw new Error('Failed to join game')
      }
    } catch (error: any) {
      console.error('Failed to join game:', error)

      if (error.response?.data?.error?.includes('already in this game')) {
        setCurrentGameId(mainGame._id)
        setGameView('game')
        return
      }

      loadMainGame()
    } finally {
      if (WebApp) {
        WebApp.MainButton.hideProgress()
      }
    }
  }, [mainGame, walletBalance, WebApp, loadMainGame])

  const handleRefreshGame = useCallback(() => {
    console.log('🔄 Refreshing game data...')
    if (gameView === 'game') {
      gameHook.refreshGame()
      loadMainGame()
    } else {
      loadMainGame()
    }
  }, [gameView, gameHook, loadMainGame])

  const handleBackToLobby = useCallback(() => {
    console.log('↩️ Returning to lobby')
    setGameView('lobby')
    setCurrentGameId(null)
  }, [])

  // Apply Telegram theme to document
  useEffect(() => {
    if (theme.bg_color) {
      document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color)
    }
    if (theme.text_color) {
      document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color)
    }
  }, [theme])

  // Helper function to get BINGO column letter
  const getColumnLetter = useCallback((number: number): string => {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
  }, [])

  // Compact Single Line Navbar Component - NO ANIMATIONS
  const GameNavbar = useMemo(() => {
    return (
      <div className="bg-white/20 backdrop-blur-lg rounded-xl p-2 mb-4 border border-white/30">
        <div className="flex items-center justify-between text-center">
          {/* Prize Pool */}
          <div className="flex-1">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-300 text-xs font-bold">PRIZE</span>
            </div>
            <div className="text-white font-black text-sm">{prizePool} ብር</div>
          </div>

          {/* Players Count */}
          <div className="flex-1 border-l border-white/20">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-3 h-3 text-blue-400" />
              <span className="text-blue-300 text-xs font-bold">PLAYERS</span>
            </div>
            <div className="text-white font-black text-sm">{gameData?.players?.length || 0}</div>
          </div>

          {/* Bet Amount */}
          <div className="flex-1 border-l border-white/20">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-green-400" />
              <span className="text-green-300 text-xs font-bold">BET</span>
            </div>
            <div className="text-white font-black text-sm">10 ብር</div>
          </div>

          {/* Numbers Called */}
          <div className="flex-1 border-l border-white/20">
            <div className="flex items-center justify-center gap-1 mb-1">
              <PhoneCall className="w-3 h-3 text-purple-400" />
              <span className="text-purple-300 text-xs font-bold">CALLED</span>
            </div>
            <div className="text-white font-black text-sm">{calledNumbers.length}</div>
          </div>
        </div>
      </div>
    )
  }, [prizePool, gameData?.players?.length, calledNumbers.length])

  // Current Number Display Component - NO ANIMATIONS
  const CurrentNumberDisplay = useMemo(() => {
    if (!gameHook.gameState.currentNumber) return null;

    return (
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-3 text-center border-2 border-white shadow-lg">
        <div className="text-white/80 text-xs font-bold mb-1">CURRENT NUMBER</div>
        <div className="text-2xl font-black text-white drop-shadow-lg">
          {gameHook.gameState.currentNumber}
        </div>
        <div className="text-white/90 text-sm font-bold mt-1">
          {getColumnLetter(gameHook.gameState.currentNumber)}
        </div>
      </div>
    );
  }, [gameHook.gameState.currentNumber, getColumnLetter])

  // Game View Component - Always show game interface
  const GameView = useMemo(() => {
    const userId = localStorage.getItem('user_id')
    const isUserInGame = mainGame?.players?.some(player => 
      player?.user?._id === userId || player?.userId === userId
    )

    // Show loading state if no game data
    if (!currentGameId || !mainGame) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
            <p className="text-white text-lg font-bold">Loading Game...</p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 relative overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto p-3 safe-area-padding">
          {/* Header with Navigation */}
          <div className="flex items-center justify-between mb-3 pt-3">
            <button
              onClick={handleBackToLobby}
              className="flex items-center gap-1 px-3 py-2 bg-white/20 backdrop-blur-lg text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all text-sm"
            >
              <Eye className="w-4 h-4" />
              <span className="font-bold">Lobby</span>
            </button>

            <div className="text-white text-center">
              <div className="text-xs opacity-80">Playing as</div>
              <div className="font-bold text-sm">{userStats?.firstName || 'Player'}</div>
            </div>

            <button
              onClick={handleRefreshGame}
              className="flex items-center gap-1 px-3 py-2 bg-white/20 backdrop-blur-lg text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="font-bold">Refresh</span>
            </button>
          </div>

          {/* Compact Game Navigation Bar */}
          {GameNavbar}

          {/* Main Content - Game Cards and Current Number */}
          <div className="space-y-4">
            {/* Game Header */}
            <div className="bg-white/20 backdrop-blur-lg rounded-xl p-3 border border-white/30">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <h1 className="text-xl font-black text-white mb-1">Game {mainGame.code}</h1>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 text-white/80 text-xs">
                    <span>{mainGame.players?.length || 0} players</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{mainGame.numbersCalled?.length || 0} numbers called</span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg font-black text-xs ${
                  mainGame.status === 'ACTIVE' 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : mainGame.status === 'FINISHED'
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {mainGame.status === 'ACTIVE' ? 'LIVE' : 
                   mainGame.status === 'FINISHED' ? 'FINISHED' : 
                   'WAITING'}
                </div>
              </div>
            </div>

            {/* Card and Current Number in Single Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bingo Card - Takes 2/3 width on left */}
              <div className="lg:col-span-2">
                <BingoCard
                  calledNumbers={calledNumbers}
                  currentNumber={gameHook.gameState.currentNumber}
                />
              </div>

              {/* Right Column - Current Number and Stats */}
              <div className="space-y-3">
                {/* Current Number Display */}
                {CurrentNumberDisplay}

                {/* Number Grid */}
                <NumberGrid
                  calledNumbers={calledNumbers}
                  currentNumber={gameHook.gameState.currentNumber}
                />

                {/* Stats Footer */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-black text-white">{calledNumbers.length}</div>
                      <div className="text-white/60 text-xs">Called</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">
                        {calledNumbers.length}
                      </div>
                      <div className="text-white/60 text-xs">Marked</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">
                        {Math.round((calledNumbers.length / 75) * 100)}%
                      </div>
                      <div className="text-white/60 text-xs">Progress</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Join Game Button if not in game */}
          {!isUserInGame && (
            <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-20">
              <button
                onClick={handlePlayGame}
                disabled={walletBalance < 10}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-2xl transition-colors"
              >
                {walletBalance >= 10 ? 'JOIN GAME - 10 ብር' : 'NEED 10 ብር TO PLAY'}
              </button>
            </div>
          )}

          {/* Bottom Padding for Telegram Button */}
          <div className="h-16"></div>
        </div>
      </div>
    )
  }, [currentGameId, mainGame, GameNavbar, CurrentNumberDisplay, calledNumbers, gameHook.gameState.currentNumber, walletBalance, handleBackToLobby, handleRefreshGame, handlePlayGame, userStats])

  // Deposit Modal Component - NO ANIMATIONS
  const DepositModal = useMemo(() => {
    if (!showDepositModal) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3">
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 border border-white/30 shadow-2xl w-full max-w-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-bold text-lg">Deposit Funds</h3>
            <button
              onClick={() => setShowDepositModal(false)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div className="bg-white/10 rounded-xl p-3 border border-white/20">
              <div className="text-white/80 text-sm mb-2">Current Balance</div>
              <div className="text-xl font-black text-white">{walletBalance.toFixed(2)} ብር</div>
            </div>

            <div className="text-white/80 text-sm">
              You need at least <strong>10 ብር</strong> to play a game.
            </div>

            <button
              onClick={() => {
                setShowDepositModal(false)
              }}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition-colors"
            >
              Deposit Now
            </button>
          </div>
        </div>
      </div>
    )
  }, [showDepositModal, walletBalance])

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
          <p className="text-white text-lg font-bold">
            {initData === 'development' ? 'Development Mode' : 'Loading Bingo...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {DepositModal}
      {GameView}
    </>
  )
}
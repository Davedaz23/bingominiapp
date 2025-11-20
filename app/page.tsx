'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegram } from '../hooks/useTelegram' // Fixed import path
import { authAPI, gameAPI } from '../services/api' // Fixed import path
import { Game, User } from '../types' // Fixed import path
import { motion } from 'framer-motion'
import { Trophy, Users, Plus, Search } from 'lucide-react'

export default function Home() {
  const { user, isReady, WebApp } = useTelegram() // Added WebApp
  const router = useRouter()
  const [activeGames, setActiveGames] = useState<Game[]>([])
  const [userStats, setUserStats] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isReady && user) {
      initializeUser()
      loadActiveGames()
    }
  }, [isReady, user])

  const initializeUser = async () => {
    try {
      // Use WebApp from hook instead of window.Telegram.WebApp
      const initData = WebApp?.initData || 'development'
      
      const response = await authAPI.telegramLogin(initData)
      const { token, user: userData } = response.data
      
      localStorage.setItem('bingo_token', token)
      localStorage.setItem('user_id', userData.id)
      setUserStats(userData)
    } catch (error) {
      console.error('Authentication failed:', error)
    }
  }

  const loadActiveGames = async () => {
    try {
      const response = await gameAPI.getActiveGames()
      setActiveGames(response.data.games)
    } catch (error) {
      console.error('Failed to load games:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createGame = async () => {
    try {
      const userId = localStorage.getItem('user_id')
      if (!userId) return;
      
      const response = await gameAPI.createGame(userId, 10, false)
      router.push(`/game/${response.data.game.id}`)
    } catch (error) {
      console.error('Failed to create game:', error)
    }
  }

  // Show loading state until Telegram WebApp is ready
  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-telegram-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-telegram-button border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-telegram-text">Loading Bingo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-4 safe-area-padding">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-md mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <motion.h1 
            className="text-4xl font-bold text-gray-800 mb-2"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            🎯 Bingo
          </motion.h1>
          <p className="text-gray-600">Play with friends in real-time!</p>
        </div>

        {/* User Stats Card */}
        {userStats && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-telegram-button to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {userStats.firstName?.[0] || userStats.username?.[0]}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-800">
                  {userStats.firstName || userStats.username}
                </h3>
                <p className="text-gray-600 text-sm">@{userStats.username}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl">
                <div className="text-xl font-bold text-blue-600">
                  {userStats.gamesPlayed}
                </div>
                <div className="text-xs text-gray-600">Played</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl">
                <div className="text-xl font-bold text-green-600">
                  {userStats.gamesWon}
                </div>
                <div className="text-xs text-gray-600">Won</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-3 rounded-xl">
                <div className="text-xl font-bold text-amber-600">
                  {userStats.totalScore}
                </div>
                <div className="text-xs text-gray-600">Score</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <button
            onClick={createGame}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Create Game
          </button>
          
          <button
            onClick={() => router.push('/games')}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Search size={20} />
            Join Game
          </button>
        </motion.div>

        {/* Active Games Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-gray-800">Active Games</h3>
            <Users size={20} className="text-gray-500" />
          </div>
          
          {activeGames.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trophy className="text-gray-400" size={24} />
              </div>
              <p className="text-gray-500 mb-2">No active games yet</p>
              <p className="text-gray-400 text-sm">Create the first game and invite friends!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
              {activeGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:border-telegram-button transition-all duration-200 cursor-pointer group"
                  onClick={() => router.push(`/game/${game.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 group-hover:text-telegram-button transition-colors">
                        Game {game.code}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {game.currentPlayers}/{game.maxPlayers} players
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          game.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {game.status}
                        </div>
                        <span className="text-xs text-gray-500">
                          Host: {game.host.firstName}
                        </span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-telegram-button rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {game.currentPlayers}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../hooks/useTelegram';
import { gameAPI } from '../../lib/api/game';
import { Game } from '../../types';
import { motion } from 'framer-motion';
import { Search, Users, Clock, Plus } from 'lucide-react';

export default function GamesPage() {
  const { user, isReady } = useTelegram();
  const router = useRouter();
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isReady) {
      loadActiveGames();
    }
  }, [isReady]);

  const loadActiveGames = async () => {
    try {
      const response = await gameAPI.getActiveGames();
      setActiveGames(response.data.games);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const joinGame = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const createGame = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      const response = await gameAPI.createGame(userId!, 10, false);
      router.push(`/game/${response.data.game.id}`);
    } catch (error) {
      console.error('Failed to create game:', error);
    }
  };

  const filteredGames = activeGames.filter(game =>
    game.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.host.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.host.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-telegram-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-telegram-button border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-telegram-text">Loading games...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-md mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Join a Game</h1>
          <p className="text-gray-600">Find active games or create your own</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by game code or host..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-telegram-button focus:border-transparent"
            />
          </div>
        </div>

        {/* Create Game Button */}
        <motion.button
          onClick={createGame}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-telegram-button text-telegram-buttonText py-4 rounded-2xl font-bold shadow-lg mb-6 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Create New Game
        </motion.button>

        {/* Games List */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Users size={20} />
            Available Games ({filteredGames.length})
          </h3>
          
          {filteredGames.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="text-gray-400" size={24} />
              </div>
              <p className="text-gray-500 mb-2">
                {searchTerm ? 'No games found' : 'No active games available'}
              </p>
              <p className="text-gray-400 text-sm">
                {searchTerm ? 'Try a different search term' : 'Create the first game!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
              {filteredGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border-2 border-gray-100 rounded-xl hover:border-telegram-button transition-all duration-200 cursor-pointer group"
                  onClick={() => joinGame(game.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-800 group-hover:text-telegram-button transition-colors">
                          Game {game.code}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          game.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {game.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{game.currentPlayers}/{game.maxPlayers}</span>
                        </div>
                        <div>
                          Host: {game.host.firstName || game.host.username}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <div className="text-xs text-gray-500">
                          Created: {new Date(game.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-12 h-12 bg-gradient-to-br from-telegram-button to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {game.currentPlayers}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
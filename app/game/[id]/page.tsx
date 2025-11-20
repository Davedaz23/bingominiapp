'use client'

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useGame } from '../../../hooks/useGame';
import { useTelegram } from '../../../hooks/useTelegram';
import { BingoCard } from '../../../components/ui/BingoCard';
import { NumberGrid } from '../../../components/ui/NumberGrid';
import { GameLobby } from '../../../components/ui/GameLobby';
import { gameAPI } from '../../../lib/api/game';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Volume2 } from 'lucide-react';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useTelegram();
  const { game, bingoCard, gameState, markNumber, refreshGame } = useGame(id);
  const [showWinAnimation, setShowWinAnimation] = useState(false);

  useEffect(() => {
    if (game?.status === 'FINISHED' && bingoCard?.isWinner) {
      setShowWinAnimation(true);
    }
  }, [game?.status, bingoCard?.isWinner]);

  const handleStartGame = async () => {
    if (!game || !user) return;
    
    try {
      await gameAPI.startGame(game.id, user.id.toString());
      refreshGame();
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  const handleMarkNumber = async (number: number) => {
    const isWinner = await markNumber(number);
    if (isWinner) {
      setShowWinAnimation(true);
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-telegram-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-telegram-button border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-telegram-text">Loading game...</p>
        </div>
      </div>
    );
  }

  if (game.status === 'WAITING') {
    return (
      <GameLobby
        game={game}
        currentUserId={user?.id?.toString() || ''}
        onStartGame={handleStartGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 p-4">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Game {game.code}</h1>
              <p className="text-sm text-gray-600">
                {game.currentPlayers} players • {game.numbersCalled.length} numbers called
              </p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 bg-gray-100 rounded-lg">
                <Volume2 size={20} />
              </button>
              <div className="flex items-center gap-1 px-3 py-1 bg-telegram-button text-white rounded-full text-sm">
                <Users size={16} />
                <span>{game.currentPlayers}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Number Display */}
        {gameState.currentNumber && (
          <motion.div
            className="bg-white rounded-2xl shadow-lg p-6 text-center mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <div className="text-sm text-gray-600 mb-2">Current Number</div>
            <div className="text-6xl font-bold text-telegram-button">
              {gameState.currentNumber}
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto space-y-6">
        {/* Bingo Card */}
        {bingoCard && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <BingoCard
              card={bingoCard}
              calledNumbers={gameState.calledNumbers}
              onMarkNumber={handleMarkNumber}
              isInteractive={game.status === 'ACTIVE'}
            />
          </motion.div>
        )}

        {/* Number Grid */}
        <NumberGrid
          calledNumbers={gameState.calledNumbers}
          currentNumber={gameState.currentNumber}
        />

        {/* Win Animation */}
        <AnimatePresence>
          {showWinAnimation && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl p-8 mx-4 text-center shadow-2xl"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-800 mb-2">BINGO!</h2>
                <p className="text-gray-600 mb-6">Congratulations! You won!</p>
                <button
                  onClick={() => setShowWinAnimation(false)}
                  className="bg-telegram-button text-white px-8 py-3 rounded-2xl font-bold"
                >
                  Awesome!
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
// components/GameLobby.tsx
import { motion } from 'framer-motion';
import { Users, Clock, Play, Copy } from 'lucide-react';
import { Game } from '../../types';

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
  const copyGameCode = () => {
    navigator.clipboard.writeText(game.code);
    // Show toast notification
  };

  const isHost = game.hostId === currentUserId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Game {game.code}</h1>
              <p className="text-gray-600">Hosted by {game.host.firstName || game.host.username}</p>
            </div>
            <button
              onClick={copyGameCode}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Copy size={16} />
              <span className="font-mono">{game.code}</span>
            </button>
          </div>

          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Users size={16} />
              <span>{game.currentPlayers}/{game.maxPlayers} players</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={16} />
              <span>Waiting...</span>
            </div>
          </div>
        </div>

        {/* Players List */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <h3 className="font-semibold mb-3">Players ({game.players.length})</h3>
          <div className="space-y-2">
            {game.players.map((player, index) => (
              <motion.div
                key={player.user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
              >
                <div className="w-8 h-8 rounded-full bg-telegram-button flex items-center justify-center text-white text-sm font-bold">
                  {player.user.firstName?.[0] || player.user.username?.[0] || '?'}
                </div>
                <span className="font-medium">
                  {player.user.firstName || player.user.username}
                </span>
                {player.user.id === game.hostId && (
                  <span className="ml-auto px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    Host
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Start Game Button */}
        {isHost && game.players.length >= 2 && (
          <motion.button
            onClick={onStartGame}
            className="w-full bg-telegram-button text-telegram-buttonText py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play size={20} />
            Start Game
          </motion.button>
        )}

        {isHost && game.players.length < 2 && (
          <div className="text-center text-gray-500 py-4">
            Need at least 2 players to start
          </div>
        )}
      </motion.div>
    </div>
  );
};
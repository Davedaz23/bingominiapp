import { motion } from 'framer-motion';
import { Crown, Play, Trophy, Users } from 'lucide-react';

interface AdminControlsProps {
  onStartGame: () => void;
  onEndGame: () => void;
  onManageUsers: () => void;
}

export const AdminControls: React.FC<AdminControlsProps> = ({ 
  onStartGame, 
  onEndGame, 
  onManageUsers 
}) => (
  <motion.div 
    className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-yellow-500/30"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-yellow-300" />
        <p className="text-yellow-300 font-bold text-sm">Admin Controls</p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <button 
        onClick={onStartGame}
        className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Play className="w-3 h-3" />
        Start Game
      </button>
      <button 
        onClick={onEndGame}
        className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Trophy className="w-3 h-3" />
        End Game
      </button>
      <button 
        onClick={onManageUsers}
        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Users className="w-3 h-3" />
        Manage Users
      </button>
    </div>
  </motion.div>
);
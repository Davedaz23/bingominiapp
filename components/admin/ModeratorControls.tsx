import { motion } from 'framer-motion';
import { Shield, Play, Trophy } from 'lucide-react';

interface ModeratorControlsProps {
  onModerateGames: () => void;
  onViewReports: () => void;
}

export const ModeratorControls: React.FC<ModeratorControlsProps> = ({ 
  onModerateGames, 
  onViewReports 
}) => (
  <motion.div 
    className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border border-blue-500/30"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-300" />
        <p className="text-blue-300 font-bold text-sm">Moderator Controls</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <button 
        onClick={onModerateGames}
        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Play className="w-3 h-3" />
        Moderate Games
      </button>
      <button 
        onClick={onViewReports}
        className="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Trophy className="w-3 h-3" />
        View Reports
      </button>
    </div>
  </motion.div>
);
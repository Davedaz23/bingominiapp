import { motion } from 'framer-motion';

interface GameControlsProps {
  selectedNumber: number | null;
  joining: boolean;
  joinError: string;
  walletBalance: number;
  gameStatus: string;
  onJoinGame: () => void;
  onCardRelease: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  selectedNumber,
  joining,
  joinError,
  walletBalance,
  gameStatus,
  onJoinGame,
  onCardRelease
}) => {
  if (!selectedNumber) return null;

  return (
    <motion.div 
      className={`backdrop-blur-lg rounded-2xl p-4 mb-6 border text-center ${
        joinError 
          ? 'bg-red-500/20 border-red-500/30' 
          : 'bg-yellow-500/20 border-yellow-500/30'
      }`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-white font-bold text-lg">
        Selected Card: #{selectedNumber}
      </p>
      <p className={`text-sm ${
        joinError ? 'text-red-300' : 'text-yellow-300'
      }`}>
        {joining 
          ? 'Joining game...' 
          : joinError 
            ? joinError
            : 'Ready to join game'
        }
      </p>
      {joinError && walletBalance < 10 && (
        <p className="text-white/80 text-sm mt-2">
          Insufficient balance. You will be redirected to watch the game.
        </p>
      )}
      
      <motion.div 
        className="grid grid-cols-2 gap-3 mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          onClick={onCardRelease}
          disabled={joining || (gameStatus === 'ACTIVE' && walletBalance >= 10)}
          className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Change Card
        </motion.button>
        <motion.button
          onClick={onJoinGame}
          disabled={joining || (gameStatus === 'ACTIVE' && walletBalance >= 10)}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {joining ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Joining...
            </>
          ) : (
            'Join Game'
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
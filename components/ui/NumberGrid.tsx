// components/NumberGrid.tsx
import { motion } from 'framer-motion';
import { Clock, Sparkles } from 'lucide-react';

interface NumberGridProps {
  calledNumbers: number[];
  currentNumber?: number;
  isLateJoiner?: boolean;
  numbersCalledAtJoin?: number[];
}

export const NumberGrid: React.FC<NumberGridProps> = ({
  calledNumbers,
  currentNumber,
  isLateJoiner = false,
  numbersCalledAtJoin = []
}) => {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);

  // For late joiners, combine all numbers called in the game
  const effectiveCalledNumbers = isLateJoiner 
    ? [...new Set([...calledNumbers, ...numbersCalledAtJoin])]
    : calledNumbers;

  const wasCalledBeforeJoin = (number: number) => {
    return isLateJoiner && numbersCalledAtJoin.includes(number);
  };

  const getNumberColor = (number: number) => {
    if (number === currentNumber) return 'bg-yellow-400 text-yellow-900 shadow-lg scale-110';
    
    if (effectiveCalledNumbers.includes(number)) {
      if (isLateJoiner && wasCalledBeforeJoin(number)) {
        return 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md';
      }
      return 'bg-gradient-to-br from-telegram-button to-blue-600 text-white shadow-md';
    }
    
    return 'bg-gray-200 text-gray-600 hover:bg-gray-300';
  };

  const getNumberSize = (number: number) => {
    if (number === currentNumber) return 'w-8 h-8 text-sm';
    return 'w-6 h-6 text-xs';
  };

  const getNumberAnimation = (number: number) => {
    if (number === currentNumber) {
      return {
        scale: [1, 1.2, 1],
        rotate: [0, 5, -5, 0],
        transition: { duration: 0.5, type: "spring" }
      };
    }
    return {};
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-xl p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-black text-gray-800">Called Numbers</h3>
        
        {/* Late Joiner Indicator */}
        {isLateJoiner && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold"
          >
            <Clock className="w-3 h-3" />
            Late Joiner
          </motion.div>
        )}
      </div>

      {/* Numbers Grid */}
      <div className="grid grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-2xl">
        {numbers.map((number) => (
          <motion.div
            key={number}
            className={`
              rounded-xl flex items-center justify-center font-bold
              ${getNumberColor(number)} ${getNumberSize(number)}
              transition-all duration-300 cursor-default
              relative overflow-hidden
            `}
            whileHover={{ 
              scale: number === currentNumber ? 1.3 : 1.1,
              zIndex: 10
            }}
            animate={getNumberAnimation(number)}
            layout
          >
            {number}
            
            {/* Pre-called indicator for late joiners */}
            {isLateJoiner && wasCalledBeforeJoin(number) && number !== currentNumber && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full border border-white"
              />
            )}

            {/* Current number sparkle */}
            {number === currentNumber && (
              <motion.div
                className="absolute inset-0"
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1, repeat: Infinity }
                }}
              >
                <Sparkles className="w-4 h-4 text-yellow-200 absolute -top-1 -right-1" />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Current Number Display */}
      {currentNumber && (
        <motion.div
          className="mt-6 text-center bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 shadow-2xl border-2 border-white"
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <div className="text-white/80 text-sm font-bold mb-2">CURRENT NUMBER</div>
          <motion.div
            className="text-6xl font-black text-white drop-shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          >
            {currentNumber}
          </motion.div>
          <motion.div
            className="text-white/90 text-lg font-bold mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {getColumnLetter(currentNumber)}
          </motion.div>
        </motion.div>
      )}

      {/* Stats Footer */}
      <motion.div
        className="mt-4 flex justify-between items-center text-sm text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="font-black text-lg text-telegram-button">
              {effectiveCalledNumbers.length}
            </div>
            <div className="text-xs">Total Called</div>
          </div>
          
          {isLateJoiner && (
            <div className="text-center">
              <div className="font-black text-lg text-purple-600">
                {numbersCalledAtJoin.length}
              </div>
              <div className="text-xs">Pre-called</div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          {isLateJoiner && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span>Pre-called</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-telegram-button rounded"></div>
            <span>Called</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span>Current</span>
          </div>
        </div>
      </motion.div>

      {/* Late Joiner Info */}
      {isLateJoiner && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ delay: 0.8 }}
          className="mt-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200"
        >
          <div className="flex items-center gap-2 text-yellow-800 text-xs">
            <Clock className="w-3 h-3" />
            <span>
              <strong>All {effectiveCalledNumbers.length} numbers count</strong> towards your bingo! 
              {numbersCalledAtJoin.length} were called before you joined.
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Helper function to get BINGO column letter
const getColumnLetter = (number: number): string => {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  if (number >= 61 && number <= 75) return 'O';
  return '';
};
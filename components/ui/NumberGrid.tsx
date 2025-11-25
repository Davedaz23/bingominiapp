// components/ui/NumberGrid.tsx
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
  const numbers = Array.from({ length: 400 }, (_, i) => i + 1);

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
    if (number === currentNumber) return 'w-5 h-5 text-[10px]';
    return 'w-4 h-4 text-[8px]';
  };

  const getNumberAnimation = (number: number) => {
    if (number === currentNumber) {
      return {
        scale: [1, 1.3, 1],
        rotate: [0, 5, -5, 0],
        transition: { duration: 0.5, type: "spring" }
      };
    }
    return {};
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-xl p-4 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-black text-gray-800">All Numbers (1-400)</h3>
        
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <div className="text-center">
            <div className="font-black text-telegram-button">{effectiveCalledNumbers.length}</div>
            <div className="text-[10px]">Called</div>
          </div>
          <div className="text-center">
            <div className="font-black text-gray-400">{400 - effectiveCalledNumbers.length}</div>
            <div className="text-[10px]">Remaining</div>
          </div>
        </div>
      </div>

      {/* Numbers Grid - All 400 numbers */}
      <div className="grid grid-cols-20 gap-1 max-h-80 overflow-y-auto p-2 bg-gray-50 rounded-xl">
        {numbers.map((number) => (
          <motion.div
            key={number}
            className={`
              rounded-md flex items-center justify-center font-bold
              ${getNumberColor(number)} ${getNumberSize(number)}
              transition-all duration-300 cursor-default
              relative overflow-hidden
            `}
            whileHover={{ 
              scale: number === currentNumber ? 1.4 : 1.2,
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
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-yellow-400 rounded-full border border-white"
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
                <Sparkles className="w-3 h-3 text-yellow-200 absolute -top-0.5 -right-0.5" />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Current Number Display */}
      {currentNumber && (
        <motion.div
          className="mt-4 text-center bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-3 shadow-xl border-2 border-white"
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <div className="text-white/80 text-xs font-bold mb-1">CURRENT NUMBER</div>
          <motion.div
            className="text-4xl font-black text-white drop-shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          >
            {currentNumber}
          </motion.div>
        </motion.div>
      )}

      {/* Stats Footer */}
      <motion.div
        className="mt-3 flex justify-between items-center text-xs text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="font-black text-base text-telegram-button">
              {effectiveCalledNumbers.length}
            </div>
            <div className="text-[10px]">Total Called</div>
          </div>
          
          {isLateJoiner && (
            <div className="text-center">
              <div className="font-black text-base text-purple-600">
                {numbersCalledAtJoin.length}
              </div>
              <div className="text-[10px]">Pre-called</div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px]">
          {isLateJoiner && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded"></div>
              <span>Pre-called</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-telegram-button rounded"></div>
            <span>Called</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-400 rounded"></div>
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
          className="mt-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200"
        >
          <div className="flex items-center gap-1 text-yellow-800 text-[10px]">
            <Clock className="w-2.5 h-2.5" />
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
// components/BingoCard.tsx - FIXED VERSION with Automatic Marking
import { motion, AnimatePresence } from 'framer-motion';
import { BingoCard as BingoCardType } from '../../types';
import { Sparkles, Check, Clock, AlertCircle } from 'lucide-react';

interface BingoCardProps {
  card: BingoCardType;
  calledNumbers: number[];
  onMarkNumber: (number: number) => void;
  isInteractive?: boolean;
  isWinner?: boolean;
  isLateJoiner?: boolean;
  numbersCalledAtJoin?: number[];
}

export const BingoCard: React.FC<BingoCardProps> = ({
  card,
  calledNumbers,
  onMarkNumber,
  isInteractive = true,
  isWinner = false,
  isLateJoiner = false,
  numbersCalledAtJoin = []
}) => {
  // For late joiners, combine all numbers called in the game
  const effectiveCalledNumbers = isLateJoiner 
    ? [...new Set([...calledNumbers, ...numbersCalledAtJoin])]
    : calledNumbers;

  // Check if a number was called before the player joined
  const wasCalledBeforeJoin = (number: number) => {
    return isLateJoiner && numbersCalledAtJoin.includes(number);
  };

  // FIXED: Check if number should be automatically marked (called and in card)
  const shouldBeAutomaticallyMarked = (row: number, col: number, number: number): boolean => {
    const position = row * 5 + col;
    const isFreeSpace = row === 2 && col === 2;
    
    if (isFreeSpace) return true; // FREE space is always marked
    
    // For late joiners: automatically mark ALL called numbers (both pre-join and post-join)
    // For regular players: automatically mark ALL called numbers
    return effectiveCalledNumbers.includes(number);
  };

  // FIXED: Check if user manually marked this position
  const isManuallyMarked = (row: number, col: number): boolean => {
    const position = row * 5 + col;
    return card.markedPositions.includes(position);
  };

  // FIXED: A number is visually marked if it's either automatically marked OR manually marked
  const isVisuallyMarked = (row: number, col: number, number: number): boolean => {
    return shouldBeAutomaticallyMarked(row, col, number) || isManuallyMarked(row, col);
  };

  // FIXED: Check if number can be manually marked (called after join for late joiners)
  const canBeManuallyMarked = (number: number) => {
    if (!isLateJoiner) return calledNumbers.includes(number);
    return calledNumbers.includes(number) && !wasCalledBeforeJoin(number);
  };

  const handleCellClick = (number: number, row: number, col: number) => {
    const position = row * 5 + col;
    const isFreeSpace = row === 2 && col === 2;
    
    // Don't allow clicking if:
    // - Not interactive
    // - Already manually marked
    // - FREE space
    // - Number can't be manually marked (for late joiners: pre-called numbers)
    if (!isInteractive || isManuallyMarked(row, col) || isFreeSpace || !canBeManuallyMarked(number)) return;
    
    onMarkNumber(number);
  };

  const getColumnLetter = (col: number) => {
    const letters = ['B', 'I', 'N', 'G', 'O'];
    return letters[col];
  };

  // FIXED: Get visual status for each cell
  const getCellStatus = (row: number, col: number, number: number) => {
    const automaticallyMarked = shouldBeAutomaticallyMarked(row, col, number);
    const manuallyMarked = isManuallyMarked(row, col);
    const visuallyMarked = automaticallyMarked || manuallyMarked;
    const preCalled = isLateJoiner && wasCalledBeforeJoin(number);
    const canMark = canBeManuallyMarked(number) && !manuallyMarked;
    const isFreeSpace = row === 2 && col === 2;

    return {
      automaticallyMarked,
      manuallyMarked,
      visuallyMarked,
      preCalled,
      canMark,
      isFreeSpace,
      // Show green checkmark if automatically OR manually marked
      shouldShowMarked: visuallyMarked,
      // Show as pre-called background for late joiners (subtle indication)
      shouldShowPreCalled: isLateJoiner && preCalled && !manuallyMarked,
      // Show as interactive (orange pulse) if can be manually marked
      shouldShowInteractive: canMark && isInteractive,
    };
  };

  return (
    <motion.div 
      className="relative"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Late Joiner Banner */}
      <AnimatePresence>
        {isLateJoiner && (
          <motion.div
            initial={{ scale: 0, y: -20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: -20 }}
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-20"
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Late Joiner
              <AlertCircle className="w-3 h-3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Crown */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            className={`absolute -top-6 left-1/2 transform -translate-x-1/2 z-20 ${isLateJoiner ? 'mt-6' : ''}`}
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-2 rounded-full font-black text-sm shadow-2xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 fill-white" />
              {isLateJoiner ? 'LATE BINGO! 🎯' : 'BINGO!'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-6 border-4 border-telegram-button relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-red-400" />
        </div>

        {/* Late Joiner Info */}
        {isLateJoiner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-3 p-2 bg-yellow-50 rounded-xl border border-yellow-200"
          >
            <div className="flex items-center gap-2 text-yellow-800 text-xs">
              <Clock className="w-3 h-3" />
              <span className="font-bold">
                All {effectiveCalledNumbers.length} called numbers are automatically marked! 
                {numbersCalledAtJoin.length} were called before you joined.
              </span>
            </div>
          </motion.div>
        )}

        {/* Column Headers */}
        <div className="grid grid-cols-5 gap-3 mb-3">
          {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
            <motion.div
              key={letter}
              className="text-center font-black text-lg text-telegram-button"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              {letter}
            </motion.div>
          ))}
        </div>

        {/* Bingo Grid */}
        <div className="grid grid-cols-5 gap-2 relative z-10">
          {card.numbers.map((row, rowIndex) =>
            row.map((number, colIndex) => {
              const {
                automaticallyMarked,
                manuallyMarked,
                visuallyMarked,
                preCalled,
                canMark,
                isFreeSpace,
                shouldShowMarked,
                shouldShowPreCalled,
                shouldShowInteractive,
              } = getCellStatus(rowIndex, colIndex, number);

              return (
                <motion.div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    aspect-square rounded-2xl flex items-center justify-center text-lg font-bold relative
                    border-3 transition-all duration-300
                    ${shouldShowMarked 
                      ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-lg scale-105' 
                      : shouldShowPreCalled
                      ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 text-purple-700'
                      : shouldShowInteractive
                      ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 text-orange-800 shadow-md hover:shadow-lg cursor-pointer'
                      : 'bg-white/80 border-gray-200 text-gray-600'
                    }
                    ${shouldShowInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                    ${isWinner && visuallyMarked ? 'ring-4 ring-yellow-400 ring-opacity-50' : ''}
                  `}
                  whileHover={shouldShowInteractive ? { 
                    scale: 1.1,
                    rotate: [0, -2, 2, 0]
                  } : {}}
                  whileTap={{ scale: shouldShowInteractive ? 0.95 : 1 }}
                  onClick={() => handleCellClick(number, rowIndex, colIndex)}
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: (rowIndex * 5 + colIndex) * 0.05,
                    type: "spring",
                    stiffness: 200
                  }}
                >
                  {isFreeSpace ? (
                    <div className="text-center">
                      <div className="text-xs font-black text-telegram-button mb-1">FREE</div>
                      <Sparkles className="w-4 h-4 mx-auto text-yellow-500" />
                    </div>
                  ) : (
                    <div className="text-center">
                      {number}
                    </div>
                  )}
                  
                  {/* Mark Indicator - Show for ALL marked cells (automatic + manual) */}
                  {shouldShowMarked && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, type: "spring" }}
                    >
                      <Check className="w-6 h-6 text-white drop-shadow-md" />
                    </motion.div>
                  )}

                  {/* Pulse animation for numbers that can be manually marked */}
                  {shouldShowInteractive && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-2 border-orange-400"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}

                  {/* Winner celebration */}
                  {isWinner && shouldShowMarked && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      animate={{ 
                        boxShadow: [
                          '0 0 0 0 rgba(34, 197, 94, 0.7)',
                          '0 0 0 10px rgba(34, 197, 94, 0)',
                          '0 0 0 0 rgba(34, 197, 94, 0)'
                        ]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        times: [0, 0.5, 1]
                      }}
                    />
                  )}

                  {/* Pre-called indicator for late joiners */}
                  {shouldShowPreCalled && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ opacity: 1, scale: 1 }}
                      className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-xs px-2 py-1 rounded-lg pointer-events-none z-20"
                    >
                      Automatically marked (called before you joined)
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-purple-600 rotate-45" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>

        {/* Card Footer */}
        <motion.div 
          className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="text-sm text-gray-500 font-medium">
            <span>Marked: {card.numbers.flat().filter((num, index) => {
              const row = Math.floor(index / 5);
              const col = index % 5;
              return isVisuallyMarked(row, col, num);
            }).length}/25</span>
            {isLateJoiner && (
              <div className="text-xs text-gray-400">
                {numbersCalledAtJoin.length} pre-called + {calledNumbers.length - numbersCalledAtJoin.length} post-called
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => {
              const totalMarked = card.numbers.flat().filter((num, index) => {
                const row = Math.floor(index / 5);
                const col = index % 5;
                return isVisuallyMarked(row, col, num);
              }).length;
              const progressLevel = Math.min(5, Math.floor(totalMarked / 5));
              
              return (
                <motion.div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < progressLevel ? 'bg-green-400' : 'bg-gray-300'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                />
              );
            })}
          </div>
        </motion.div>

        {/* Late Joiner Legend */}
        {isLateJoiner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: 1.5 }}
            className="mt-3 pt-3 border-t border-gray-200"
          >
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-400 rounded"></div>
                <span>Automatically Marked</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-100 border-2 border-purple-300 rounded"></div>
                <span>Pre-called</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-100 border-2 border-orange-300 rounded"></div>
                <span>Can Mark</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
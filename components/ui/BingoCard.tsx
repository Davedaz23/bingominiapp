// components/BingoCard.tsx - FIXED VERSION
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

  // FIXED: Enhanced isMarked function that includes pre-called numbers for late joiners
const isMarked = (row: number, col: number): boolean => {
  const position = row * 5 + col;
  
  // If it's already manually marked, return true
  if (card.markedPositions.includes(position)) {
    return true;
  }
  
  // FIX: For late joiners, if the number was called before they joined AND is currently called, consider it marked
  if (isLateJoiner) {
    const number = card.numbers[row][col];
    const isFreeSpace = row === 2 && col === 2;
    
    // FIX: Only auto-mark if the number is in the effective called numbers
    if (!isFreeSpace && wasCalledBeforeJoin(number) && isCalled(number)) {
      return true;
    }
  }
  
  return false;
};
const shouldAutoMark = (row: number, col: number): boolean => {
  if (!isLateJoiner) return false;
  
  const number = card.numbers[row][col];
  const isFreeSpace = row === 2 && col === 2;
  
  return !isFreeSpace && wasCalledBeforeJoin(number) && isCalled(number);
};

  const isCalled = (number: number) => effectiveCalledNumbers.includes(number);

  const handleCellClick = (number: number, row: number, col: number) => {
    if (!isInteractive || isMarked(row, col) || !isCalled(number)) return;
    
    // For late joiners, allow marking any called number (not restricted to post-join numbers)
    onMarkNumber(number);
  };

  const getColumnLetter = (col: number) => {
    const letters = ['B', 'I', 'N', 'G', 'O'];
    return letters[col];
  };

  // FIXED: Calculate progress including pre-called numbers for late joiners
  const getEffectiveMarkedCount = () => {
    if (!isLateJoiner) return card.markedPositions.length;
    
    // For late joiners, count all numbers in their card that were called in the game
    let effectiveMarked = 0;
    
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (isMarked(row, col)) {
          effectiveMarked++;
        }
      }
    }
    
    return effectiveMarked;
  };
  

  // FIXED: Get visual status for each cell
  const getCellStatus = (row: number, col: number, number: number) => {
    const marked = isMarked(row, col);
    const called = isCalled(number);
    const isFreeSpace = row === 2 && col === 2;
    const preCalled = wasCalledBeforeJoin(number);

    return {
      marked,
      called,
      isFreeSpace,
      preCalled,
      // FIXED: Determine if cell should be visually marked (green)
        shouldShowMarked: marked || shouldAutoMark,
    // FIXED: Determine if cell should show as called (yellow/orange)
    shouldShowCalled: called && !marked && !shouldAutoMark, 
      // FIXED: Special case for pre-called numbers that are effectively marked
      isEffectivelyMarked: isLateJoiner && preCalled && !card.markedPositions.includes(row * 5 + col)
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
              <span className="font-bold">All {effectiveCalledNumbers.length} called numbers count! 🎯</span>
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
                marked,
                called,
                isFreeSpace,
                preCalled,
                shouldShowMarked,
                shouldShowCalled,
                isEffectivelyMarked
              } = getCellStatus(rowIndex, colIndex, number);

              return (
                <motion.div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    aspect-square rounded-2xl flex items-center justify-center text-lg font-bold relative
                    border-3 transition-all duration-300 cursor-pointer
                    ${shouldShowMarked 
                      ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-lg scale-105' 
                      : shouldShowCalled && isInteractive
                      ? preCalled
                        ? 'bg-gradient-to-br from-purple-100 to-indigo-100 border-purple-300 text-purple-800 shadow-md hover:shadow-lg'
                        : 'bg-gradient-to-br from-orange-100 to-amber-100 border-orange-300 text-orange-800 shadow-md hover:shadow-lg'
                      : 'bg-white/80 border-gray-200 text-gray-600 hover:bg-gray-50'
                    }
                    ${isInteractive && called && !marked ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                    ${isWinner && marked ? 'ring-4 ring-yellow-400 ring-opacity-50' : ''}
                  `}
                  whileHover={isInteractive && called && !marked ? { 
                    scale: 1.1,
                    rotate: [0, -2, 2, 0]
                  } : {}}
                  whileTap={{ scale: isInteractive && called && !marked ? 0.95 : 1 }}
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
                      {/* Pre-called indicator for late joiners */}
                      {isLateJoiner && preCalled && !shouldShowMarked && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white"
                        />
                      )}
                    </div>
                  )}
                  
                  {/* Mark Indicator - Show for both manually marked and effectively marked cells */}
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

                  {/* Pulse animation for called numbers that aren't marked yet */}
                  {shouldShowCalled && isInteractive && (
                    <motion.div
                      className={`absolute inset-0 rounded-2xl border-2 ${
                        preCalled ? 'border-purple-400' : 'border-orange-400'
                      }`}
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 0.8, 0.5]
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

                  {/* Pre-called tooltip for late joiners */}
                  {isLateJoiner && preCalled && !shouldShowMarked && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ opacity: 1, scale: 1 }}
                      className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-xs px-2 py-1 rounded-lg pointer-events-none z-20"
                    >
                      Called before you joined
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-purple-600 rotate-45" />
                    </motion.div>
                  )}

                  {/* Effectively marked indicator (for debugging) */}
                  {isEffectivelyMarked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-1 -left-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"
                    />
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
            {isLateJoiner ? (
              <div className="flex flex-col">
                <span>Effective: {getEffectiveMarkedCount()}/25</span>
                <span className="text-xs text-gray-400">
                  (Manually marked: {card.markedPositions.length})
                </span>
              </div>
            ) : (
              <span>Marked: {card.markedPositions.length}/25</span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => {
              const effectiveMarked = getEffectiveMarkedCount();
              const progressLevel = Math.min(5, Math.floor(effectiveMarked / 5));
              
              return (
                <motion.div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < progressLevel
                      ? isLateJoiner && i < Math.min(5, Math.floor(card.markedPositions.length / 5))
                        ? 'bg-green-400'
                        : isLateJoiner
                        ? 'bg-purple-400'
                        : 'bg-green-400'
                      : 'bg-gray-300'
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
                <div className="w-3 h-3 bg-purple-100 border-2 border-purple-300 rounded"></div>
                <span>Pre-called</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-100 border-2 border-orange-300 rounded"></div>
                <span>Called after join</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-400 rounded"></div>
                <span>Marked</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
// components/BingoCard.tsx - COMPACT ALL 75 NUMBERS VERSION
import { motion, AnimatePresence } from 'framer-motion';
import { BingoCard as BingoCardType } from '../../types';
import { Sparkles, Check, Clock, AlertCircle, Grid3X3 } from 'lucide-react';

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

  // Create a flat array of all 75 numbers (1-75)
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

  // FIXED: Check if number should be automatically marked
  const shouldBeAutomaticallyMarked = (number: number): boolean => {
    return effectiveCalledNumbers.includes(number);
  };

  // FIXED: Check if user manually marked this number - use markedPositions array
  const isManuallyMarked = (number: number): boolean => {
    // Convert markedPositions (0-24) to actual numbers from the card
    if (card.markedPositions && card.numbers) {
      const flatNumbers = card.numbers.flat();
      return card.markedPositions.some(position => flatNumbers[position] === number);
    }
    return false;
  };

  // FIXED: A number is visually marked if it's either automatically marked OR manually marked
  const isVisuallyMarked = (number: number): boolean => {
    return shouldBeAutomaticallyMarked(number) || isManuallyMarked(number);
  };

  // FIXED: Check if number can be manually marked (called after join for late joiners)
  const canBeManuallyMarked = (number: number) => {
    if (!isLateJoiner) return calledNumbers.includes(number);
    return calledNumbers.includes(number) && !wasCalledBeforeJoin(number);
  };

  const handleNumberClick = (number: number) => {
    // Don't allow clicking if:
    // - Not interactive
    // - Already manually marked
    // - Number can't be manually marked (for late joiners: pre-called numbers)
    if (!isInteractive || isManuallyMarked(number) || !canBeManuallyMarked(number)) return;
    
    onMarkNumber(number);
  };

  // FIXED: Get visual status for each number
  const getNumberStatus = (number: number) => {
    const automaticallyMarked = shouldBeAutomaticallyMarked(number);
    const manuallyMarked = isManuallyMarked(number);
    const visuallyMarked = automaticallyMarked || manuallyMarked;
    const preCalled = isLateJoiner && wasCalledBeforeJoin(number);
    const canMark = canBeManuallyMarked(number) && !manuallyMarked;

    return {
      automaticallyMarked,
      manuallyMarked,
      visuallyMarked,
      preCalled,
      canMark,
      // Show green checkmark if automatically OR manually marked
      shouldShowMarked: visuallyMarked,
      // Show as pre-called background for late joiners (subtle indication)
      shouldShowPreCalled: isLateJoiner && preCalled && !manuallyMarked,
      // Show as interactive (orange pulse) if can be manually marked
      shouldShowInteractive: canMark && isInteractive,
    };
  };

  // Group numbers by column for better organization
  const numbersByColumn = {
    B: allNumbers.filter(n => n >= 1 && n <= 15),
    I: allNumbers.filter(n => n >= 16 && n <= 30),
    N: allNumbers.filter(n => n >= 31 && n <= 45),
    G: allNumbers.filter(n => n >= 46 && n <= 60),
    O: allNumbers.filter(n => n >= 61 && n <= 75)
  };

  // Calculate marked count
  const markedCount = allNumbers.filter(n => isVisuallyMarked(n)).length;

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
            className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20"
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full font-bold text-xs shadow-lg flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Late Joiner
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
            className={`absolute -top-4 left-1/2 transform -translate-x-1/2 z-20 ${isLateJoiner ? 'mt-4' : ''}`}
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1 rounded-full font-black text-xs shadow-2xl flex items-center gap-1">
              <Sparkles className="w-3 h-3 fill-white" />
              {isLateJoiner ? 'LATE BINGO! 🎯' : 'BINGO!'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-4 border-2 border-telegram-button relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-3">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-red-400" />
        </div>

        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-1">
            <Grid3X3 className="w-4 h-4 text-telegram-button" />
            <span className="hidden xs:inline">All Numbers</span>
            <span className="xs:hidden">Bingo</span>
          </h3>
          <div className="text-xs text-gray-500 font-medium">
            {markedCount}/75
          </div>
        </div>

        {/* Late Joiner Info - Compact */}
        {isLateJoiner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-3 p-2 bg-yellow-50 rounded-lg border border-yellow-200"
          >
            <div className="flex items-center gap-1 text-yellow-800 text-xs">
              <Clock className="w-3 h-3" />
              <span className="font-medium">
                {effectiveCalledNumbers.length} numbers auto-marked
              </span>
            </div>
          </motion.div>
        )}

        {/* BINGO Header - Compact */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {['B', 'I', 'N', 'G', 'O'].map((letter) => (
            <motion.div
              key={letter}
              className="text-center font-black text-sm text-telegram-button bg-telegram-button/10 py-1 rounded-lg"
              initial={{ y: -5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              {letter}
            </motion.div>
          ))}
        </div>

        {/* All 75 Numbers Grid - Compact and Responsive */}
        <div className="grid grid-cols-5 gap-1 relative z-10 max-h-64 overflow-y-auto">
          {Object.entries(numbersByColumn).map(([letter, numbers]) => (
            <div key={letter} className="space-y-0.5">
              {numbers.map((number) => {
                const {
                  shouldShowMarked,
                  shouldShowPreCalled,
                  shouldShowInteractive,
                } = getNumberStatus(number);

                return (
                  <motion.div
                    key={number}
                    className={`
                      aspect-square rounded-lg flex items-center justify-center text-xs font-bold relative
                      border transition-all duration-200
                      ${shouldShowMarked 
                        ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-sm' 
                        : shouldShowPreCalled
                        ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 text-purple-600'
                        : shouldShowInteractive
                        ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 text-orange-700 shadow-xs hover:shadow-sm cursor-pointer'
                        : 'bg-white/80 border-gray-200 text-gray-500'
                      }
                      ${shouldShowInteractive ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                      ${isWinner && shouldShowMarked ? 'ring-1 ring-yellow-400' : ''}
                    `}
                    whileHover={shouldShowInteractive ? { 
                      scale: 1.05,
                    } : {}}
                    whileTap={{ scale: shouldShowInteractive ? 0.95 : 1 }}
                    onClick={() => handleNumberClick(number)}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ 
                      duration: 0.2,
                      type: "spring",
                      stiffness: 300
                    }}
                  >
                    <div className="text-center leading-none">
                      {number}
                    </div>
                    
                    {/* Mark Indicator - Compact */}
                    {shouldShowMarked && (
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.15, type: "spring" }}
                      >
                        <Check className="w-3 h-3 text-white drop-shadow-sm" />
                      </motion.div>
                    )}

                    {/* Pulse animation for numbers that can be manually marked */}
                    {shouldShowInteractive && (
                      <motion.div
                        className="absolute inset-0 rounded-lg border border-orange-400"
                        animate={{ 
                          scale: [1, 1.03, 1],
                          opacity: [0.2, 0.4, 0.2]
                        }}
                        transition={{ 
                          duration: 1.5, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}

                    {/* Winner celebration - Compact */}
                    {isWinner && shouldShowMarked && (
                      <motion.div
                        className="absolute inset-0 rounded-lg"
                        animate={{ 
                          boxShadow: [
                            '0 0 0 0 rgba(34, 197, 94, 0.5)',
                            '0 0 0 3px rgba(34, 197, 94, 0)',
                            '0 0 0 0 rgba(34, 197, 94, 0)'
                          ]
                        }}
                        transition={{ 
                          duration: 1.5, 
                          repeat: Infinity,
                          times: [0, 0.5, 1]
                        }}
                      />
                    )}

                    {/* Pre-called indicator for late joiners - Compact */}
                    {shouldShowPreCalled && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ opacity: 1, scale: 1 }}
                        className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-2xs px-1 py-0.5 rounded pointer-events-none z-20 whitespace-nowrap"
                      >
                        Auto
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-0.5 w-1 h-1 bg-purple-600 rotate-45" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Compact Progress Bar */}
        <motion.div 
          className="mt-3 space-y-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex justify-between items-center text-xs text-gray-600">
            <span>Progress</span>
            <span className="font-bold text-telegram-button">
              {Math.round((markedCount / 75) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <motion.div 
              className="bg-gradient-to-r from-green-400 to-teal-400 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(markedCount / 75) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
        </motion.div>

        {/* Compact Stats Footer */}
        <motion.div 
          className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 text-2xs text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div>
            <div>Called: {effectiveCalledNumbers.length}</div>
            {isLateJoiner && (
              <div className="text-gray-400">
                Pre: {numbersCalledAtJoin.length} • Post: {calledNumbers.length - numbersCalledAtJoin.length}
              </div>
            )}
          </div>
          
          {/* Compact Progress Dots */}
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => {
              const progressLevel = Math.min(5, Math.floor(markedCount / 15));
              
              return (
                <motion.div
                  key={i}
                  className={`w-1 h-1 rounded-full ${
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

        {/* Compact Late Joiner Legend */}
        {isLateJoiner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: 1.2 }}
            className="mt-2 pt-2 border-t border-gray-200"
          >
            <div className="flex items-center justify-center gap-2 text-2xs text-gray-500 flex-wrap">
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded"></div>
                <span>Auto</span>
              </div>
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 bg-purple-100 border border-purple-300 rounded"></div>
                <span>Pre-called</span>
              </div>
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 bg-orange-100 border border-orange-300 rounded"></div>
                <span>Can Mark</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
// components/BingoCard.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { BingoCard as BingoCardType } from '../../types';
import { Sparkles, Check } from 'lucide-react';

interface BingoCardProps {
  card: BingoCardType;
  calledNumbers: number[];
  onMarkNumber: (number: number) => void;
  isInteractive?: boolean;
  isWinner?: boolean;
}

export const BingoCard: React.FC<BingoCardProps> = ({
  card,
  calledNumbers,
  onMarkNumber,
  isInteractive = true,
  isWinner = false,
}) => {
  const isMarked = (row: number, col: number) => {
    const position = row * 5 + col;
    return card.markedPositions.includes(position);
  };

  const isCalled = (number: number) => calledNumbers.includes(number);

  const handleCellClick = (number: number, row: number, col: number) => {
    if (!isInteractive || isMarked(row, col) || !isCalled(number)) return;
    onMarkNumber(number);
  };

  const getColumnLetter = (col: number) => {
    const letters = ['B', 'I', 'N', 'G', 'O'];
    return letters[col];
  };

  return (
    <motion.div 
      className="relative"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Winner Crown */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20"
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-2 rounded-full font-black text-sm shadow-2xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 fill-white" />
              BINGO!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-6 border-4 border-telegram-button relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-red-400" />
        </div>

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
              const marked = isMarked(rowIndex, colIndex);
              const called = isCalled(number);
              const isFreeSpace = rowIndex === 2 && colIndex === 2;

              return (
                <motion.div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    aspect-square rounded-2xl flex items-center justify-center text-lg font-bold relative
                    border-3 transition-all duration-300 cursor-pointer
                    ${marked 
                      ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-lg scale-105' 
                      : called && isInteractive
                      ? 'bg-gradient-to-br from-orange-100 to-amber-100 border-orange-300 text-orange-800 shadow-md hover:shadow-lg'
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
                    number
                  )}
                  
                  {/* Mark Indicator */}
                  {marked && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, type: "spring" }}
                    >
                      <Check className="w-6 h-6 text-white drop-shadow-md" />
                    </motion.div>
                  )}

                  {/* Pulse animation for called numbers */}
                  {called && !marked && isInteractive && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-2 border-orange-400"
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
                  {isWinner && marked && (
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
            Marked: {card.markedPositions.length}/25
          </div>
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < Math.min(5, Math.floor(card.markedPositions.length / 5))
                    ? 'bg-green-400'
                    : 'bg-gray-300'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2 + i * 0.1 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
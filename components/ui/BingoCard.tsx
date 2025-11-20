// components/BingoCard.tsx
import { motion } from 'framer-motion';
import { BingoCard as BingoCardType } from '../../types';

interface BingoCardProps {
  card: BingoCardType;
  calledNumbers: number[];
  onMarkNumber: (number: number) => void;
  isInteractive?: boolean;
}

export const BingoCard: React.FC<BingoCardProps> = ({
  card,
  calledNumbers,
  onMarkNumber,
  isInteractive = true,
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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 border-2 border-telegram-button">
      <div className="grid grid-cols-5 gap-2">
        {card.numbers.map((row, rowIndex) =>
          row.map((number, colIndex) => {
            const marked = isMarked(rowIndex, colIndex);
            const called = isCalled(number);
            const isFreeSpace = rowIndex === 2 && colIndex === 2;

            return (
              <motion.div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  aspect-square rounded-xl flex items-center justify-center text-sm font-bold
                  border-2 transition-all duration-200 relative
                  ${marked 
                    ? 'bg-telegram-button text-telegram-buttonText border-telegram-button' 
                    : called && isInteractive
                    ? 'bg-orange-100 border-orange-300 text-orange-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                  }
                  ${isInteractive && called && !marked ? 'cursor-pointer hover:scale-105' : ''}
                `}
                whileTap={{ scale: isInteractive && called && !marked ? 0.95 : 1 }}
                onClick={() => handleCellClick(number, rowIndex, colIndex)}
              >
                {isFreeSpace ? (
                  <span className="text-xs text-center">FREE</span>
                ) : (
                  number
                )}
                
                {marked && (
                  <motion.div
                    className="absolute inset-0 bg-green-500 rounded-lg opacity-20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
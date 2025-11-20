// components/NumberGrid.tsx
import { motion } from 'framer-motion';

interface NumberGridProps {
  calledNumbers: number[];
  currentNumber?: number;
}

export const NumberGrid: React.FC<NumberGridProps> = ({
  calledNumbers,
  currentNumber,
}) => {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);

  const getNumberColor = (number: number) => {
    if (number === currentNumber) return 'bg-yellow-400 text-yellow-900';
    if (calledNumbers.includes(number)) return 'bg-telegram-button text-telegram-buttonText';
    return 'bg-gray-200 text-gray-600';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      <h3 className="text-lg font-bold text-center mb-4">Called Numbers</h3>
      <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
        {numbers.map((number) => (
          <motion.div
            key={number}
            className={`
              w-6 h-6 rounded text-xs flex items-center justify-center font-medium
              ${getNumberColor(number)}
              transition-colors duration-200
            `}
            whileHover={{ scale: 1.1 }}
            layout
          >
            {number}
          </motion.div>
        ))}
      </div>
      
      {currentNumber && (
        <motion.div
          className="mt-4 text-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <div className="text-4xl font-bold text-telegram-button">
            {currentNumber}
          </div>
          <div className="text-sm text-telegram-hint">Current Number</div>
        </motion.div>
      )}
    </div>
  );
};
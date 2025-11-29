import { motion } from 'framer-motion';
import { Grid3X3, RotateCcw, Check } from 'lucide-react';

interface BingoCardPreviewProps {
  cardNumber: number;
  numbers: (number | string)[][];
}

export const BingoCardPreview: React.FC<BingoCardPreviewProps> = ({ cardNumber, numbers }) => {
  const transformCardToRows = (columnBasedCard: (number | string)[][]) => {
    const rows = [];
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      for (let col = 0; col < 5; col++) {
        rowData.push(columnBasedCard[col][row]);
      }
      rows.push(rowData);
    }
    return rows;
  };

  const rows = transformCardToRows(numbers);

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-3 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black text-gray-800 flex items-center gap-1">
          <Grid3X3 className="w-3 h-3 text-telegram-button" />
          Your Card
        </h3>
        <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
          <RotateCcw className="w-2.5 h-2.5" />
          #{cardNumber}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-0.5 mb-1">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div
            key={letter}
            className="text-center font-black text-xs text-telegram-button bg-telegram-button/10 py-1 rounded-md"
          >
            {letter}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-0.5">
        {rows.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <motion.div
              key={`${rowIndex}-${colIndex}`}
              className={`
                aspect-square rounded-md flex items-center justify-center font-bold text-xs
                border transition-all duration-200 cursor-default relative
                ${cell === 'FREE' 
                  ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-sm' 
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {cell}
              
              {cell === 'FREE' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-2 h-2 text-white drop-shadow-sm" />
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-2 flex justify-between items-center text-[10px] text-gray-600 border-t border-gray-200 pt-2">
        <div className="text-center">
          <div className="font-black text-telegram-button">5×5</div>
          <div>Grid</div>
        </div>
        <div className="text-center">
          <div className="font-black text-gray-400">24</div>
          <div>Numbers</div>
        </div>
        <div className="text-center">
          <div className="font-black text-green-500">1</div>
          <div>FREE</div>
        </div>
      </div>
    </div>
  );
};
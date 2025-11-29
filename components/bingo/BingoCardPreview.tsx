import { motion } from 'framer-motion';
import { Grid3X3, RotateCcw, Check } from 'lucide-react';

interface BingoCardPreviewProps {
  cardNumber: number;
  numbers: (number | string)[][];
  size?: 'normal' | 'small'; // Add size prop
}

export const BingoCardPreview: React.FC<BingoCardPreviewProps> = ({ 
  cardNumber, 
  numbers,
  size = 'normal' // Default to normal size
}) => {
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

  // Size-based styling
  const containerClass = size === 'small' 
    ? "bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-sm p-2 border border-gray-200"
    : "bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-3 border border-gray-200";

  const headerClass = size === 'small' 
    ? "flex items-center justify-between mb-1"
    : "flex items-center justify-between mb-2";

  const titleClass = size === 'small'
    ? "text-xs font-black text-gray-800 flex items-center gap-1"
    : "text-sm font-black text-gray-800 flex items-center gap-1";

  const cardNumberClass = size === 'small'
    ? "flex items-center gap-1 text-xs text-gray-500 font-medium"
    : "flex items-center gap-1 text-xs text-gray-500 font-medium";

  const letterGridClass = size === 'small'
    ? "grid grid-cols-5 gap-0.5 mb-0.5"
    : "grid grid-cols-5 gap-0.5 mb-1";

  const letterClass = size === 'small'
    ? "text-center font-black text-xs text-telegram-button bg-telegram-button/10 py-0.5 rounded-sm"
    : "text-center font-black text-xs text-telegram-button bg-telegram-button/10 py-1 rounded-md";

  const cardGridClass = size === 'small'
    ? "grid grid-cols-5 gap-0.5"
    : "grid grid-cols-5 gap-0.5";

// Update the cellClass in BingoCardPreview component:
const cellClass = (cell: number | string) => size === 'small'
  ? `
      aspect-square rounded-sm flex items-center justify-center font-bold 
      border transition-all duration-200 cursor-default relative
      ${cell === 'FREE' 
        ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-xs text-[10px]' 
        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 text-[10px]'
      }
    `
  : `
      aspect-square rounded-md flex items-center justify-center font-bold text-xs
      border transition-all duration-200 cursor-default relative
      ${cell === 'FREE' 
        ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400 shadow-sm' 
        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
      }
    `;

  const footerClass = size === 'small'
    ? "mt-1 flex justify-between items-center text-[9px] text-gray-600 border-t border-gray-200 pt-1"
    : "mt-2 flex justify-between items-center text-[10px] text-gray-600 border-t border-gray-200 pt-2";

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <h3 className={titleClass}>
          <Grid3X3 className={size === 'small' ? "w-2.5 h-2.5 text-telegram-button" : "w-3 h-3 text-telegram-button"} />
          {size === 'small' ? 'Card' : 'Your Card'}
        </h3>
        <div className={cardNumberClass}>
          <RotateCcw className={size === 'small' ? "w-2 h-2" : "w-2.5 h-2.5"} />
          #{cardNumber}
        </div>
      </div>

      <div className={letterGridClass}>
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div
            key={letter}
            className={letterClass}
          >
            {letter}
          </div>
        ))}
      </div>

      <div className={cardGridClass}>
        {rows.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <motion.div
              key={`${rowIndex}-${colIndex}`}
              className={cellClass(cell)}
              whileHover={{ scale: size === 'small' ? 1.02 : 1.05 }}
              whileTap={{ scale: size === 'small' ? 0.98 : 0.95 }}
            >
              {cell}
              
              {cell === 'FREE' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className={size === 'small' ? "w-1.5 h-1.5 text-white drop-shadow-sm" : "w-2 h-2 text-white drop-shadow-sm"} />
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <div className={footerClass}>
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
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

interface AllBingoNumbersGridProps {
  calledNumbers?: number[];
}

export const AllBingoNumbersGrid: React.FC<AllBingoNumbersGridProps> = ({ calledNumbers = [] }) => {
  const bingoRanges = [
    { letter: 'B', min: 1, max: 15 },
    { letter: 'I', min: 16, max: 30 },
    { letter: 'N', min: 31, max: 45 },
    { letter: 'G', min: 46, max: 60 },
    { letter: 'O', min: 61, max: 75 }
  ];

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-white flex items-center gap-1">
          <Target className="w-3 h-3 text-yellow-400" />
          All Numbers
        </h3>
        <div className="text-xs text-gray-400 font-medium">
          {calledNumbers.length}/75 Called
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 mb-2">
        {bingoRanges.map((range) => (
          <div
            key={range.letter}
            className="text-center font-black text-xs text-yellow-400 bg-yellow-400/10 py-1 rounded-md"
          >
            {range.letter}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {bingoRanges.map((range, colIndex) => (
          <div key={range.letter} className="space-y-0.5">
            {Array.from({ length: 15 }, (_, i) => range.min + i).map((number, index) => {
              const isCalled = calledNumbers.includes(number);
              
              return (
                <motion.div
                  key={number}
                  className={`
                    aspect-square rounded-md flex items-center justify-center font-bold text-[10px]
                    border transition-all duration-200 cursor-default
                    ${isCalled 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-500 shadow-sm' 
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {number}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-600 pt-2">
        <div className="text-center">
          <div className="font-black text-green-400">{calledNumbers.length}</div>
          <div>Called</div>
        </div>
        <div className="text-center">
          <div className="font-black text-gray-300">75</div>
          <div>Total</div>
        </div>
        <div className="text-center">
          <div className="font-black text-yellow-400">{75 - calledNumbers.length}</div>
          <div>Remaining</div>
        </div>
      </div>
    </div>
  );
};
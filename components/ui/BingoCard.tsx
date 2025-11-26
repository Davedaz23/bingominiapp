// components/ui/BingoCard.tsx - SIMPLIFIED VERSION
import { Check, Grid3X3 } from 'lucide-react';

interface BingoCardProps {
  calledNumbers: number[];
  currentNumber?: number;
}

export const BingoCard: React.FC<BingoCardProps> = ({
  calledNumbers,
  currentNumber
}) => {
  // Create a flat array of all 75 numbers (1-75)
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

  // Calculate marked count
  const markedCount = calledNumbers.length;

  // Group numbers by column for better organization
  const numbersByColumn = {
    B: allNumbers.filter(n => n >= 1 && n <= 15),
    I: allNumbers.filter(n => n >= 16 && n <= 30),
    N: allNumbers.filter(n => n >= 31 && n <= 45),
    G: allNumbers.filter(n => n >= 46 && n <= 60),
    O: allNumbers.filter(n => n >= 61 && n <= 75)
  };

  return (
    <div className="relative">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-3 border border-telegram-button relative overflow-hidden">
        {/* Ultra Compact Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-black text-gray-800 flex items-center gap-1">
            <Grid3X3 className="w-3 h-3 text-telegram-button" />
            <span>All Numbers</span>
          </h3>
          <div className="text-xs text-gray-500 font-medium">
            {markedCount}/75
          </div>
        </div>

        {/* BINGO Header - Ultra Compact */}
        <div className="grid grid-cols-5 gap-0.5 mb-1">
          {['B', 'I', 'N', 'G', 'O'].map((letter) => (
            <div
              key={letter}
              className="text-center font-black text-xs text-telegram-button bg-telegram-button/10 py-1 rounded"
            >
              {letter}
            </div>
          ))}
        </div>

        {/* All 75 Numbers Grid */}
        <div className="grid grid-cols-5 gap-0.5 relative z-10 h-80 overflow-y-auto thin-scrollbar">
          {Object.entries(numbersByColumn).map(([letter, numbers]) => (
            <div key={letter} className="space-y-0.5">
              {numbers.map((number) => {
                const isCalled = calledNumbers.includes(number);
                const isCurrent = number === currentNumber;

                return (
                  <div
                    key={number}
                    className={`
                      h-6 rounded flex items-center justify-center text-[10px] font-bold relative
                      border transition-all duration-150
                      ${isCalled 
                        ? 'bg-gradient-to-br from-green-400 to-teal-400 text-white border-green-400' 
                        : 'bg-white/80 border-gray-200 text-gray-500'
                      }
                      ${isCurrent ? 'ring-2 ring-yellow-400' : ''}
                      cursor-default
                    `}
                  >
                    <div className="text-center leading-none font-medium">
                      {number}
                    </div>
                    
                    {/* Mark Indicator */}
                    {isCalled && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-2 h-2 text-white drop-shadow-sm" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mt-2 space-y-1">
          <div className="flex justify-between items-center text-2xs text-gray-600">
            <span>Progress</span>
            <span className="font-bold text-telegram-button">
              {Math.round((markedCount / 75) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-gradient-to-r from-green-400 to-teal-400 h-1 rounded-full transition-all duration-300"
              style={{ width: `${(markedCount / 75) * 100}%` }}
            />
          </div>
        </div>

        {/* Stats Footer */}
        <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-200 text-[8px] text-gray-500">
          <div>
            <div>Called: {calledNumbers.length}</div>
          </div>
          
          {/* Progress Dots */}
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => {
              const progressLevel = Math.min(5, Math.floor(markedCount / 15));
              
              return (
                <div
                  key={i}
                  className={`w-1 h-1 rounded-full ${
                    i < progressLevel ? 'bg-green-400' : 'bg-gray-300'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .thin-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .thin-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
};
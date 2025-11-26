// components/ui/NumberGrid.tsx - OPTIMIZED VERSION
import { memo } from 'react';

interface NumberGridProps {
  calledNumbers: number[];
  currentNumber?: number;
}

const GridNumber = memo(({ 
  number, 
  isCalled, 
  isCurrent 
}: { 
  number: number; 
  isCalled: boolean; 
  isCurrent: boolean; 
}) => {
  const getNumberColor = () => {
    if (isCurrent) return 'bg-yellow-400 text-yellow-900 shadow-lg scale-110';
    if (isCalled) return 'bg-gradient-to-br from-telegram-button to-blue-600 text-white shadow-md';
    return 'bg-gray-200 text-gray-600 hover:bg-gray-300';
  };

  const getNumberSize = () => {
    if (isCurrent) return 'w-5 h-5 text-[10px]';
    return 'w-4 h-4 text-[8px]';
  };

  return (
    <div
      className={`
        rounded-md flex items-center justify-center font-bold
        ${getNumberColor()} ${getNumberSize()}
        transition-all duration-300 cursor-default
        relative overflow-hidden
      `}
    >
      {number}
    </div>
  );
});

GridNumber.displayName = 'GridNumber';

export const NumberGrid: React.FC<NumberGridProps> = memo(({
  calledNumbers,
  currentNumber
}) => {
  const numbers = Array.from({ length: 400 }, (_, i) => i + 1);

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-xl p-4 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-black text-gray-800">All Numbers (1-400)</h3>
        
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <div className="text-center">
            <div className="font-black text-telegram-button">{calledNumbers.length}</div>
            <div className="text-[10px]">Called</div>
          </div>
          <div className="text-center">
            <div className="font-black text-gray-400">{400 - calledNumbers.length}</div>
            <div className="text-[10px]">Remaining</div>
          </div>
        </div>
      </div>

      {/* Numbers Grid - All 400 numbers */}
      <div className="grid grid-cols-20 gap-1 max-h-80 overflow-y-auto p-2 bg-gray-50 rounded-xl">
        {numbers.map((number) => (
          <GridNumber
            key={number}
            number={number}
            isCalled={calledNumbers.includes(number)}
            isCurrent={number === currentNumber}
          />
        ))}
      </div>

      {/* Current Number Display */}
      {currentNumber && (
        <div className="mt-4 text-center bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-3 shadow-xl border-2 border-white">
          <div className="text-white/80 text-xs font-bold mb-1">CURRENT NUMBER</div>
          <div className="text-4xl font-black text-white drop-shadow-lg">
            {currentNumber}
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-3 flex justify-between items-center text-xs text-gray-600">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="font-black text-base text-telegram-button">
              {calledNumbers.length}
            </div>
            <div className="text-[10px]">Total Called</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-telegram-button rounded"></div>
            <span>Called</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-400 rounded"></div>
            <span>Current</span>
          </div>
        </div>
      </div>
    </div>
  );
});

NumberGrid.displayName = 'NumberGrid';
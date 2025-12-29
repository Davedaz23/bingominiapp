// app/components/BingoCardDisplay.tsx
import { BingoCard as BingoCardType } from '../types';

interface BingoCardProps {
  card: BingoCardType;
  calledNumbers: number[];
}

export default function BingoCardDisplay({ card, calledNumbers }: BingoCardProps) {
  // Safe default for calledNumbers
  const safeCalledNumbers = calledNumbers || [];

  // Transform column-based data to row-based for display
  // The card.numbers is [columns][rows], but we need [rows][columns] for display
  const rows = [];
  if (card.numbers && card.numbers.length > 0) {
    // Assuming 5x5 grid
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      for (let col = 0; col < 5; col++) {
        // For column 2 (N), row 2 is FREE
        if (col === 2 && row === 2) {
          rowData.push('FREE');
        } else {
          // Access as card.numbers[column][row]
          rowData.push(card.numbers[col]?.[row] || '');
        }
      }
      rows.push(rowData);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-md mx-auto">
      {/* Header row with BINGO letters */}
      <div className="grid grid-cols-5 gap-1 mb-2">
        {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
          <div
            key={letter}
            className="aspect-square flex items-center justify-center rounded bg-blue-500 text-white font-bold text-sm"
          >
            {letter}
          </div>
        ))}
      </div>
      
      {/* Bingo numbers grid */}
      <div className="grid grid-cols-5 gap-1">
        {rows.map((row, rowIndex) =>
          row.map((number, colIndex) => {
            const isSelected = typeof number === 'number' && safeCalledNumbers.includes(number);
            const isFreeSpace = rowIndex === 2 && colIndex === 2;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  aspect-square flex items-center justify-center rounded border-2
                  text-sm font-bold transition-all
                  ${isFreeSpace 
                    ? 'bg-green-500 text-white border-green-600' 
                    : isSelected
                    ? 'bg-blue-500 text-white border-blue-600'
                    : 'bg-gray-100 text-gray-800 border-gray-300'
                  }
                  ${isFreeSpace ? 'text-xs' : ''}
                `}
              >
                {isFreeSpace ? 'FREE' : number || ''}
              </div>
            );
          })
        )}
      </div>
      
      <div className="mt-3 text-center text-sm text-gray-600">
        Card #{card.id}
      </div>
    </div>
  );
}
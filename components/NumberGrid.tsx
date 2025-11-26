// app/components/NumberGrid.tsx
interface NumberGridProps {
  calledNumbers: number[];
  currentNumber: number | null;
}

export default function NumberGrid({ calledNumbers, currentNumber }: NumberGridProps) {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const safeCalledNumbers = calledNumbers || [];
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-bold text-center mb-3 text-gray-800">
        Called Numbers
      </h3>
      
      {currentNumber && (
        <div className="text-center mb-4">
          <div className="inline-block bg-red-500 text-white px-4 py-2 rounded-full text-xl font-bold animate-pulse">
            Current: {currentNumber}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-10 gap-1 max-h-64 overflow-y-auto">
        {numbers.map((number) => (
          <div
            key={number}
            className={`
              aspect-square flex items-center justify-center rounded text-sm font-bold
              ${safeCalledNumbers.includes(number)
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700'
              }
            `}
          >
            {number}
          </div>
        ))}
      </div>
    </div>
  );
}
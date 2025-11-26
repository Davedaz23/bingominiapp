// app/components/NumberSelection.tsx
import { BingoCard } from '../types';

interface NumberSelectionProps {
  cards: BingoCard[];
  userBalance: number;
  betAmount: number;
  onCardSelect: (cardId: string) => void;
  selectedCardId: string | null;
}

export default function NumberSelection({ 
  cards, 
  userBalance, 
  betAmount, 
  onCardSelect, 
  selectedCardId 
}: NumberSelectionProps) {
  const canSelect = userBalance >= betAmount;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
        Select Your Bingo Card
      </h2>
      
      {!canSelect && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Insufficient balance. You need {betAmount} ብር to play.
        </div>
      )}
      
      <div className="grid grid-cols-8 gap-2 max-h-96 overflow-y-auto">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => canSelect && onCardSelect(card.id)}
            disabled={!canSelect || selectedCardId === card.id}
            className={`p-2 rounded text-sm font-medium transition-all ${
              selectedCardId === card.id
                ? 'bg-green-500 text-white'
                : canSelect
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {card.id}
          </button>
        ))}
      </div>
      
      {selectedCardId && (
        <div className="mt-4 text-center">
          <p className="text-green-600 font-semibold">
            Selected Card: #{selectedCardId}
          </p>
        </div>
      )}
    </div>
  );
}
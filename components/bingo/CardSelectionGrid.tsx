// components/bingo/CardSelectionGrid.tsx - UPDATED
import { motion } from 'framer-motion';

interface CardSelectionGridProps {
  availableCards: Array<{cardIndex: number, numbers: (number | string)[][], preview?: any}>;
  takenCards: {cardNumber: number, userId: string}[];
  selectedNumber: number | null;
  walletBalance: number;
  gameStatus: string;
  onCardSelect: (cardNumber: number) => void;
}

export const CardSelectionGrid: React.FC<CardSelectionGridProps> = ({
  availableCards,
  takenCards,
  selectedNumber,
  walletBalance,
  gameStatus,
  onCardSelect
}) => {
  // Extract just the card numbers from availableCards objects
  const availableCardNumbers = availableCards.map(card => card.cardIndex);

  return (
    <motion.div 
      className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
        const isTaken = takenCards.some(card => card.cardNumber === number);
        const isAvailable = availableCardNumbers.includes(number);
        const canSelect = walletBalance >= 10;
        const isSelectable = canSelect && isAvailable && !isTaken;

        return (
          <motion.button
            key={number}
            onClick={() => isSelectable && onCardSelect(number)}
            disabled={!isSelectable}
            className={`
              aspect-square rounded-xl font-bold text-sm transition-all relative
              ${isTaken
                ? 'bg-red-500/50 text-white/50 cursor-not-allowed border-red-400/50'
                : isSelectable
                ? gameStatus === 'ACTIVE' 
                  ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                  : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
              }
              border-2
              ${!isSelectable ? 'opacity-50' : ''}
            `}
            whileHover={isSelectable ? { scale: 1.05 } : {}}
            whileTap={isSelectable ? { scale: 0.95 } : {}}
            layout
          >
            {number}
            
            {isTaken && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 text-red-300">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
            
            {!isTaken && isSelectable && gameStatus === 'ACTIVE' && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            )}
            
            {!isTaken && !isSelectable && walletBalance < 10 && (
              <div className="absolute inset-0 flex items-center justify-center opacity-60">
                <div className="w-3 h-3 text-yellow-400">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
};
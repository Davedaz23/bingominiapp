/* eslint-disable @typescript-eslint/no-explicit-any */
// components/bingo/CardSelectionGrid.tsx - UPDATED
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

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
  // Create a map of taken cards for quick lookup
  const takenCardMap = new Map();
  takenCards.forEach(card => {
    takenCardMap.set(card.cardNumber, card);
  });

  const handleCardClick = (cardNumber: number) => {
    const isTaken = takenCardMap.has(cardNumber);
    const isAvailable = availableCards.some(card => card.cardIndex === cardNumber);
    const canSelect = walletBalance >= 10;
    const isSelectable = canSelect && isAvailable && !isTaken;

    if (!isSelectable) return;
    
    // Toggle selection: if clicking the same card, deselect it
    if (selectedNumber === cardNumber) {
      onCardSelect(null);
    } else {
      onCardSelect(cardNumber);
    }
  };

  return (
    <div className="mb-4">
      <motion.div 
        className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
          const isTaken = takenCardMap.has(number);
          const isAvailable = availableCards.some(card => card.cardIndex === number);
          const canSelect = walletBalance >= 10;
          const isSelectable = canSelect && isAvailable && !isTaken;
          const isSelected = selectedNumber === number;

          return (
            <motion.button
              key={number}
              onClick={() => handleCardClick(number)}
              disabled={!isSelectable}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isSelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : isTaken
                  ? 'bg-red-500/80 text-white cursor-not-allowed border-red-500 shadow-md'
                  : isSelectable
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-white/20 text-white hover:bg-white/30 hover:scale-105 hover:shadow-md cursor-pointer border-white/20'
                    : 'bg-white/20 text-white hover:bg-white/30 hover:scale-105 hover:shadow-md cursor-pointer border-white/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
                ${isTaken ? 'animate-pulse' : ''}
              `}
              whileHover={isSelectable ? { scale: 1.05 } : {}}
              whileTap={isSelectable ? { scale: 0.95 } : {}}
              layout
            >
              {number}
              
              {/* Selection indicator - only shows when card is clicked and selected */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Taken indicator - shows immediately when card is taken */}
              {isTaken && !isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 text-red-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Available for selection indicator (only when game is active) */}
              {!isTaken && isSelectable && gameStatus === 'ACTIVE' && !isSelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              )}
              
              {/* Insufficient balance indicator */}
              {!isTaken && !isSelectable && walletBalance < 10 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-3 h-3 text-yellow-400">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Show available indicator */}
              {isAvailable && !isTaken && canSelect && !isSelected && (
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full"></div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Real-time status */}
      <div className="text-center text-white/60 text-sm mb-3">
        <div className="flex justify-center gap-4">
          <span>✅ {availableCards.length} available</span>
          <span>❌ {takenCards.length} taken</span>
          <span>⏳ {400 - availableCards.length - takenCards.length} inactive</span>
        </div>
        <div className="text-xs text-white/40 mt-1">
          Updates in real-time • Click to select/deselect
        </div>
      </div>

      {/* Selection Info - Only shows when a card is selected */}
      {selectedNumber && (
        <motion.div 
          className="bg-telegram-button/20 backdrop-blur-lg rounded-2xl p-3 mb-3 border border-telegram-button/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-telegram-button" />
              <p className="text-telegram-button font-bold text-sm">Card #{selectedNumber} Selected</p>
            </div>
            <p className="text-telegram-button/80 text-xs">
              Click again to deselect • Click another to change
            </p>
          </div>
        </motion.div>
      )}
      
      {/* No selection info - shows when no card is selected */}
      {!selectedNumber && (
        <motion.div 
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 mb-3 border border-white/20"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-telegram-button/50 rounded-full animate-pulse"></div>
            <p className="text-white/70 text-sm">Click on an available card to select it</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
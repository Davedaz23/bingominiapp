/* eslint-disable @typescript-eslint/no-explicit-any */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';

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
  // State to track locally taken cards (for immediate visual feedback)
  const [locallyTakenCards, setLocallyTakenCards] = useState<number[]>([]);
  
  // Create a map of taken cards for quick lookup
  const takenCardMap = new Map();
  
  // First, add server-side taken cards
  takenCards.forEach(card => {
    takenCardMap.set(card.cardNumber, card);
  });
  
  // Then, add locally taken cards (these will override for visual purposes)
  locallyTakenCards.forEach(cardNumber => {
    if (!takenCardMap.has(cardNumber)) {
      // Mark as taken locally with a temporary flag
      takenCardMap.set(cardNumber, { cardNumber, userId: 'local', isLocal: true });
    }
  });

  const handleCardSelect = (cardNumber: number) => {
    const isTaken = takenCardMap.has(cardNumber) && !takenCardMap.get(cardNumber).isLocal;
    
    if (!isTaken) {
      // Immediately mark as taken locally for visual feedback
      setLocallyTakenCards(prev => [...prev, cardNumber]);
      
      // Call the original handler (which will make the backend call)
      onCardSelect(cardNumber);
      
      // Note: If the backend call fails, we should remove from locallyTakenCards
      // This would typically be handled by the parent component via a callback or error handling
    }
  };

  // Function to reset local state if needed (e.g., when selection is confirmed/canceled)
  const resetLocalState = () => {
    setLocallyTakenCards([]);
  };

  // Optional: Listen for changes in selectedNumber to reset local state when selection changes
  // This can be added as an effect if needed

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
          const isLocalTaken = isTaken && takenCardMap.get(number).isLocal;
          const isServerTaken = isTaken && !takenCardMap.get(number).isLocal;
          const isAvailable = availableCards.some(card => card.cardIndex === number);
          const canSelect = walletBalance >= 10;
          
          // Card is selectable if:
          // 1. User has enough balance
          // 2. Card is available
          // 3. Card is NOT taken on server (local taken is okay since user is taking it)
          const isSelectable = canSelect && isAvailable && !isServerTaken;
          
          const isCurrentlySelected = selectedNumber === number;
          const takenBy = isTaken ? takenCardMap.get(number) : null;

          return (
            <motion.button
              key={number}
              onClick={() => isSelectable && handleCardSelect(number)}
              disabled={!isSelectable}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isCurrentlySelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : isServerTaken
                  ? 'bg-red-500/80 text-white cursor-not-allowed border-red-500 shadow-md'
                  : isLocalTaken
                  ? 'bg-amber-500/70 text-white border-amber-500/70 cursor-pointer shadow-lg' // Different color for local taken
                  : isSelectable
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                    : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isCurrentlySelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
                ${isLocalTaken ? 'animate-pulse' : ''}
              `}
              whileHover={isSelectable && !isLocalTaken ? { scale: 1.05 } : {}}
              whileTap={isSelectable && !isLocalTaken ? { scale: 0.95 } : {}}
              layout
            >
              {number}
              
              {/* Current selection indicator */}
              {isCurrentlySelected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Server taken indicator */}
              {isServerTaken && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 text-red-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Local taken indicator (processing) */}
              {isLocalTaken && !isCurrentlySelected && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 text-amber-300 animate-spin">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border border-white animate-ping"></div>
                </>
              )}
              
              {/* Available for selection indicator */}
              {!isTaken && isSelectable && gameStatus === 'ACTIVE' && !isCurrentlySelected && (
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
              {isAvailable && !isTaken && canSelect && !isCurrentlySelected && (
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Real-time status - include local taken cards */}
      <div className="text-center text-white/60 text-sm mb-3">
        <div className="flex justify-center gap-4">
          <span>✅ {availableCards.length} available</span>
          <span className="relative">
            ❌ {takenCards.length + locallyTakenCards.length} taken
            {locallyTakenCards.length > 0 && (
              <span className="absolute -top-2 -right-3 text-xs bg-amber-500 text-white px-1 rounded-full">
                +{locallyTakenCards.length}
              </span>
            )}
          </span>
          <span>⏳ {400 - availableCards.length - takenCards.length - locallyTakenCards.length} inactive</span>
        </div>
        <div className="text-xs text-white/40 mt-1">
          Updates in real-time • Refresh automatically
          {locallyTakenCards.length > 0 && (
            <span className="text-amber-400 ml-2">
              • Processing {locallyTakenCards.length} selection{locallyTakenCards.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Selection Info */}
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
              Click another card to change selection
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
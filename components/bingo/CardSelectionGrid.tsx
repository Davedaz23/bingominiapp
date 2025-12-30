/* eslint-disable @typescript-eslint/no-explicit-any */
// components/bingo/CardSelectionGrid.tsx - UPDATED with immediate UI feedback + real-time status
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';

interface CardSelectionGridProps {
  availableCards: Array<{cardIndex: number, numbers: (number | string)[][], preview?: any}>;
  takenCards: {cardNumber: number, userId: string}[];
  selectedNumber: number | null;
  walletBalance: number;
  gameStatus: string;
  onCardSelect: (cardNumber: number) => Promise<boolean>; // Changed to async
}

export const CardSelectionGrid: React.FC<CardSelectionGridProps> = ({
  availableCards,
  takenCards,
  selectedNumber,
  walletBalance,
  gameStatus,
  onCardSelect
}) => {
  // Local state for immediate UI feedback
  const [locallyTakenCards, setLocallyTakenCards] = useState<Set<number>>(new Set());
  const [processingCards, setProcessingCards] = useState<Set<number>>(new Set());

  // Create a map of taken cards for quick lookup
  const takenCardMap = new Map();
  takenCards.forEach(card => {
    takenCardMap.set(card.cardNumber, card);
  });

  // Combine server and local taken cards
  const isCardTaken = (cardNumber: number): boolean => {
    return takenCardMap.has(cardNumber) || locallyTakenCards.has(cardNumber);
  };

const handleCardSelect = async (cardNumber: number) => {
  // Check if already taken or processing
  if (isCardTaken(cardNumber) || processingCards.has(cardNumber)) {
    return;
  }

  // If selecting a different card, clear previous locally taken card
  if (selectedNumber && selectedNumber !== cardNumber && locallyTakenCards.has(selectedNumber)) {
    setLocallyTakenCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(selectedNumber);
      return newSet;
    });
  }

  // Add to processing set immediately
  setProcessingCards(prev => new Set(prev).add(cardNumber));

  try {
    // Call the async onCardSelect function
    const success = await onCardSelect(cardNumber);
    
    if (success) {
      // If successful, mark as locally taken
      setLocallyTakenCards(prev => new Set(prev).add(cardNumber));
    } else {
      // If failed, remove from locally taken and processing
      setLocallyTakenCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardNumber);
        return newSet;
      });
    }
  } catch (error) {
    console.error('Card selection failed:', error);
    // Remove from locally taken and processing on error
    setLocallyTakenCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(cardNumber);
      return newSet;
    });
  } finally {
    // Remove from processing after a delay (for visual feedback)
    setTimeout(() => {
      setProcessingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardNumber);
        return newSet;
      });
    }, 1500);
  }
};

  // Calculate counts
  const totalTakenCards = takenCards.length + locallyTakenCards.size;
  const inactiveCards = 400 - availableCards.length - totalTakenCards;

  return (
    <div className="mb-4">
      <motion.div 
        className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
          const isTaken = isCardTaken(number);
          const isProcessing = processingCards.has(number);
          const isAvailable = availableCards.some(card => card.cardIndex === number);
          const canSelect = walletBalance >= 10;
          const isSelectable = canSelect && isAvailable && !isTaken && !isProcessing;
          const isCurrentlySelected = selectedNumber === number;
          const takenBy = takenCardMap.get(number);

          return (
            <motion.button
              key={number}
              onClick={() => isSelectable && handleCardSelect(number)}
              disabled={!isSelectable}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isProcessing
                  ? 'bg-gradient-to-br from-yellow-500 to-amber-500 text-white border-yellow-500 shadow-lg cursor-wait'
                  : isCurrentlySelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : isTaken
                  ? 'bg-red-500/80 text-white cursor-not-allowed border-red-500 shadow-md'
                  : isSelectable
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                    : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isCurrentlySelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
                ${isTaken ? 'animate-pulse' : ''}
              `}
              whileHover={isSelectable && !isProcessing ? { scale: 1.05 } : {}}
              whileTap={isSelectable && !isProcessing ? { scale: 0.95 } : {}}
              layout
            >
              {number}
              
              {/* Processing indicator - just spinner on card */}
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                </div>
              )}
              
              {/* Current selection indicator */}
              {isCurrentlySelected && !isProcessing && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Taken indicator - shows immediately when card is taken */}
              {isTaken && !isProcessing && !isCurrentlySelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 text-red-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Available for selection indicator */}
              {!isTaken && isSelectable && gameStatus === 'ACTIVE' && !isCurrentlySelected && !isProcessing && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              )}
              
              {/* Insufficient balance indicator */}
              {!isTaken && !isSelectable && walletBalance < 10 && !isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-3 h-3 text-yellow-400">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Show available indicator */}
              {isAvailable && !isTaken && canSelect && !isCurrentlySelected && !isProcessing && (
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Real-time status */}
      <div className="text-center text-white/60 text-sm mb-3">
        <div className="flex justify-center gap-4">
          <span>✅ {availableCards.length} available</span>
          <span>❌ {totalTakenCards} taken</span>
          <span>🔄 {processingCards.size} selecting</span>
          <span>⏳ {inactiveCards} inactive</span>
        </div>
        <div className="text-xs text-white/40 mt-1">
          Updates in real-time • Refresh automatically
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
              {processingCards.has(selectedNumber) 
                ? 'Processing your selection...' 
                : 'Click another card to change selection'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
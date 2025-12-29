/* eslint-disable @typescript-eslint/no-explicit-any */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState, useEffect } from 'react'; // Added useState and useEffect

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
  // State to track locally taken cards for immediate visual feedback
  const [localTakenCards, setLocalTakenCards] = useState<Map<number, {cardNumber: number, userId: string}>>(new Map());
  const [lastSelectedCard, setLastSelectedCard] = useState<number | null>(null);

  // Sync with props
  useEffect(() => {
    const takenCardMap = new Map();
    takenCards.forEach(card => {
      takenCardMap.set(card.cardNumber, card);
    });
    setLocalTakenCards(takenCardMap);
  }, [takenCards]);

  // Handle immediate visual feedback on card selection
  const handleCardClick = (cardNumber: number) => {
    const isAvailable = availableCards.some(card => card.cardIndex === cardNumber);
    const canSelect = walletBalance >= 10;
    
    if (!isAvailable || !canSelect) return;

    // Release previous selection if exists
    if (lastSelectedCard && lastSelectedCard !== cardNumber) {
      const newTakenCards = new Map(localTakenCards);
      newTakenCards.delete(lastSelectedCard);
      setLocalTakenCards(newTakenCards);
    }

    // Immediately mark new card as taken locally
    const newTakenCards = new Map(localTakenCards);
    newTakenCards.set(cardNumber, {
      cardNumber,
      userId: 'current-user' // Placeholder - you can use actual user ID if available
    });
    setLocalTakenCards(newTakenCards);
    setLastSelectedCard(cardNumber);

    // Call the original onCardSelect
    onCardSelect(cardNumber);
  };

  // Combine local taken cards with backend taken cards for display
  const displayTakenCards = () => {
    const combined = new Map(localTakenCards);
    
    // Add backend taken cards (these override local if there's a conflict)
    takenCards.forEach(card => {
      combined.set(card.cardNumber, card);
    });
    
    return combined;
  };

  const takenCardMap = displayTakenCards();

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
          const isCurrentlySelected = selectedNumber === number;
          const takenBy = isTaken ? takenCardMap.get(number) : null;
          
          // Check if this is a locally taken card (for immediate visual feedback)
          const isLocallyTaken = localTakenCards.has(number) && 
            localTakenCards.get(number)?.userId === 'current-user';
          const isBackendTaken = takenCards.some(card => card.cardNumber === number);

          return (
            <motion.button
              key={number}
              onClick={() => handleCardClick(number)}
              disabled={!isSelectable && !isLocallyTaken}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isCurrentlySelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : isTaken
                  ? isLocallyTaken && !isBackendTaken
                    ? 'bg-purple-500/80 text-white border-purple-500 shadow-md cursor-pointer'
                    : 'bg-red-500/80 text-white cursor-not-allowed border-red-500 shadow-md'
                  : isSelectable
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                    : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isCurrentlySelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
                ${isLocallyTaken && !isBackendTaken ? 'animate-pulse' : ''}
              `}
              whileHover={isSelectable || isLocallyTaken ? { scale: 1.05 } : {}}
              whileTap={isSelectable || isLocallyTaken ? { scale: 0.95 } : {}}
              layout
            >
              {number}
              
              {/* Current selection indicator */}
              {isCurrentlySelected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Locally taken indicator (immediate feedback) */}
              {isLocallyTaken && !isBackendTaken && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 text-purple-200 animate-pulse">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Backend taken indicator */}
              {isBackendTaken && !isLocallyTaken && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 text-red-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
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
              
              {/* Pending selection indicator */}
              {isLocallyTaken && !isBackendTaken && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full border-2 border-white animate-ping"></div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Real-time status */}
      <div className="text-center text-white/60 text-sm mb-3">
        <div className="flex justify-center gap-4">
          <span>✅ {availableCards.length} available</span>
          <span>❌ {takenCardMap.size} taken</span>
          <span>⏳ {400 - availableCards.length - takenCardMap.size} inactive</span>
        </div>
        <div className="text-xs text-white/40 mt-1 flex items-center justify-center gap-2">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>Your selection</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>Taken by others</span>
          </span>
          <span>• Updates in real-time</span>
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
              {localTakenCards.has(selectedNumber) && !takenCards.some(card => card.cardNumber === selectedNumber)
                ? "Processing your selection..."
                : "Click another card to change selection"}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
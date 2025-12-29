/* eslint-disable @typescript-eslint/no-explicit-any */

import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CardSelectionGridProps {
  availableCards: Array<{cardIndex: number, numbers: (number | string)[][], preview?: any}>;
  takenCards: {cardNumber: number, userId: string}[];
  selectedNumber: number | null;
  walletBalance: number;
  gameStatus: string;
  onCardSelect: (cardNumber: number) => Promise<void>; // Changed to async
  pendingSelection?: number | null; // Track pending backend operation
}

export const CardSelectionGrid: React.FC<CardSelectionGridProps> = ({
  availableCards,
  takenCards,
  selectedNumber,
  walletBalance,
  gameStatus,
  onCardSelect,
  pendingSelection = null // Default to null
}) => {
  // Local state for optimistic updates
  const [optimisticSelected, setOptimisticSelected] = useState<number | null>(null);
  const [optimisticTakenCards, setOptimisticTakenCards] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedCard, setLastProcessedCard] = useState<number | null>(null);

  // Create a map of taken cards for quick lookup (including optimistic ones)
  const takenCardMap = new Map();
  
  // Add actual taken cards
  takenCards.forEach(card => {
    takenCardMap.set(card.cardNumber, card);
  });
  
  // Add optimistic taken cards
  optimisticTakenCards.forEach(cardNumber => {
    if (!takenCardMap.has(cardNumber)) {
      takenCardMap.set(cardNumber, { cardNumber, userId: 'optimistic' });
    }
  });

  // Reset optimistic state when backend confirms selection
  useEffect(() => {
    if (selectedNumber && optimisticSelected === selectedNumber) {
      // Backend confirmed our optimistic selection
      setOptimisticSelected(null);
      setIsProcessing(false);
      setLastProcessedCard(selectedNumber);
      
      // Remove from optimistic taken if it was added
      if (optimisticTakenCards.has(selectedNumber)) {
        setOptimisticTakenCards(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedNumber);
          return newSet;
        });
      }
    }
  }, [selectedNumber, optimisticSelected, optimisticTakenCards]);

  // Handle card selection with optimistic updates
  const handleCardSelect = async (cardNumber: number) => {
    // Don't allow new selection while processing
    if (isProcessing) return;
    
    // Check if card is available and not taken
    const isTaken = takenCardMap.has(cardNumber);
    const isAvailable = availableCards.some(card => card.cardIndex === cardNumber);
    const canSelect = walletBalance >= 10;
    
    // if (!isSelectable) return;
    
    // Start optimistic update
    setIsProcessing(true);
    
    // Optimistically mark as selected
    setOptimisticSelected(cardNumber);
    
    // If there was a previous optimistic selection, add it to taken
    if (lastProcessedCard && lastProcessedCard !== cardNumber) {
      setOptimisticTakenCards(prev => new Set(prev).add(lastProcessedCard));
    }
    
    try {
      // Call the async onCardSelect function
      await onCardSelect(cardNumber);
    } catch (error) {
      // Revert optimistic update on error
      console.error('Card selection failed:', error);
      setOptimisticSelected(null);
      setIsProcessing(false);
      
      // Show error feedback (you could add toast notification here)
      alert('Failed to select card. Please try again.');
    }
  };

  // Determine the actual display state
  const getCardState = (number: number) => {
    const isTaken = takenCardMap.has(number);
    const isAvailable = availableCards.some(card => card.cardIndex === number);
    const canSelect = walletBalance >= 10;
    const isSelectable = canSelect && isAvailable && !isTaken;
    
    // Check if this card is optimistically selected
    const isOptimisticallySelected = optimisticSelected === number;
    
    // Check if this card is being processed
    const isBeingProcessed = isProcessing && isOptimisticallySelected;
    
    // Show selected state optimistically or from backend
    const isCurrentlySelected = isOptimisticallySelected || (!isProcessing && selectedNumber === number);
    
    // If being processed, show loading state
    const isPending = pendingSelection === number || isBeingProcessed;
    
    return {
      isTaken,
      isAvailable,
      canSelect,
      isSelectable: isSelectable && !isProcessing, // Disable during processing
      isCurrentlySelected,
      isBeingProcessed,
      isPending,
      isOptimisticallySelected
    };
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
          const state = getCardState(number);
          
          return (
            <motion.button
              key={number}
              onClick={() => handleCardSelect(number)}
              disabled={!state.isSelectable || isProcessing}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${state.isCurrentlySelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : state.isPending
                  ? 'bg-yellow-500/60 text-white border-yellow-500 shadow-md'
                  : state.isTaken
                  ? 'bg-red-500/80 text-white cursor-not-allowed border-red-500 shadow-md'
                  : state.isSelectable
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                    : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
                }
                ${state.isCurrentlySelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
                ${state.isTaken && !state.isOptimisticallySelected ? 'animate-pulse' : ''}
                ${isProcessing ? 'cursor-wait' : ''}
              `}
              whileHover={state.isSelectable && !isProcessing ? { scale: 1.05 } : {}}
              whileTap={state.isSelectable && !isProcessing ? { scale: 0.95 } : {}}
              layout
            >
              {number}
              
              {/* Processing/Loading indicator */}
              {state.isBeingProcessed && (
                <div className="absolute inset-0 flex items-center justify-center bg-yellow-500/20 rounded-xl">
                  <Loader2 className="w-4 h-4 text-yellow-300 animate-spin" />
                </div>
              )}
              
              {/* Current selection indicator */}
              {state.isCurrentlySelected && !state.isBeingProcessed && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Taken indicator */}
              {state.isTaken && !state.isCurrentlySelected && !state.isOptimisticallySelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 text-red-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Available for selection indicator */}
              {!state.isTaken && state.isSelectable && gameStatus === 'ACTIVE' && !state.isCurrentlySelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              )}
              
              {/* Insufficient balance indicator */}
              {!state.isTaken && !state.isSelectable && walletBalance < 10 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-3 h-3 text-yellow-400">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Show available indicator */}
              {state.isAvailable && !state.isTaken && state.canSelect && !state.isCurrentlySelected && (
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
          <span>❌ {takenCardMap.size} taken</span>
          <span>⏳ {400 - availableCards.length - takenCardMap.size} inactive</span>
          {isProcessing && <span className="text-yellow-400">🔄 Processing...</span>}
        </div>
        <div className="text-xs text-white/40 mt-1">
          Updates in real-time • Refresh automatically
          {optimisticTakenCards.size > 0 && (
            <span className="text-yellow-400 ml-2">
              • Optimistic updates: {optimisticTakenCards.size}
            </span>
          )}
        </div>
      </div>

      {/* Selection Info */}
      {(selectedNumber || optimisticSelected) && (
        <motion.div 
          className={`
            backdrop-blur-lg rounded-2xl p-3 mb-3 border
            ${isProcessing 
              ? 'bg-yellow-500/20 border-yellow-500/30' 
              : 'bg-telegram-button/20 border-telegram-button/30'
            }
          `}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isProcessing ? (
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
              ) : (
                <Check className="w-4 h-4 text-telegram-button" />
              )}
              <p className={`font-bold text-sm ${isProcessing ? 'text-yellow-400' : 'text-telegram-button'}`}>
                {isProcessing ? 'Processing Card #' : 'Card #'}{optimisticSelected || selectedNumber}
                {isProcessing ? '...' : ' Selected'}
              </p>
            </div>
            <p className={`text-xs ${isProcessing ? 'text-yellow-400/80' : 'text-telegram-button/80'}`}>
              {isProcessing 
                ? 'Waiting for confirmation...' 
                : 'Click another card to change selection'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
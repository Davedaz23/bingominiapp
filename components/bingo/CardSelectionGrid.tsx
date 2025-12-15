/* eslint-disable @typescript-eslint/no-explicit-any */
// components/bingo/CardSelectionGrid.tsx - UPDATED
import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';

interface CardSelectionGridProps {
  availableCards: Array<{cardIndex: number, numbers: (number | string)[][], preview?: any}>;
  takenCards: {cardNumber: number, userId: string}[];
  selectedNumber: number | null;
  walletBalance: number;
  gameStatus: string;
  onCardSelect: (cardNumber: number) => void;
  disabled?: boolean; // NEW: Add disabled prop
}

export const CardSelectionGrid: React.FC<CardSelectionGridProps> = ({
  availableCards,
  takenCards,
  selectedNumber,
  walletBalance,
  gameStatus,
  onCardSelect,
  disabled = false // NEW: Default to false
}) => {
  // Create a map of taken cards for quick lookup
  const takenCardMap = new Map();
  takenCards.forEach(card => {
    takenCardMap.set(card.cardNumber, card);
  });

  // Helper function to handle card click
  const handleCardClick = (number: number) => {
    if (disabled) {
      console.log('Card selection is disabled - player already has card in active game');
      return;
    }
    
    const isTaken = takenCardMap.has(number);
    const isAvailable = availableCards.some(card => card.cardIndex === number);
    const canSelect = walletBalance >= 10;
    const isSelectable = canSelect && isAvailable && !isTaken;
    
    if (isSelectable) {
      onCardSelect(number);
    }
  };

  return (
    <div className="mb-4">
      {/* DISABLED OVERLAY MESSAGE */}
      {disabled && (
        <motion.div 
          className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-lg rounded-2xl p-4 mb-4 border-2 border-green-500/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-green-300" />
            <div className="flex-1">
              <p className="text-green-300 font-bold text-sm">
                Card Selection Locked
              </p>
              <p className="text-green-200 text-xs">
                You already have a card in an active game. Card selection is disabled.
              </p>
            </div>
            <div className="bg-green-500/30 px-3 py-1 rounded-full">
              <span className="text-green-300 font-bold text-xs">Locked</span>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div 
        className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* DISABLED OVERLAY */}
        {disabled && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
            <div className="text-center p-4">
              <Lock className="w-8 h-8 text-white/60 mx-auto mb-2" />
              <p className="text-white font-medium">Card Selection Disabled</p>
              <p className="text-white/60 text-sm">You are already in an active game</p>
            </div>
          </div>
        )}

        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
          const isTaken = takenCardMap.has(number);
          const isAvailable = availableCards.some(card => card.cardIndex === number);
          const canSelect = walletBalance >= 10;
          const isSelectable = canSelect && isAvailable && !isTaken && !disabled; // ADDED: !disabled check
          const isCurrentlySelected = selectedNumber === number;
          const takenBy = isTaken ? takenCardMap.get(number) : null;

          return (
            <motion.button
              key={number}
              onClick={() => handleCardClick(number)}
              disabled={!isSelectable || disabled} // ADDED: disabled prop
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isCurrentlySelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : isTaken
                  ? 'bg-red-500/80 text-white cursor-not-allowed border-red-500 shadow-md'
                  : disabled
                  ? 'bg-gray-600/40 text-white/40 cursor-not-allowed border-gray-600/40' // NEW: disabled style
                  : isSelectable
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                    : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isCurrentlySelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
                ${isTaken ? 'animate-pulse' : ''}
                ${disabled ? 'opacity-60' : ''}
              `}
              whileHover={isSelectable && !disabled ? { scale: 1.05 } : {}} // ADDED: !disabled check
              whileTap={isSelectable && !disabled ? { scale: 0.95 } : {}} // ADDED: !disabled check
              layout
            >
              {number}
              
              {/* Current selection indicator */}
              {isCurrentlySelected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Taken indicator - shows immediately when card is taken */}
              {isTaken && !isCurrentlySelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 text-red-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Lock icon when disabled */}
              {disabled && !isTaken && !isCurrentlySelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="w-3 h-3 text-gray-400" />
                </div>
              )}
              
              {/* Available for selection indicator (only when not disabled) */}
              {!disabled && !isTaken && isSelectable && gameStatus === 'ACTIVE' && !isCurrentlySelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              )}
              
              {/* Insufficient balance indicator */}
              {!disabled && !isTaken && !isSelectable && walletBalance < 10 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-3 h-3 text-yellow-400">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Show available indicator (only when not disabled) */}
              {!disabled && isAvailable && !isTaken && canSelect && !isCurrentlySelected && (
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
          <span>❌ {takenCards.length} taken</span>
          <span>⏳ {400 - availableCards.length - takenCards.length} inactive</span>
          {disabled && <span className="text-yellow-400">🔒 Card selection locked</span>}
        </div>
        <div className="text-xs text-white/40 mt-1">
          {disabled 
            ? 'You have an active game - Card selection is disabled' 
            : 'Updates in real-time • Refresh automatically'
          }
        </div>
      </div>

      {/* Selection Info (only show when not disabled) */}
      {!disabled && selectedNumber && (
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

      {/* Disabled info message */}
      {disabled && (
        <motion.div 
          className="bg-gradient-to-r from-green-500/10 to-blue-500/10 backdrop-blur-lg rounded-2xl p-4 border border-green-500/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center">
            <Lock className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-green-300 font-medium text-sm mb-1">
              Card Selection Temporarily Unavailable
            </p>
            <p className="text-green-200/80 text-xs">
              You already have an active game in progress. 
              Return to your game or wait for it to finish before selecting a new card.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
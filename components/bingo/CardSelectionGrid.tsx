// components/bingo/CardSelectionGrid.tsx - FIXED VERSION
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

interface CardSelectionGridProps {
  availableCards: Array<{cardNumber: number, numbers: (number | string)[][], preview?: any}>;
  takenCards: {cardNumber: number, userId: string}[];
  selectedNumber: number | null;
  walletBalance: number;
  gameStatus: string;
  isSelectionActive: boolean;
  isLoading?: boolean;
  onCardSelect: (cardNumber: number) => void;
}

export const CardSelectionGrid: React.FC<CardSelectionGridProps> = ({
  availableCards,
  takenCards,
  selectedNumber,
  walletBalance,
  gameStatus,
  isSelectionActive,
  isLoading = false,
  onCardSelect
}) => {
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Create a map of taken cards for quick lookup
  const takenCardMap = useMemo(() => {
    const map = new Map<number, {cardNumber: number, userId: string}>();
    takenCards.forEach(card => {
      map.set(card.cardNumber, card);
    });
    console.log('📊 Taken card map created:', {
      size: map.size,
      takenCardsLength: takenCards.length
    });
    return map;
  }, [takenCards]);

  // Create a map of available cards for quick lookup
  const availableCardMap = useMemo(() => {
    const map = new Map<number, any>();
    availableCards.forEach(card => {
      map.set(card.cardNumber, card);
    });
    console.log('📊 Available card map created:', {
      size: map.size,
      availableCardsLength: availableCards.length,
      firstFewCardNumbers: availableCards.slice(0, 5).map(c => c.cardNumber)
    });
    
    // Log specific cards 1-10
    for (let i = 1; i <= 10; i++) {
      console.log(`Card ${i}: inAvailableMap = ${map.has(i)}`);
    }
    
    return map;
  }, [availableCards]);

  // For debugging
  useEffect(() => {
    const debugData = {
      availableCardsCount: availableCards.length,
      takenCardsCount: takenCards.length,
      selectedNumber,
      walletBalance,
      gameStatus,
      isSelectionActive,
      firstAvailableCards: availableCards.slice(0, 3),
      firstTakenCards: takenCards.slice(0, 3),
      // Check cards 1-5
      cards1to5: Array.from({ length: 5 }, (_, i) => i + 1).map(num => ({
        number: num,
        isTaken: takenCardMap.has(num),
        isAvailable: availableCardMap.has(num),
        canSelect: walletBalance >= 10
      }))
    };
    
    console.log('🔍 CardSelectionGrid Debug:', debugData);
    
    // Create a summary for display
    const summary = `Available: ${availableCards.length} | Taken: ${takenCards.length} | Selected: ${selectedNumber || 'none'} | Balance: ${walletBalance} | Status: ${gameStatus}`;
    setDebugInfo(summary);
    
  }, [availableCards, takenCards, selectedNumber, walletBalance, gameStatus, isSelectionActive, takenCardMap, availableCardMap]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="mb-4 p-8 text-center">
        <Loader2 className="inline-block animate-spin h-8 w-8 text-telegram-button mb-3" />
        <p className="text-white/60">Loading available cards...</p>
        <p className="text-white/40 text-sm mt-2">Checking which cards are available for selection</p>
      </div>
    );
  }

  // Show message if no cards available
  if (availableCards.length === 0 && isSelectionActive) {
    return (
      <div className="mb-4 p-6 text-center bg-white/10 rounded-2xl">
        <p className="text-white/80 mb-2">No cards available for selection</p>
        <p className="text-white/50 text-sm">
          {walletBalance < 10 
            ? `Insufficient balance. Need 10 tokens (you have ${walletBalance})`
            : 'All cards may be taken or game is not in selection phase'}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {/* Debug info - can be removed in production */}
      <div className="mb-3 p-2 bg-black/20 rounded text-xs text-white/50 font-mono">
        {debugInfo}
      </div>

      <motion.div 
        className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4 p-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
          const isTaken = takenCardMap.has(number);
          const isAvailable = availableCardMap.has(number);
          const canSelect = walletBalance >= 10;
          const isSelectable = canSelect && isAvailable && !isTaken && isSelectionActive;
          const isCurrentlySelected = selectedNumber === number;

          // Log first 5 cards for debugging
          if (number <= 5) {
            console.log(`Card ${number}:`, {
              isTaken,
              isAvailable,
              canSelect,
              isSelectable,
              isCurrentlySelected,
              isSelectionActive
            });
          }

          return (
            <motion.button
              key={number}
              onClick={() => {
                if (isSelectable) {
                  console.log(`Selecting card ${number}`, {
                    isSelectable,
                    isAvailable,
                    isTaken,
                    canSelect
                  });
                  onCardSelect(number);
                } else {
                  console.log(`Cannot select card ${number}:`, {
                    isSelectable,
                    isAvailable,
                    isTaken,
                    canSelect,
                    isSelectionActive
                  });
                }
              }}
              disabled={!isSelectable}
              title={
                !isSelectionActive ? 'Card selection is not active' :
                !canSelect ? `Need 10 tokens (you have ${walletBalance})` :
                isTaken ? 'Card already taken' :
                !isAvailable ? 'Card not available' :
                `Select card ${number}`
              }
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isCurrentlySelected
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
              whileHover={isSelectable ? { scale: 1.05 } : {}}
              whileTap={isSelectable ? { scale: 0.95 } : {}}
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
              {isAvailable && !isTaken && walletBalance >= 10 && !isCurrentlySelected && (
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Selection status info */}
      <motion.div 
        className="bg-telegram-button/10 backdrop-blur-lg rounded-2xl p-3 mb-3 border border-telegram-button/20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSelectionActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <p className="text-white font-bold text-sm">
                {isSelectionActive ? 'Card Selection Active' : 'Card Selection Inactive'}
              </p>
            </div>
            <p className="text-white/60 text-xs">
              Game: {gameStatus}
            </p>
          </div>
          
          {!isSelectionActive && (
            <p className="text-white/50 text-xs">
              Card selection is only available when game is in WAITING_FOR_PLAYERS or CARD_SELECTION status
            </p>
          )}
          
          {walletBalance < 10 && (
            <p className="text-yellow-400 text-xs">
              Need 10 tokens to select a card (you have {walletBalance})
            </p>
          )}
        </div>
      </motion.div>

      {/* Selected card info */}
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
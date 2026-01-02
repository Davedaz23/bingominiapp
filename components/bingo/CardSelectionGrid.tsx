/* eslint-disable @typescript-eslint/no-explicit-any */
// components/bingo/CardSelectionGrid.tsx - UPDATED with real-time WebSocket integration
import { motion } from 'framer-motion';
import { Check, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

interface CardSelectionGridProps {
  availableCards: Array<{cardIndex: number, numbers: (number | string)[][], preview?: any}>;
  takenCards: {cardNumber: number, userId: string}[];
  selectedNumber: number | null;
  walletBalance: number;
  gameStatus: string;
  onCardSelect: (cardNumber: number) => Promise<boolean>;
  processingCards: Set<number>;
  locallyTakenCards: Set<number>;
  wsConnected: boolean;
}

export const CardSelectionGrid: React.FC<CardSelectionGridProps> = ({
  availableCards,
  takenCards,
  selectedNumber,
  walletBalance,
  gameStatus,
  onCardSelect,
  processingCards,
  locallyTakenCards,
  wsConnected
}) => {
  // State for recently taken cards animation
  const [recentlyTakenCards, setRecentlyTakenCards] = useState<Set<number>>(new Set());

  // Create a map of taken cards for quick lookup
  const takenCardMap = useMemo(() => {
    const map = new Map<number, any>();
    takenCards.forEach(card => {
      map.set(card.cardNumber, card);
    });
    return map;
  }, [takenCards]);

  // Create a map of available cards for quick lookup
  const availableCardMap = useMemo(() => {
    const map = new Map<number, any>();
    availableCards.forEach(card => {
      map.set(card.cardIndex, card);
    });
    return map;
  }, [availableCards]);

  // Check if card is taken
  const isCardTaken = (cardNumber: number): boolean => {
  const isServerTaken = takenCardMap.has(cardNumber);
  const isLocalTaken = locallyTakenCards.has(cardNumber);
  const isProcessing = processingCards.has(cardNumber);
  
  // IMPORTANT: If someone else is processing the card, show it as taken
  return isServerTaken || isLocalTaken || isProcessing;
};

  // Check if card is available
  const isCardAvailable = (cardNumber: number): boolean => {
    return availableCardMap.has(cardNumber) && !isCardTaken(cardNumber);
  };

  // Check if card is processing
  const isCardProcessing = (cardNumber: number): boolean => {
    return processingCards.has(cardNumber);
  };

  // Check if user can select this card
const canUserSelect = (cardNumber: number): boolean => {
  return (
    walletBalance >= 10 &&
    !isCardTaken(cardNumber) &&
    !isCardProcessing(cardNumber) &&
    (gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION' || gameStatus === 'FINISHED')
  );
};

  // Handle card selection
  const handleCardSelect = async (cardNumber: number) => {
    if (!canUserSelect(cardNumber)) return;
    await onCardSelect(cardNumber);
  };

  // Effect for showing recent taken cards animation
  useEffect(() => {
    const interval = setInterval(() => {
      setRecentlyTakenCards(prev => {
        const newSet = new Set(prev);
        // Remove cards that were taken more than 3 seconds ago
        Array.from(prev).forEach(cardNumber => {
          // This would need to track timestamps for better accuracy
          // For now, we'll just rotate them
          if (Math.random() > 0.5) {
            newSet.delete(cardNumber);
          }
        });
        
        // Add some random recently taken cards for animation demo
        if (takenCards.length > 0 && Math.random() > 0.7) {
          const randomTaken = takenCards[Math.floor(Math.random() * takenCards.length)];
          if (randomTaken && !isCardProcessing(randomTaken.cardNumber) && selectedNumber !== randomTaken.cardNumber) {
            newSet.add(randomTaken.cardNumber);
          }
        }
        
        return newSet;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [takenCards, selectedNumber, isCardProcessing]);

  // Calculate statistics
  const cardStats = useMemo(() => {
    const totalAvailable = availableCards.length;
    const totalTaken = takenCards.length + locallyTakenCards.size;
    const totalProcessing = processingCards.size;
    const totalInactive = 400 - totalAvailable - totalTaken;
    
    return { totalAvailable, totalTaken, totalProcessing, totalInactive };
  }, [availableCards.length, takenCards.length, locallyTakenCards.size, processingCards.size]);

  return (
    <div className="mb-4">
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between mb-4 bg-white/5 backdrop-blur-lg rounded-xl p-3 border border-white/10">
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">Live Updates</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm">Polling Every 5s</span>
            </>
          )}
        </div>
        <div className="flex gap-4">
          <span className="text-white/60 text-sm">
            {wsConnected ? 'Real-time' : 'Manual Refresh'}
          </span>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-400 text-sm hover:text-blue-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Card Grid */}
      <motion.div 
        className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
          const isTaken = isCardTaken(number);
          const isProcessing = isCardProcessing(number);
          const isAvailable = isCardAvailable(number);
          const canSelect = canUserSelect(number);
          const isCurrentlySelected = selectedNumber === number;
          const isRecentlyTaken = recentlyTakenCards.has(number);
          const takenBy = takenCardMap.get(number);

          return (
            <motion.button
              key={number}
              onClick={() => handleCardSelect(number)}
              disabled={!canSelect}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isProcessing
                  ? 'bg-gradient-to-br from-yellow-500 to-amber-500 text-white border-yellow-500 shadow-lg cursor-wait'
                  : isCurrentlySelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : isTaken
                  ? 'bg-gradient-to-br from-red-500/90 to-rose-600/90 text-white cursor-not-allowed border-red-500/90 shadow-md'
                  : isRecentlyTaken && !isCurrentlySelected
                  ? 'bg-gradient-to-br from-orange-500/80 to-amber-600/80 text-white border-orange-500/80 shadow-lg animate-pulse'
                  : canSelect
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-gradient-to-br from-green-500/60 to-emerald-600/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                    : 'bg-gradient-to-br from-white/30 to-white/20 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-gradient-to-br from-white/10 to-white/5 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isCurrentlySelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
              `}
              whileHover={canSelect && !isProcessing ? { scale: 1.05 } : {}}
              whileTap={canSelect && !isProcessing ? { scale: 0.95 } : {}}
              layout
            >
              {number}
              
              {/* Processing indicator */}
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
              
              {/* Taken indicator */}
              {isTaken && !isProcessing && !isCurrentlySelected && (
                <div className="absolute inset-0 flex items-center justify-center opacity-90">
                  <div className="w-5 h-5 text-white/90">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Recently taken indicator */}
              {isRecentlyTaken && !isTaken && !isProcessing && !isCurrentlySelected && (
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white animate-ping"></div>
              )}
              
              {/* Available for selection indicator */}
              {!isTaken && canSelect && !isCurrentlySelected && !isProcessing && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              )}
              
              {/* Insufficient balance indicator */}
              {!isTaken && !canSelect && walletBalance < 10 && !isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-4 h-4 text-yellow-400">
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

      {/* Real-time statistics */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 mb-4 border border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-green-400 font-bold text-2xl">{cardStats.totalAvailable}</div>
            <div className="text-white/60 text-xs mt-1">Available Cards</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 font-bold text-2xl">{cardStats.totalTaken}</div>
            <div className="text-white/60 text-xs mt-1">Taken Cards</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-400 font-bold text-2xl">{cardStats.totalProcessing}</div>
            <div className="text-white/60 text-xs mt-1">Selecting Now</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 font-bold text-2xl">{cardStats.totalInactive}</div>
            <div className="text-white/60 text-xs mt-1">Inactive Cards</div>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="text-center mt-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
            <span className="text-white/80 text-xs">
              {wsConnected 
                ? 'Live updates enabled • Cards update in real-time' 
                : 'Manual updates • Refresh for latest status'}
            </span>
          </div>
        </div>
      </div>

      {/* Selection Info */}
      {selectedNumber && (
        <motion.div 
          className="bg-gradient-to-r from-telegram-button/20 to-blue-500/20 backdrop-blur-lg rounded-xl p-4 mb-3 border border-telegram-button/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-telegram-button" />
              <div>
                <p className="text-telegram-button font-bold text-sm">Card #{selectedNumber} Selected</p>
                <p className="text-telegram-button/70 text-xs">
                  {processingCards.has(selectedNumber) 
                    ? 'Processing your selection...' 
                    : isCardAvailable(selectedNumber)
                      ? 'Ready to join game'
                      : 'Selection confirmed'}
                </p>
              </div>
            </div>
            {!processingCards.has(selectedNumber) && (
              <button
                onClick={() => window.location.reload()}
                className="text-telegram-button text-xs hover:text-telegram-button/80 transition-colors"
              >
                Change Card
              </button>
            )}
          </div>
        </motion.div>
      )}

     
    </div>
  );
};
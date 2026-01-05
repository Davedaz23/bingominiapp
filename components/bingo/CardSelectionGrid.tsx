/* eslint-disable @typescript-eslint/no-explicit-any */
// components/bingo/CardSelectionGrid.tsx - FIXED VERSION
import { motion } from 'framer-motion';
import { Check, Wifi, WifiOff, User, UserCheck, Clock } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';

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
  currentUserId?: string;
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
  wsConnected,
  currentUserId = ''
}) => {
  // State for recently taken cards animation
  const [recentlyTakenCards, setRecentlyTakenCards] = useState<Set<number>>(new Set());
  const [lastTakenTimestamp, setLastTakenTimestamp] = useState<Map<number, number>>(new Map());
  
  // Prevent multiple clicks
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

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

  // Check if card is taken by OTHERS (not current user)
  const isCardTakenByOthers = (cardNumber: number): boolean => {
    const takenCard = takenCardMap.get(cardNumber);
    const isServerTaken = !!takenCard;
    const isTakenByCurrentUser = takenCard?.userId === currentUserId;
    
    // IMPORTANT: If server confirms it's taken by current user, it's NOT "taken by others"
    if (isTakenByCurrentUser) {
      return false;
    }
    
    // Check if it's locally taken (but only if not by current user)
    const isLocalTaken = locallyTakenCards.has(cardNumber);
    
    return isServerTaken || (isLocalTaken && !isTakenByCurrentUser);
  };

  // Check if card is selected by current user (confirmed by server)
  const isCardSelectedByUser = (cardNumber: number): boolean => {
    const takenCard = takenCardMap.get(cardNumber);
    const isTakenByCurrentUser = takenCard?.userId === currentUserId;
    
    // Only consider it selected if server confirms OR it's the currently selected number
    return selectedNumber === cardNumber || isTakenByCurrentUser;
  };

  // Check if card is available for selection
  const isCardAvailable = (cardNumber: number): boolean => {
    const isTaken = isCardTakenByOthers(cardNumber);
    const isSelected = isCardSelectedByUser(cardNumber);
    
    return availableCardMap.has(cardNumber) && !isTaken && !isSelected;
  };

  // Check if card is processing
  const isCardProcessing = (cardNumber: number): boolean => {
    return processingCards.has(cardNumber) && !isCardSelectedByUser(cardNumber);
  };

  // Check if user can select this card
  const canUserSelect = (cardNumber: number): boolean => {
    // Prevent multiple clicks
    if (isProcessingRef.current) return false;

    const hasBalance = walletBalance >= 10;
    const isTakenByOthers = isCardTakenByOthers(cardNumber);
    const isAlreadySelectedByUser = isCardSelectedByUser(cardNumber);
    const isProcessing = isCardProcessing(cardNumber);
    
    const validGameStatus = gameStatus === 'WAITING_FOR_PLAYERS' || 
                          gameStatus === 'CARD_SELECTION' || 
                          gameStatus === 'FINISHED';
    
    return (
      hasBalance &&
      !isTakenByOthers &&
      !isAlreadySelectedByUser &&
      !isProcessing &&
      validGameStatus
    );
  };

  // Handle card selection with proper state management
  const handleCardSelect = async (cardNumber: number) => {
    if (!canUserSelect(cardNumber) || isProcessingRef.current) return;

    // Set processing flag
    isProcessingRef.current = true;

    try {
      const success = await onCardSelect(cardNumber);
      
      if (success) {
        // If successful, mark as recently taken for animation
        setRecentlyTakenCards(prev => {
          const newSet = new Set(prev);
          newSet.add(cardNumber);
          return newSet;
        });
        
        // Update timestamp for animation
        setLastTakenTimestamp(prev => {
          const newMap = new Map(prev);
          newMap.set(cardNumber, Date.now());
          return newMap;
        });
      }
      
      return success;
    } catch (error) {
      console.error('Card selection failed:', error);
      return false;
    } finally {
      // Reset processing flag after a short delay
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
    }
  };

  // Effect for showing recent taken cards animation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentlyTakenCards(prev => {
        const newSet = new Set(prev);
        
        // Remove cards that were taken more than 3 seconds ago
        Array.from(prev).forEach(cardNumber => {
          const timestamp = lastTakenTimestamp.get(cardNumber) || 0;
          if (now - timestamp > 3000) {
            newSet.delete(cardNumber);
          }
        });
        
        return newSet;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lastTakenTimestamp]);

  // Calculate statistics
  const cardStats = useMemo(() => {
    const totalAvailable = availableCards.length;
    
    // Count cards taken by current user (confirmed by server)
    const takenByUser = takenCards.filter(card => card.userId === currentUserId).length;
    
    // Count cards taken by others
    const takenByOthers = takenCards.filter(card => card.userId !== currentUserId).length;
    
    // Count cards being processed (excluding user's confirmed cards)
    const totalProcessing = Array.from(processingCards).filter(card => 
      !takenCards.find(t => t.cardNumber === card && t.userId === currentUserId)
    ).length;
    
    const totalInactive = 400 - totalAvailable - takenByOthers - takenByUser;
    
    return { 
      totalAvailable, 
      takenByOthers, 
      takenByUser, 
      totalProcessing, 
      totalInactive 
    };
  }, [availableCards.length, takenCards, currentUserId, processingCards]);

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
        </div>
      </div>

      {/* User Status Indicator */}
      {currentUserId && (
        <div className="mb-3 bg-gradient-to-r from-telegram-button/10 to-blue-500/10 backdrop-blur-lg rounded-xl p-2 border border-telegram-button/20">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <UserCheck className="w-3 h-3" />
            <span>User ID: {currentUserId.substring(0, 8)}...</span>
            {selectedNumber && (
              <span className="ml-auto text-telegram-button">
                Your Card: #{selectedNumber}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Card Grid */}
      <motion.div 
        className="grid grid-cols-8 gap-2 max-h-[40vh] overflow-y-auto mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
          const isTakenByOthers = isCardTakenByOthers(number);
          const isSelectedByUser = isCardSelectedByUser(number);
          const isProcessing = isCardProcessing(number);
          const isAvailable = isCardAvailable(number);
          const canSelect = canUserSelect(number);
          const isRecentlyTaken = recentlyTakenCards.has(number);
          const takenBy = takenCardMap.get(number);
          const isTakenByCurrentUser = takenBy?.userId === currentUserId;

          return (
            <motion.button
              key={number}
              onClick={() => handleCardSelect(number)}
              disabled={!canSelect}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all duration-200 relative
                border-2
                ${isProcessing
                  ? 'bg-gradient-to-br from-yellow-500/70 to-amber-500/70 text-white border-yellow-500/70 shadow-lg cursor-wait'
                  : isSelectedByUser
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg cursor-default'
                  : isTakenByOthers
                  ? 'bg-gradient-to-br from-red-500/80 to-rose-600/80 text-white/90 cursor-not-allowed border-red-500/80 shadow-md'
                  : isRecentlyTaken && !isSelectedByUser
                  ? 'bg-gradient-to-br from-orange-500/80 to-amber-600/80 text-white border-orange-500/80 shadow-lg'
                  : canSelect
                  ? 'bg-gradient-to-br from-white/30 to-white/20 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-gradient-to-br from-white/10 to-white/5 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isSelectedByUser ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
              `}
              whileHover={canSelect ? { scale: 1.05 } : {}}
              whileTap={canSelect ? { scale: 0.95 } : {}}
              layout
            >
              {number}
              
              {/* Processing indicator (only if not selected by user) */}
              {isProcessing && !isSelectedByUser && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                </div>
              )}
              
              {/* Current user selection indicator */}
              {isSelectedByUser && !isProcessing && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Taken by others indicator */}
              {isTakenByOthers && !isProcessing && !isSelectedByUser && (
                <div className="absolute inset-0 flex items-center justify-center opacity-90">
                  <div className="w-5 h-5 text-white/90">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              )}
              
              {/* Recently taken indicator */}
              {isRecentlyTaken && !isTakenByOthers && !isProcessing && !isSelectedByUser && (
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white animate-ping"></div>
              )}
              
              {/* Available for selection indicator */}
              {!isTakenByOthers && canSelect && !isSelectedByUser && !isProcessing && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              )}
              
              {/* Insufficient balance indicator */}
              {!isTakenByOthers && !canSelect && walletBalance < 10 && !isProcessing && !isSelectedByUser && (
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-4 h-4 text-yellow-400">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Taken by current user indicator (if not current selection) */}
              {isTakenByCurrentUser && !isSelectedByUser && (
                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-telegram-button rounded-full border-2 border-white"></div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Real-time statistics */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 mb-4 border border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-green-400 font-bold text-2xl">{cardStats.totalAvailable}</div>
            <div className="text-white/60 text-xs mt-1">Available</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 font-bold text-2xl">{cardStats.takenByOthers}</div>
            <div className="text-white/60 text-xs mt-1">Taken by Others</div>
          </div>
          <div className="text-center">
            <div className="text-telegram-button font-bold text-2xl">{cardStats.takenByUser}</div>
            <div className="text-white/60 text-xs mt-1">Your Cards</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-400 font-bold text-2xl">{cardStats.totalProcessing}</div>
            <div className="text-white/60 text-xs mt-1">Selecting Now</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 font-bold text-2xl">{cardStats.totalInactive}</div>
            <div className="text-white/60 text-xs mt-1">Inactive</div>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="text-center mt-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
            <span className="text-white/80 text-xs">
              {wsConnected 
                ? 'Live updates • Your cards are highlighted in blue' 
                : 'Manual updates • Refresh for latest status'}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-3 mb-3 border border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-telegram-button"></div>
            <span className="text-white/70 text-xs">Your Card</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-white/70 text-xs">Taken by Others</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-white/70 text-xs">Selecting Now</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-white/70 text-xs">Available</span>
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
                    : 'Ready to join game'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
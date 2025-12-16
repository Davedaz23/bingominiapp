/* eslint-disable @typescript-eslint/no-explicit-any */
// components/bingo/CardSelectionGrid.tsx - UPDATED WITH ACTIVE GAME LOCK
import { motion } from 'framer-motion';
import { Check, Lock, AlertCircle, Gamepad2 } from 'lucide-react';

interface CardSelectionGridProps {
  availableCards: Array<{cardIndex: number, numbers: (number | string)[][], preview?: any}>;
  takenCards: {cardNumber: number, userId: string}[];
  selectedNumber: number | null;
  walletBalance: number;
  gameStatus: string;
  onCardSelect: (cardNumber: number) => void;
  disabled?: boolean;
  hasActiveGame?: boolean; // NEW: Explicit prop for active game state
  activeGameInfo?: { // NEW: Optional active game info
    gameId?: string;
    cardNumber?: number;
    gameStatus?: string;
  };
}

export const CardSelectionGrid: React.FC<CardSelectionGridProps> = ({
  availableCards,
  takenCards,
  selectedNumber,
  walletBalance,
  gameStatus,
  onCardSelect,
  disabled = false,
  hasActiveGame = false, // NEW: Default to false
  activeGameInfo = {} // NEW: Default empty object
}) => {
  // Create a map of taken cards for quick lookup
  const takenCardMap = new Map();
  takenCards.forEach(card => {
    takenCardMap.set(card.cardNumber, card);
  });

  // Determine if card selection should be disabled
const isSelectionDisabled = disabled || (hasActiveGame && activeGameInfo?.gameStatus === 'ACTIVE');

  // Helper function to handle card click
  const handleCardClick = (number: number) => {   
       console.log('Card Number '+number);

    if (isSelectionDisabled) {
      console.log('Card selection is disabled - player already has card in active game');
      return;
    }
    
    const isTaken = takenCardMap.has(number);
    const isAvailable = availableCards.some(card => card.cardIndex === number);
    const canSelect = walletBalance >= 10;
    const isSelectable = canSelect && isAvailable && !isTaken;
    
    if (!isSelectable) {
console.log("Selectable Card "+number);
      onCardSelect(number);
    }
  };

  // Get active game message
  const getActiveGameMessage = () => {
    if (!hasActiveGame) return null;
    
    if (activeGameInfo.gameStatus === 'ACTIVE') {
      return `You have card #${activeGameInfo.cardNumber} in an active game`;
    } else if (activeGameInfo.gameStatus === 'WAITING_FOR_PLAYERS') {
      return `You have card #${activeGameInfo.cardNumber} - Waiting for game to start`;
    }
    return 'You have an active game';
  };

  return (
    <div className="mb-4">
      {/* ACTIVE GAME WARNING BANNER */}
      {hasActiveGame && (
        <motion.div 
          className={`
            backdrop-blur-lg rounded-2xl p-4 mb-4 border-2
            ${activeGameInfo.gameStatus === 'ACTIVE' 
              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30' 
              : 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30'
            }
          `}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            {activeGameInfo.gameStatus === 'ACTIVE' ? (
              <Gamepad2 className="w-5 h-5 text-green-300" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-300" />
            )}
            <div className="flex-1">
              <p className={`
                font-bold text-sm
                ${activeGameInfo.gameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'}
              `}>
                {activeGameInfo.gameStatus === 'ACTIVE' 
                  ? 'You are in an active game!' 
                  : 'Waiting for game to start'}
              </p>
              <p className={`
                text-xs
                ${activeGameInfo.gameStatus === 'ACTIVE' ? 'text-green-200' : 'text-yellow-200'}
              `}>
                {getActiveGameMessage()}
              </p>
            </div>
            <div className={`
              px-3 py-1 rounded-full
              ${activeGameInfo.gameStatus === 'ACTIVE' 
                ? 'bg-green-500/30 animate-pulse' 
                : 'bg-yellow-500/30'
              }
            `}>
              <span className={`
                font-bold text-xs
                ${activeGameInfo.gameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'}
              `}>
                {activeGameInfo.gameStatus === 'ACTIVE' ? 'Redirecting...' : 'Waiting...'}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* DISABLED OVERLAY MESSAGE */}
      {isSelectionDisabled && (
        <motion.div 
          className={`
            backdrop-blur-lg rounded-2xl p-4 mb-4 border-2
            ${hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE'
              ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-500/30'
              : 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/30'
            }
          `}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <Lock className={`
              w-5 h-5
              ${hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE' 
                ? 'text-red-300' 
                : 'text-purple-300'
              }
            `} />
            <div className="flex-1">
              <p className={`
                font-bold text-sm
                ${hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE' 
                  ? 'text-red-300' 
                  : 'text-purple-300'
                }
              `}>
                {hasActiveGame 
                  ? 'Card Selection Locked' 
                  : 'Card Selection Temporarily Disabled'}
              </p>
              <p className={`
                text-xs
                ${hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE' 
                  ? 'text-red-200' 
                  : 'text-purple-200'
                }
              `}>
                {hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE'
                  ? 'You already have a card in an active game. Redirecting to game...'
                  : hasActiveGame
                  ? 'You have a card in a waiting game. Card selection is disabled.'
                  : 'Card selection is currently disabled.'
                }
              </p>
            </div>
            <div className={`
              px-3 py-1 rounded-full
              ${hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE' 
                ? 'bg-red-500/30' 
                : 'bg-purple-500/30'
              }
            `}>
              <span className={`
                font-bold text-xs
                ${hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE' 
                  ? 'text-red-300' 
                  : 'text-purple-300'
                }
              `}>
                {hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE' 
                  ? 'Redirecting' 
                  : 'Locked'}
              </span>
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
        {isSelectionDisabled && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
            <div className="text-center p-4">
              <Lock className="w-8 h-8 text-white/60 mx-auto mb-2" />
              <p className="text-white font-medium mb-1">
                {hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE'
                  ? 'Active Game Detected'
                  : 'Card Selection Disabled'
                }
              </p>
              <p className="text-white/60 text-sm max-w-xs">
                {hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE'
                  ? `You have card #${activeGameInfo.cardNumber} in an active game. You will be redirected automatically.`
                  : hasActiveGame
                  ? 'You already have a card assigned. Wait for the game to start or finish.'
                  : 'Card selection is currently unavailable.'
                }
              </p>
            </div>
          </div>
        )}

        {Array.from({ length: 400 }, (_, i) => i + 1).map((number) => {
          const isTaken = takenCardMap.has(number);
          const isAvailable = availableCards.some(card => card.cardIndex === number);
          const canSelect = walletBalance >= 10;
          const isSelectable = canSelect && !isAvailable && !isTaken && !isSelectionDisabled;
          const isCurrentlySelected = selectedNumber === number;
          const takenBy = isTaken ? takenCardMap.get(number) : null;
console.log("Card selected? "+ isCurrentlySelected +" "+selectedNumber);
          return (
            <motion.button
              key={number}
              onClick={() => handleCardClick(number)}
              disabled={!isSelectable || isSelectionDisabled}
              className={`
                aspect-square rounded-xl font-bold text-sm transition-all relative
                border-2
                ${isCurrentlySelected
                  ? 'bg-gradient-to-br from-telegram-button to-blue-500 text-white border-telegram-button shadow-lg scale-105'
                  : isTaken
                  ? 'bg-red-500/80 text-white cursor-not-allowed border-red-500 shadow-md'
                  : isSelectionDisabled
                  ? 'bg-gray-600/40 text-white/40 cursor-not-allowed border-gray-600/40'
                  : isSelectable
                  ? gameStatus === 'ACTIVE' 
                    ? 'bg-green-500/60 text-white hover:bg-green-600/70 hover:scale-105 hover:shadow-md cursor-pointer border-green-400/60'
                    : 'bg-white/30 text-white hover:bg-white/40 hover:scale-105 hover:shadow-md cursor-pointer border-white/30'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border-white/10'
                }
                ${isCurrentlySelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-purple-600' : ''}
                ${isTaken ? 'animate-pulse' : ''}
                ${isSelectionDisabled ? 'opacity-60' : ''}
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
              
              {/* Lock icon when disabled */}
              {isSelectionDisabled && !isTaken && !isCurrentlySelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="w-3 h-3 text-gray-400" />
                </div>
              )}
              
              {/* Available for selection indicator (only when not disabled) */}
              {!isSelectionDisabled && !isTaken && isSelectable && gameStatus === 'ACTIVE' && !isCurrentlySelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              )}
              
              {/* Insufficient balance indicator */}
              {!isSelectionDisabled && !isTaken && !isSelectable && walletBalance < 10 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-3 h-3 text-yellow-400">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Show available indicator (only when not disabled) */}
              {!isSelectionDisabled && isAvailable && !isTaken && canSelect && !isCurrentlySelected && (
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Real-time status */}
      <div className="text-center text-white/60 text-sm mb-3">
        <div className="flex justify-center gap-4 flex-wrap">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span>{availableCards.length} available</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span>{takenCards.length} taken</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span>{400 - availableCards.length - takenCards.length} inactive</span>
          </span>
          {isSelectionDisabled && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Lock className="w-3 h-3" />
              <span>Selection locked</span>
            </span>
          )}
        </div>
        <div className="text-xs text-white/40 mt-1">
          {isSelectionDisabled 
            ? (hasActiveGame && activeGameInfo.gameStatus === 'ACTIVE'
                ? 'You will be redirected to your active game'
                : 'You have a card in a waiting game'
              )
            : 'Updates in real-time • Refresh automatically'
          }
        </div>
      </div>

      {/* Selection Info (only show when not disabled) */}
      {!isSelectionDisabled && selectedNumber && (
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

      {/* Active Game Info Message */}
      {hasActiveGame && (
        <motion.div 
          className={`
            backdrop-blur-lg rounded-2xl p-4 border
            ${activeGameInfo.gameStatus === 'ACTIVE'
              ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20'
              : 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/20'
            }
          `}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center">
            {activeGameInfo.gameStatus === 'ACTIVE' ? (
              <Gamepad2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            )}
            <p className={`
              font-medium text-sm mb-1
              ${activeGameInfo.gameStatus === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'}
            `}>
              {activeGameInfo.gameStatus === 'ACTIVE'
                ? 'Active Game Detected'
                : 'Waiting Game Detected'
              }
            </p>
            <p className={`
              text-xs
              ${activeGameInfo.gameStatus === 'ACTIVE' ? 'text-green-200/80' : 'text-yellow-200/80'}
            `}>
              {activeGameInfo.gameStatus === 'ACTIVE'
                ? `You have card #${activeGameInfo.cardNumber} in an active game. You cannot select a new card until this game ends.`
                : `You have card #${activeGameInfo.cardNumber} in a waiting game. Once the game starts, you will be redirected automatically.`
              }
            </p>
            {activeGameInfo.gameStatus === 'ACTIVE' && (
              <div className="mt-3">
                <div className="w-full bg-green-500/20 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-green-400 to-emerald-400 h-1.5 rounded-full animate-pulse"></div>
                </div>
                <p className="text-green-300/60 text-xs mt-1">Preparing redirect to game...</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
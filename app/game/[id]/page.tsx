/* eslint-disable @typescript-eslint/no-explicit-any */
// app/game/[id]/page.tsx - FIXED VERSION
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGame } from '../../../hooks/useGame';
import { gameAPI } from '../../../services/api';
import { AnimatePresence, motion } from 'framer-motion';
import { useCardSelection } from '@/hooks/useCardSelection';
import { useGameState } from '@/hooks/useGameState';

// Types
interface LocalBingoCard {
  cardNumber?: number;
  numbers: (number | string)[][];
  markedPositions: number[];
  selected?: boolean[][];
  id?: string;
  _id?: string;
  cardIndex?: number;
  isDisqualified?: boolean;
  disqualificationReason?: string;
}

interface WinnerInfo {
  winner: {
    _id: string;
    username: string;
    firstName: string;
    telegramId?: string;
  };
  gameCode?: string;
  endedAt?: string;
  totalPlayers?: number;
  numbersCalled?: number;
  winningPattern?: string;
  winningCard?: {
    cardNumber: number;
    numbers: (number | string)[][];
    markedPositions: number[];
    winningPatternPositions?: number[];
  };
  message?: string;
}

interface Game {
  _id: string;
  code: string;
  status: string;
  currentPlayers: number;
  numbersCalled: number[];
  winnerId?: string;
  startedAt?: Date;
  endedAt?: Date;
  players?: any[];
  potAmount?: number;
  message?: string;
  noWinner?: boolean;
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    game,
    bingoCard: gameBingoCard,
    isLoading,
    error: gameError,
    walletBalance,
    getWinnerInfo,
    wsConnected,
    wsCurrentNumber,
    wsRecentCalledNumbers,
    wsCalledNumbers,
    refetchGame
  } = useGame(id);
  
  const { gameStatus, gameData } = useGameState();
  
  const {
    selectedNumber,
    clearSelectedCard
  } = useCardSelection(gameData, gameStatus);

  // State declarations
  const [localBingoCard, setLocalBingoCard] = useState<LocalBingoCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState<boolean>(true);
  const [cardError, setCardError] = useState<string>('');
  const [isMarking, setIsMarking] = useState<boolean>(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  const [currentCalledNumber, setCurrentCalledNumber] = useState<{
    number: number;
    letter: string;
    isNew?: boolean;
  } | null>(null);

  const [allCalledNumbers, setAllCalledNumbers] = useState<number[]>([]);
  const [recentCalledNumbers, setRecentCalledNumbers] = useState<
    Array<{ number: number; letter: string; isCurrent?: boolean }>
  >([]);

  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<WinnerInfo | null>(null);
  const [isWinnerLoading, setIsWinnerLoading] = useState(false);
  const [isUserWinner, setIsUserWinner] = useState(false);
  const [winningAmount, setWinningAmount] = useState(0);
  const [countdown, setCountdown] = useState<number>(10);

  // Retry states
  const [retryCount, setRetryCount] = useState(0);
  const [autoRetryInProgress, setAutoRetryInProgress] = useState(false);
  const MAX_RETRY_ATTEMPTS = 3;

  const [isClaimingBingo, setIsClaimingBingo] = useState<boolean>(false);
  const [claimResult, setClaimResult] = useState<{
    success: boolean;
    message: string;
    patternType?: string;
    prizeAmount?: number;
  } | null>(null);

  const [isSpectatorMode, setIsSpectatorMode] = useState<boolean>(false);
  const [spectatorMessage, setSpectatorMessage] = useState<string>('');

  // Disqualification states
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [disqualificationMessage, setDisqualificationMessage] = useState<string>('');
  const [showDisqualificationModal, setShowDisqualificationModal] = useState<boolean>(false);
  const [disqualificationDetails, setDisqualificationDetails] = useState<{
    message: string;
    patternClaimed?: string;
    markedPositions?: number;
    calledNumbers?: number;
    timestamp?: Date;
  } | null>(null);

  // Refs
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const hasCardCheckedRef = useRef(false);
  const updateInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const disqualificationCheckRef = useRef<boolean>(false);
  const initializationCompleteRef = useRef<boolean>(false);
  const lastWinnerCheckRef = useRef<string>(''); // Track last winner check
  const calledNumbersInitializedRef = useRef(false);


  const gameStatusPollingRef = useRef<NodeJS.Timeout | null>(null);
const forceGameRefreshRef = useRef(false);

// Add this useEffect to poll for game status changes
useEffect(() => {
  if (!game || isDisqualified || showWinnerModal) return;

  // Clear any existing polling
  if (gameStatusPollingRef.current) {
    clearInterval(gameStatusPollingRef.current);
  }

  // Start polling for game status updates
  gameStatusPollingRef.current = setInterval(() => {
    console.log('🔄 Polling game status...');
    
    // Force a refresh of game data
    if (refetchGame) {
      refetchGame().then(() => {
        console.log('✅ Game data refreshed via polling');
      }).catch(error => {
        console.error('❌ Failed to refresh game data:', error);
      });
    }
  }, 3000); // Poll every 3 seconds

  return () => {
    if (gameStatusPollingRef.current) {
      clearInterval(gameStatusPollingRef.current);
    }
  };
}, [game, isDisqualified, showWinnerModal, refetchGame]);
  // Helper function to get BINGO letter
  const getNumberLetter = useCallback((num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  }, []);

  // Initialize called numbers from game
  useEffect(() => {
    if (!game || calledNumbersInitializedRef.current || isDisqualified) return;

    // Load called numbers from game data
    if (game.numbersCalled && Array.isArray(game.numbersCalled)) {
      console.log('🔢 Loading called numbers from game data:', game.numbersCalled);
      setAllCalledNumbers(game.numbersCalled);
      
      // Set recent called numbers
      const recentNumbers = [];
      const totalCalled = game.numbersCalled.length;
      for (let i = Math.max(totalCalled - 3, 0); i < totalCalled; i++) {
        const num = game.numbersCalled[i];
        if (num) {
          recentNumbers.push({
            number: num,
            letter: getNumberLetter(num),
            isCurrent: i === totalCalled - 1
          });
        }
      }
      setRecentCalledNumbers(recentNumbers);
      
      // Set current number if available
      if (game.numbersCalled.length > 0) {
        const lastNumber = game.numbersCalled[game.numbersCalled.length - 1];
        setCurrentCalledNumber({
          number: lastNumber,
          letter: getNumberLetter(lastNumber),
          isNew: false
        });
      }
    }

    calledNumbersInitializedRef.current = true;
  }, [game, isDisqualified, getNumberLetter]);

  // Update called numbers from WebSocket
  useEffect(() => {
    if (!wsConnected || !game || isDisqualified) return;

    // Update called numbers from WebSocket
    if (wsCalledNumbers && wsCalledNumbers.length > 0) {
      const mergedNumbers = [...new Set([...allCalledNumbers, ...wsCalledNumbers])];
      if (JSON.stringify(mergedNumbers) !== JSON.stringify(allCalledNumbers)) {
        setAllCalledNumbers(mergedNumbers);
        
        // Update recent called numbers
        const recentNumbers = [];
        const totalCalled = mergedNumbers.length;
        for (let i = Math.max(totalCalled - 3, 0); i < totalCalled; i++) {
          const num = mergedNumbers[i];
          if (num) {
            recentNumbers.push({
              number: num,
              letter: getNumberLetter(num),
              isCurrent: i === totalCalled - 1
            });
          }
        }
        setRecentCalledNumbers(recentNumbers);
      }
    }

    // Update current number from WebSocket
    if (wsCurrentNumber) {
      // Add to all called numbers if not already present
      if (!allCalledNumbers.includes(wsCurrentNumber.number)) {
        setAllCalledNumbers(prev => [...prev, wsCurrentNumber.number]);
      }
      
      const newCurrentNumber = {
        number: wsCurrentNumber.number,
        letter: getNumberLetter(wsCurrentNumber.number),
        isNew: true
      };

      setCurrentCalledNumber(newCurrentNumber);

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      animationTimeoutRef.current = setTimeout(() => {
        setCurrentCalledNumber(prev =>
          prev ? { ...prev, isNew: false } : null
        );
      }, 1000);
    }
  }, [wsConnected, wsCalledNumbers, wsCurrentNumber, game, isDisqualified, getNumberLetter, allCalledNumbers]);

  // Helper function to handle disqualification
  const handleDisqualification = useCallback((errorMessage: string, details?: any) => {
    if (disqualificationCheckRef.current) return;
    
    disqualificationCheckRef.current = true;
    setIsDisqualified(true);
    setDisqualificationMessage(errorMessage);
    setIsSpectatorMode(true);
    setSpectatorMessage('You have been disqualified. Watching as spectator.');
    
    setDisqualificationDetails({
      message: errorMessage,
      patternClaimed: details?.patternClaimed,
      markedPositions: localBingoCard?.markedPositions?.length || details?.markedPositions,
      calledNumbers: allCalledNumbers.length || details?.calledNumbers,
      timestamp: new Date()
    });
    
    setTimeout(() => {
      setShowDisqualificationModal(true);
    }, 500);
  }, [localBingoCard, allCalledNumbers]);

  // Check if user has a bingo card
  const checkUserHasCard = useCallback(async (forceCheck = false, isRetry = false): Promise<boolean> => {
    if (autoRetryInProgress && !isRetry) return false;

    if (hasCardCheckedRef.current && !forceCheck && !isRetry) {
      return !!localBingoCard;
    }

    try {
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId || !id) {
        setIsSpectatorMode(true);
        setSpectatorMessage('Please login to join the game.');
        hasCardCheckedRef.current = true;
        return false;
      }

      const cardResponse = await gameAPI.getUserBingoCard(id, userId);

      if (cardResponse.data.success && cardResponse.data.bingoCard) {
        const apiCard = cardResponse.data.bingoCard;
        
        // Check for disqualification
        if (apiCard.isDisqualified) {
          const disqualificationReason = apiCard.disqualificationReason || 'Your card has been disqualified';
          
          handleDisqualification(disqualificationReason, {
            markedPositions: apiCard.markedNumbers?.length || apiCard.markedPositions?.length
          });
          
          setLocalBingoCard({
            cardNumber: (apiCard as any).cardNumber || (apiCard as any).cardIndex || 0,
            numbers: [],
            markedPositions: [],
            isDisqualified: true,
            disqualificationReason: disqualificationReason
          });
          
          hasCardCheckedRef.current = true;
          return false;
        }

        const newCard = {
          cardNumber: (apiCard as any).cardNumber || (apiCard as any).cardIndex || 0,
          numbers: apiCard.numbers || [],
          markedPositions: apiCard.markedNumbers || apiCard.markedPositions || [],
          selected: (apiCard as any).selected,
          isDisqualified: apiCard.isDisqualified || false
        };

        setLocalBingoCard(newCard);
        setIsDisqualified(false);
        disqualificationCheckRef.current = false;
        setIsSpectatorMode(false);
        setSpectatorMessage('');
        setCardError('');
        setRetryCount(0);
        hasCardCheckedRef.current = true;
        return true;
      }

      setIsSpectatorMode(true);
      setSpectatorMessage('You do not have a card for this game. Watching as spectator.');
      hasCardCheckedRef.current = true;
      return false;

    } catch (error: any) {
      if (error.response?.status === 404) {
        setIsSpectatorMode(true);
        setSpectatorMessage('You do not have a card for this game. Watching as spectator.');
        hasCardCheckedRef.current = true;
        return false;
      } else {
        if (isRetry) {
          setCardError('Failed to load your card. Please check your connection.');
        }
        return false;
      }
    }
  }, [id, localBingoCard, autoRetryInProgress, handleDisqualification]);

  // Initialize user card
  const initializeUserCard = useCallback(async (forceCheck = false) => {
    if (updateInProgressRef.current && !forceCheck) return;

    try {
      updateInProgressRef.current = true;

      if (isSpectatorMode && !forceCheck) {
        setIsLoadingCard(false);
        return;
      }

      let attempts = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempts < maxAttempts && !success && !isSpectatorMode) {
        attempts++;
        setRetryCount(attempts);

        if (attempts > 1) {
          setAutoRetryInProgress(true);
        }

        try {
          success = await checkUserHasCard(forceCheck, attempts > 1);

          if (success) {
            setAutoRetryInProgress(false);
            break;
          }

          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (retryError) {
          console.error(`Retry attempt ${attempts} failed:`, retryError);
          if (attempts === maxAttempts) {
            throw retryError;
          }
        }
      }

      if (!success && !isSpectatorMode && !isDisqualified) {
        setIsSpectatorMode(true);
        setSpectatorMessage('Unable to load your card. Watching as spectator.');
        setCardError('');
      }

    } catch (error: any) {
      console.error('Failed to initialize user card:', error);
      if (!isSpectatorMode && !isDisqualified) {
        setIsSpectatorMode(true);
        setSpectatorMessage('Unable to load your card. Watching as spectator.');
        setCardError('');
      }
    } finally {
      setIsLoadingCard(false);
      setAutoRetryInProgress(false);
      updateInProgressRef.current = false;
      initializationCompleteRef.current = true;
    }
  }, [checkUserHasCard, isSpectatorMode, isDisqualified]);

  // Check for winner - FIXED VERSION
const checkForWinner = useCallback(async (gameData?: Game, force = false) => {
  console.log('🏆 checkForWinner called:', {
    gameId: gameData?._id,
    status: gameData?.status,
    showWinnerModal,
    force
  });

  if (!gameData) {
    console.log('❌ No game data provided');
    return;
  }

  // CRITICAL FIX: Remove the status check that blocks winner checking
  // Allow winner check in more scenarios
  const shouldCheckForWinner = 
    force || 
    gameData.status === 'FINISHED' || 
    gameData.status === 'NO_WINNER' ||
    gameData.status === 'COOLDOWN' ||
    !!gameData.winnerId ||
    gameData.noWinner;

  if (!shouldCheckForWinner && !force) {
    console.log('⚠️ Skipping winner check - game still active:', gameData.status);
    return;
  }

  // Prevent duplicate calls
  if (abortControllerRef.current) {
    console.log('⏸️ Previous winner check still in progress');
    return;
  }

  if (showWinnerModal) {
    console.log('✅ Winner modal already showing');
    return;
  }

  try {
    setIsWinnerLoading(true);
    abortControllerRef.current = new AbortController();
    
    console.log('📞 Fetching winner info...');
    const winnerData = await getWinnerInfo();

    console.log('🎯 Winner data received:', winnerData);
    
    if (winnerData) {
      setWinnerInfo(winnerData as unknown as WinnerInfo);
      
      const hasWinner = !!winnerData.winner?._id;
      
      if (hasWinner) {
        const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
        
        console.log('👤 User ID check:', {
          userId,
          winnerId: winnerData.winner?._id,
          winnerTelegramId: winnerData.winner?.telegramId,
          gameWinnerId: gameData.winnerId
        });

        // Check if current user is the winner
        let isWinner = false;
        if (userId) {
          const winner = winnerData.winner;
          
          // Convert all IDs to strings for comparison
          const userIdStr = String(userId).trim();
          const winnerIdStr = winner?._id ? String(winner._id).trim() : '';
          const winnerTelegramIdStr = winner?.telegramId ? String(winner.telegramId).trim() : '';
          
          isWinner = (
            winnerIdStr === userIdStr ||
            winnerTelegramIdStr === userIdStr
          );
          
          console.log('🏅 Is current user winner?', isWinner);
        }

        setIsUserWinner(isWinner);

        // Calculate prize amount
        const totalPot = (gameData.currentPlayers || 0) * 10;
        const platformFee = totalPot * 0.2;
        const winnerPrize = totalPot - platformFee;
        setWinningAmount(winnerPrize);
        
        console.log('💰 Prize calculation:', { totalPot, platformFee, winnerPrize });
      } else {
        // No winner scenario
        setIsUserWinner(false);
        setWinningAmount(0);
        
        console.log('📭 No winner in game data');
        setWinnerInfo({
          ...winnerData,
          winner: {
            _id: 'no-winner',
            username: 'No Winner',
            firstName: 'Game Ended',
            telegramId: 'no-winner'
          },
          message: 'Game ended without a winner'
        });
      }

      clearSelectedCard();

      // Show modal immediately
      setTimeout(() => {
        console.log('🎉 Showing winner modal');
        setShowWinnerModal(true);
        setIsWinnerLoading(false);
      }, 500);
      
    } else {
      console.log('⚠️ No winner data from API');
      
      // If game has winnerId but no winner data, show generic winner modal
      if (gameData.winnerId) {
        console.log('👑 Game has winnerId but no winner data from API');
        setWinnerInfo({
          winner: {
            _id: gameData.winnerId,
            username: 'Winner',
            firstName: 'Bingo Winner',
            telegramId: 'winner'
          },
          gameCode: gameData.code || 'N/A',
          endedAt: gameData.endedAt?.toString() || new Date().toISOString(),
          totalPlayers: gameData.currentPlayers || 0,
          numbersCalled: gameData.numbersCalled?.length || 0,
          message: 'Congratulations to the winner!'
        });
        
        setIsUserWinner(false);
        setWinningAmount(0);
        
        clearSelectedCard();

        setTimeout(() => {
          console.log('🎉 Showing generic winner modal');
          setShowWinnerModal(true);
          setIsWinnerLoading(false);
        }, 500);
      }
      // If game is finished but no winner data, show no winner modal
      else if (gameData.status === 'FINISHED' || gameData.status === 'NO_WINNER') {
        const hasNoWinner = gameData.status === 'NO_WINNER' || gameData.noWinner;
        
        if (hasNoWinner) {
          console.log('📭 Game ended with no winner');
          setWinnerInfo({
            winner: {
              _id: 'no-winner',
              username: 'No Winner',
              firstName: 'Game Ended',
              telegramId: 'no-winner'
            },
            gameCode: gameData.code || 'N/A',
            endedAt: gameData.endedAt?.toString() || new Date().toISOString(),
            totalPlayers: gameData.currentPlayers || 0,
            numbersCalled: gameData.numbersCalled?.length || 0,
          });
          
          setIsUserWinner(false);
          setWinningAmount(0);
          
          clearSelectedCard();

          setTimeout(() => {
            console.log('📭 Showing no winner modal');
            setShowWinnerModal(true);
            setIsWinnerLoading(false);
          }, 500);
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch winner info:', error);
    
    if (error.name !== 'AbortError') {
      setIsWinnerLoading(false);
      
      // If game has winnerId or is finished, show generic modal anyway
      if (gameData?.winnerId || gameData?.status === 'FINISHED') {
        console.log('⚠️ Error but game has winner or is finished, showing modal');
        setWinnerInfo({
          winner: {
            _id: gameData.winnerId || 'unknown',
            username: gameData.winnerId ? 'Winner' : 'Unknown Winner',
            firstName: gameData.winnerId ? 'Bingo Winner' : 'Game Completed',
            telegramId: gameData.winnerId || 'unknown'
          },
          gameCode: gameData.code || 'N/A',
          endedAt: gameData.endedAt?.toString() || new Date().toISOString(),
          totalPlayers: gameData.currentPlayers || 0,
          numbersCalled: gameData.numbersCalled?.length || 0,
          message: gameData.winnerId ? 'Congratulations to the winner!' : 'Game completed successfully'
        });
        
        setIsUserWinner(false);
        setWinningAmount(0);
        
        setTimeout(() => {
          setShowWinnerModal(true);
          setIsWinnerLoading(false);
        }, 500);
      }
    }
  } finally {
    abortControllerRef.current = null;
  }
}, [getWinnerInfo, showWinnerModal, clearSelectedCard]);


  // Handle game status changes - FIXED: Remove ref check that was blocking
useEffect(() => {
  if (!game || isDisqualified) return;

  console.log('🔄 Game status check:', {
    gameId: game._id,
    status: game.status,
    showWinnerModal,
    lastWinnerCheck: lastWinnerCheckRef.current
  });

  // Check for game end conditions
  if ((game.status === 'FINISHED' || game.status === 'NO_WINNER' || game.status === 'COOLDOWN') && !showWinnerModal) {
    console.log('🎮 Game ended, checking for winner');
    
    // Create a unique key for this winner check
    const checkKey = `${game._id}_${game.status}_${Date.now()}`;
    
    // Only check if we haven't already checked for this exact state
    if (lastWinnerCheckRef.current !== checkKey) {
      lastWinnerCheckRef.current = checkKey;
      checkForWinner(game as Game);
    } else {
      console.log('✅ Winner check already performed for this game state');
    }
  }

  if (game.status === 'CANCELLED') {
    clearSelectedCard();
  }
}, [game, showWinnerModal, checkForWinner, clearSelectedCard, isDisqualified]);

  // Listen for WebSocket winner events - FIXED
useEffect(() => {
  if (!wsConnected || !game || isDisqualified) return;

  // When WebSocket sends WINNER_DECLARED, force a game refresh and winner check
  const handleWinnerEvent = () => {
    console.log('🎯 WebSocket winner event received, forcing game refresh');
    
    // Set flag to force game refresh
    forceGameRefreshRef.current = true;
    
    // Force refresh game data first
    if (refetchGame) {
      refetchGame().then(() => {
        console.log('✅ Game data refreshed after WebSocket event');
        
        // Reset the last check key to allow checking again
        lastWinnerCheckRef.current = '';
        
        // Force a winner check after refresh
        setTimeout(() => {
          if (game?.status === 'FINISHED') {
            console.log('🏆 Forcing winner check after game refresh');
            checkForWinner(game as Game, true);
          }
        }, 1000);
      }).catch(error => {
        console.error('❌ Failed to refresh game data after WebSocket event:', error);
      });
    }
  };

  // This would be triggered by your WebSocket handler
  // For now, we'll simulate it when we detect game should be finished
  if (game.status === 'FINISHED') {
    handleWinnerEvent();
  }
}, [wsConnected, game, checkForWinner, isDisqualified, refetchGame]);

  // Initialize game
  useEffect(() => {
    if (initializationAttempted || isDisqualified) return;
    
    const initializeGame = async () => {
      try {
        setInitializationAttempted(true);
        
        if (!game) {
          return;
        }
        
        const cardCheckTimeout = setTimeout(() => {
          if (isLoadingCard && !isDisqualified) {
            setIsLoadingCard(false);
          }
        }, 3000);
        
        await initializeUserCard();
        clearTimeout(cardCheckTimeout);
        
      } catch (error) {
        console.error('Failed to initialize game:', error);
        if (!isDisqualified) {
          setIsLoadingCard(false);
        }
      }
    };
    
    if (!isLoading && game && !initializationAttempted && !isDisqualified) {
      initializeGame();
    }
  }, [game, isLoading, initializeUserCard, initializationAttempted, isDisqualified]);

  // Countdown for winner modal
  useEffect(() => {
    if (showWinnerModal && winnerInfo) {
      setCountdown(10);

      if (countdownRef.current) clearInterval(countdownRef.current);

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            handleReturnToLobby();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showWinnerModal, winnerInfo]);

  // Safety timeout
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (isLoadingCard && !isDisqualified) {
        setIsLoadingCard(false);
        setCardError('Loading timed out. Please refresh or check your connection.');
      }
    }, 20000);

    return () => clearTimeout(safetyTimeout);
  }, [isLoadingCard, isDisqualified]);

  // Store disqualification in localStorage
  useEffect(() => {
    if (isDisqualified && disqualificationDetails) {
      const disqualificationData = {
        message: disqualificationMessage,
        patternClaimed: disqualificationDetails.patternClaimed,
        markedPositions: disqualificationDetails.markedPositions,
        calledNumbers: disqualificationDetails.calledNumbers,
        timestamp: new Date().toISOString(),
        gameId: id
      };
      
      localStorage.setItem(`disqualified_${id}`, JSON.stringify(disqualificationData));
    }
  }, [isDisqualified, disqualificationDetails, disqualificationMessage, id]);

  // Handle manual number marking
  const handleMarkNumber = async (number: number) => {
    if (isMarking || !allCalledNumbers.includes(number) || game?.status !== 'ACTIVE' || isDisqualified) return;

    try {
      setIsMarking(true);
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) throw new Error('User ID not found');

      // Update UI first
      if (localBingoCard) {
        const numbers = localBingoCard.numbers.flat();
        const position = numbers.indexOf(number);

        if (position !== -1 && !localBingoCard.markedPositions?.includes(position)) {
          const updatedMarkedPositions = [...(localBingoCard.markedPositions || []), position];
          setLocalBingoCard({
            ...localBingoCard,
            markedPositions: updatedMarkedPositions
          });
        }
      }

      // Send to backend
      gameAPI.markNumber(id, userId, number)
        .then(response => {
          if (!response.data.success && localBingoCard) {
            // Revert on failure
            const numbers = localBingoCard.numbers.flat();
            const position = numbers.indexOf(number);
            
            if (position !== -1) {
              const updatedMarkedPositions = localBingoCard.markedPositions?.filter(pos => pos !== position) || [];
              setLocalBingoCard({
                ...localBingoCard,
                markedPositions: updatedMarkedPositions
              });
            }
          }
        })
        .catch(() => {
          // Revert on error
          if (localBingoCard) {
            const numbers = localBingoCard.numbers.flat();
            const position = numbers.indexOf(number);
            
            if (position !== -1) {
              const updatedMarkedPositions = localBingoCard.markedPositions?.filter(pos => pos !== position) || [];
              setLocalBingoCard({
                ...localBingoCard,
                markedPositions: updatedMarkedPositions
              });
            }
          }
        });

    } catch (error: any) {
      console.error('Failed to mark number:', error);
    } finally {
      setIsMarking(false);
    }
  };

  // Handle manual Bingo claim
  // In your handleClaimBingo function, modify it like this:
const handleClaimBingo = async () => {
  if (isClaimingBingo || !id || game?.status !== 'ACTIVE' || !localBingoCard || isDisqualified) return;

  try {
    setIsClaimingBingo(true);
    setClaimResult(null);

    const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
    if (!userId) throw new Error('User ID not found');

    const response = await gameAPI.claimBingo(id, userId, 'BINGO');

    if (response.data.success) {
      // IMMEDIATELY show winner modal for the user who claimed
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      const currentUsername = localStorage.getItem('username') || 'Player';
      const currentFirstName = localStorage.getItem('firstName') || 'Player';
      
      // Set winner info for immediate modal display
      setWinnerInfo({
        winner: {
          _id: userId || 'current-user',
          username: currentUsername,
          firstName: currentFirstName,
          telegramId: userId ?? undefined
        },
        gameCode: game?.code || 'N/A',
        endedAt: new Date().toISOString(),
        totalPlayers: game?.currentPlayers || 0,
        numbersCalled: allCalledNumbers.length,
        winningPattern: response.data.patternType || 'BINGO',
        winningCard: {
          cardNumber: localBingoCard.cardNumber || 0,
          numbers: localBingoCard.numbers,
          markedPositions: localBingoCard.markedPositions,
          winningPatternPositions: response.data.winningPositions || []
        },
        message: 'Bingo claimed successfully! You are the winner!'
      });
      
      // Set winner state
      setIsUserWinner(true);
      
      // Calculate prize amount
      const totalPot = (game?.currentPlayers || 0) * 10;
      const platformFee = totalPot * 0.2;
      const winnerPrize = totalPot - platformFee;
      setWinningAmount(winnerPrize);
      
      // Clear selected card
      clearSelectedCard();
      
      // Show winner modal immediately
      setTimeout(() => {
        console.log('🎉 Showing immediate winner modal after successful claim');
        setShowWinnerModal(true);
      }, 300);
      
      // Also show success message
      setClaimResult({
        success: true,
        message: response.data.message || 'Bingo claimed successfully! You are the winner!',
        patternType: response.data.patternType,
        prizeAmount: winnerPrize
      });

      // Force refresh game data in background to sync with server
      setTimeout(() => {
        if (refetchGame) {
          refetchGame().then(() => {
            console.log('✅ Game data refreshed after bingo claim');
          }).catch(error => {
            console.error('❌ Failed to refresh game after claim:', error);
          });
        }
      }, 1000);
    } else {
      const errorMsg = response.data.message || response.data.error || 'Failed to claim bingo';
      setClaimResult({
        success: false,
        message: errorMsg
      });
      
      if (errorMsg.toLowerCase().includes('disqualified') || 
          errorMsg.toLowerCase().includes('false bingo claim')) {
        handleDisqualification(errorMsg, {
          patternClaimed: 'BINGO',
          markedPositions: localBingoCard.markedPositions?.length
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Bingo claim failed:', error);
    
    let errorMessage = 'Failed to claim bingo';
    
    if (error.response?.data) {
      errorMessage = error.response.data.error || 
                     error.response.data.message || 
                     error.message || 
                     'Failed to claim bingo';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setClaimResult({
      success: false,
      message: errorMessage
    });
    
    const isDisqualifiedError = errorMessage.toLowerCase().includes('disqualified') || 
                                errorMessage.toLowerCase().includes('false bingo claim');
    
    if (isDisqualifiedError) {
      handleDisqualification(errorMessage, {
        patternClaimed: 'BINGO',
        markedPositions: localBingoCard?.markedPositions?.length
      });
    }
  } finally {
    setIsClaimingBingo(false);

    // Clear claim result message after delay (only for non-disqualification cases)
    if (!isDisqualified) {
      setTimeout(() => {
        setClaimResult(null);
      }, 5000);
    }
  }
};

// Also update the claimResult display to show more prominent message for success:
{claimResult && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    className={`
      mt-2 p-2 rounded-lg text-center text-xs font-medium max-w-[200px]
      ${claimResult.success
        ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 border border-green-500/30 shadow-lg shadow-green-500/20'
        : 'bg-gradient-to-r from-red-500/20 to-red-500/10 text-red-300 border border-red-500/30'
      }
    `}
  >
    {claimResult.success ? (
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-green-400">🎉</span>
          <span className="font-bold">Success!</span>
          <span className="text-green-400">🎉</span>
        </div>
        <p className="text-xs">{claimResult.message}</p>
        <p className="text-[10px] text-green-400 mt-1">
          Winner details loading...
        </p>
      </div>
    ) : (
      <p>{claimResult.message}</p>
    )}
  </motion.div>
)}

// Enhance the WebSocket winner event handling:
// Add this to your WebSocket useEffect:
useEffect(() => {
  if (!wsConnected || !game || isDisqualified) return;

  // When WebSocket sends WINNER_DECLARED, force a game refresh and winner check
  const handleWinnerEvent = () => {
    console.log('🎯 WebSocket winner event received, forcing game refresh');
    
    // Set flag to force game refresh
    forceGameRefreshRef.current = true;
    
    // Force refresh game data first
    if (refetchGame) {
      refetchGame().then(() => {
        console.log('✅ Game data refreshed after WebSocket event');
        
        // Reset the last check key to allow checking again
        lastWinnerCheckRef.current = '';
        
        // Force a winner check after refresh
        setTimeout(() => {
          if (game?.status === 'FINISHED') {
            console.log('🏆 Forcing winner check after game refresh');
            checkForWinner(game as Game, true);
          }
        }, 1000);
      }).catch(error => {
        console.error('❌ Failed to refresh game data after WebSocket event:', error);
      });
    }
  };

  // Add listener for BINGO_CLAIMED events
  // This assumes your WebSocket service can emit specific events
  // You'll need to integrate this with your actual WebSocket implementation
  const handleBingoClaimed = (data: any) => {
    console.log('🔔 WebSocket: Bingo claimed event:', data);
    
    if (data.isWinner) {
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      const isCurrentUser = userId === data.userId?.toString() || 
                           userId === data.userId?.telegramId;
      
      if (isCurrentUser && !showWinnerModal) {
        console.log('🎉 Current user is the winner via WebSocket!');
        // The handleClaimBingo already shows modal, but this is backup
      }
    }
  };

  // Trigger winner check when game status changes to FINISHED
  if (game.status === 'FINISHED') {
    handleWinnerEvent();
  }
}, [wsConnected, game, checkForWinner, isDisqualified, refetchGame]);

// Also update the useEffect that listens for game status changes to be less restrictive:
useEffect(() => {
  if (!game || isDisqualified) return;

  console.log('🔄 Game status check:', {
    gameId: game._id,
    status: game.status,
    showWinnerModal,
    lastWinnerCheck: lastWinnerCheckRef.current
  });

  // Check for game end conditions - also check if there's a winnerId
  const hasWinner = !!game.winnerId;
  const shouldCheckForWinner = (game.status === 'FINISHED' || 
                              game.status === 'NO_WINNER' || 
                              game.status === 'COOLDOWN' ||
                              hasWinner) && 
                              !showWinnerModal;
  
  if (shouldCheckForWinner) {
    console.log('🎮 Game ended or has winner, checking for winner');
    
    // Create a unique key for this winner check
    const checkKey = `${game._id}_${game.status}_${Date.now()}`;
    
    // Only check if we haven't already checked for this exact state
    if (lastWinnerCheckRef.current !== checkKey) {
      lastWinnerCheckRef.current = checkKey;
      checkForWinner(game as Game);
    } else {
      console.log('✅ Winner check already performed for this game state');
    }
  }

  if (game.status === 'CANCELLED') {
    clearSelectedCard();
  }
}, [game, showWinnerModal, checkForWinner, clearSelectedCard, isDisqualified]);

  // Handle returning to lobby
  const handleReturnToLobby = () => {
    localStorage.removeItem(`disqualified_${id}`);
    
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    setShowWinnerModal(false);
    setWinnerInfo(null);
    setIsUserWinner(false);
    setWinningAmount(0);
    setCurrentCalledNumber(null);
    setAllCalledNumbers([]);
    setRecentCalledNumbers([]);
    setClaimResult(null);
    setCountdown(10);
    setShowDisqualificationModal(false);

    // Reset states
    setIsDisqualified(false);
    setDisqualificationMessage('');
    setDisqualificationDetails(null);
    disqualificationCheckRef.current = false;

    // Reset refs
    hasCardCheckedRef.current = false;
    updateInProgressRef.current = false;
    initializationCompleteRef.current = false;
    lastWinnerCheckRef.current = '';
    calledNumbersInitializedRef.current = false;

    router.push('/');
  };

  // Handle continue watching
  const handleContinueWatching = () => {
    setShowDisqualificationModal(false);
  };

  // Use local card if available
  const displayBingoCard = useMemo(() => {
    return localBingoCard || gameBingoCard;
  }, [localBingoCard, gameBingoCard]);

  // Helper function to check if a position is in winning pattern
  const isWinningPosition = useCallback((rowIndex: number, colIndex: number): boolean => {
    if (!winnerInfo?.winningCard?.winningPatternPositions) return false;
    const flatIndex = rowIndex * 5 + colIndex;
    return winnerInfo.winningCard.winningPatternPositions.includes(flatIndex);
  }, [winnerInfo]);

  // Function to get winning pattern type name
  const getPatternName = useCallback((patternType?: string): string => {
    if (!patternType) return 'BINGO Line';

    const patternMap: Record<string, string> = {
      'ROW_0': 'Top Row',
      'ROW_1': 'Second Row',
      'ROW_2': 'Third Row',
      'ROW_3': 'Fourth Row',
      'ROW_4': 'Bottom Row',
      'COLUMN_0': 'First Column (B)',
      'COLUMN_1': 'Second Column (I)',
      'COLUMN_2': 'Third Column (N)',
      'COLUMN_3': 'Fourth Column (G)',
      'COLUMN_4': 'Fifth Column (O)',
      'DIAGONAL_LEFT': 'Left Diagonal',
      'DIAGONAL_RIGHT': 'Right Diagonal',
      'FOUR_CORNERS': 'Four Corners',
      'BLACKOUT': 'Blackout (Full Card)',
      'BINGO': 'BINGO Line'
    };

    return patternMap[patternType] || patternType.replace('_', ' ').toLowerCase();
  }, []);

  // ==================== RENDER LOGIC ====================
  
  if (isLoading && !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading game data...</p>
          <p className="text-white/60 text-sm mt-2">Game #{id}</p>
        </div>
      </div>
    );
  }

  if (!game && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Game Not Found</h1>
          <p className="text-white/70 mb-6">{gameError || 'The game you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-white text-purple-600 px-6 py-3 rounded-2xl font-bold hover:bg-purple-50 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingCard && !cardError && !isSpectatorMode && !isDisqualified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading your bingo card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4 relative">
      {/* WebSocket Connection Status */}
      {!wsConnected && (
        <div className="fixed top-4 left-4 z-20 bg-gradient-to-r from-yellow-600/90 to-orange-600/90 text-white px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm border border-yellow-400/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Connecting...</span>
          </div>
        </div>
      )}

      {/* Disqualification Modal */}
      <AnimatePresence>
        {showDisqualificationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDisqualificationModal(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="bg-gradient-to-br from-red-900/90 to-orange-900/90 rounded-2xl p-6 max-w-md w-full border-2 border-red-500 shadow-2xl relative overflow-hidden"
            >
              <button
                onClick={handleContinueWatching}
                className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
              >
                ✕
              </button>
              
              <div className="text-center mb-6">
                <div className="text-5xl mb-4">⛔</div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  DISQUALIFIED
                </h1>
                <p className="text-white/70 text-sm">
                  Game #{game?.code || id}
                </p>
              </div>

              <div className="bg-gradient-to-r from-red-800/50 to-orange-800/50 rounded-xl p-4 mb-6 border border-red-500/30">
                <p className="text-white text-center mb-4">
                  {disqualificationMessage || 'Your card has been disqualified from the game.'}
                </p>
              </div>

              <div className="text-center">
                <p className="text-white/70 text-sm mb-4">
                  You can continue watching the game as a spectator.
                </p>
                <button
                  onClick={handleContinueWatching}
                  className="bg-gradient-to-r from-gray-700 to-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:from-gray-600 hover:to-gray-800 transition-all w-full"
                >
                  Continue Watching
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Modal */}
      <AnimatePresence>
        {showWinnerModal && winnerInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-4 max-w-md w-full border-2 border-yellow-500 shadow-2xl relative overflow-hidden"
            >
              {/* Header */}
              <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-white mb-1">
                  {winnerInfo.winner._id === 'no-winner' ? '🏁 GAME ENDED' : '🎉 BINGO WINNER!'}
                </h1>
                <p className="text-white/70 text-sm">
                  Game #{winnerInfo.gameCode || id}
                </p>
              </div>

              {/* Winner Profile */}
              {winnerInfo.winner._id === 'no-winner' ? (
                <div className="bg-gradient-to-r from-purple-800/50 to-blue-800/50 rounded-xl p-4 mb-4 border border-white/20">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gray-600 to-gray-800 flex items-center justify-center text-2xl font-bold mb-3">
                      🏁
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">
                      No Winner
                    </h3>
                    <p className="text-white/70 text-sm text-center mt-1">
                      All 75 numbers called
                    </p>
                    <div className="mt-3 text-center px-3 py-2 bg-gradient-to-r from-gray-700/50 to-gray-900/50 rounded-lg w-full">
                      <p className="text-green-300 text-sm font-medium">
                        10 ብር refunded to all players
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-purple-800/50 to-blue-800/50 rounded-xl p-4 mb-4 border border-white/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-xl font-bold">
                      {isUserWinner ? 'YOU' : winnerInfo.winner.firstName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {isUserWinner ? '🎊 YOU WON!' : winnerInfo.winner.firstName}
                      </h3>
                      <p className="text-white/70 text-sm">
                        @{winnerInfo.winner.username}
                      </p>
                    </div>
                  </div>

                  {/* Prize Amount */}
                  <div className="text-center py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg">
                    <p className="text-white/80 text-xs mb-1">Prize Amount</p>
                    <p className="text-2xl font-bold text-yellow-300">
                      {winningAmount} ብር
                    </p>
                    {isUserWinner && (
                      <p className="text-green-300 text-xs mt-1">
                        💰 Added to your wallet
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Game Stats */}
              <div className="bg-gradient-to-r from-gray-900 to-black rounded-xl p-3 mb-4 border border-white/10">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-white/70 text-xs">Players</p>
                    <p className="text-white text-lg font-bold">{winnerInfo.totalPlayers}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-xs">Numbers</p>
                    <p className="text-white text-lg font-bold">{winnerInfo.numbersCalled}/75</p>
                  </div>
                </div>
                {winnerInfo.winner._id !== 'no-winner' && winnerInfo.winningPattern && (
                  <div className="mt-3 pt-3 border-t border-white/20 text-center">
                    <p className="text-white/70 text-xs mb-1">Winning Pattern</p>
                    <p className="text-green-300 text-sm font-medium">
                      {getPatternName(winnerInfo.winningPattern)}
                    </p>
                  </div>
                )}
              </div>
   {winnerInfo.winner._id !== 'no-winner' && winnerInfo.winningCard?.numbers && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-bold text-sm">
                Winning Card #{winnerInfo.winningCard?.cardNumber || 'N/A'}
              </h3>
              <div className="text-yellow-300 text-xs bg-yellow-500/20 px-2 py-1 rounded-full">
                Winner
              </div>
            </div>

            {/* Mini Bingo Card */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-3 border border-yellow-500/30">
              {/* Mini BINGO Header */}
              <div className="grid grid-cols-5 gap-1 mb-2">
                {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                  <div
                    key={letter}
                    className="h-6 rounded flex items-center justify-center font-bold text-xs text-white bg-gradient-to-b from-purple-700 to-blue-800"
                  >
                    {letter}
                  </div>
                ))}
              </div>

              {/* Mini Card Numbers */}
             {winnerInfo.winner._id !== 'no-winner' && winnerInfo.winningCard?.numbers && (
  <div className="mb-4">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-white font-bold text-sm">
        Winning Card #{winnerInfo.winningCard?.cardNumber || 'N/A'}
      </h3>
      <div className="text-yellow-300 text-xs bg-yellow-500/20 px-2 py-1 rounded-full">
        Winner
      </div>
    </div>

    {/* Mini Bingo Card */}
    {winnerInfo.winner._id !== 'no-winner' && winnerInfo.winningCard?.numbers && (
  <div className="mb-4">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-white font-bold text-sm">
        Winning Card #{winnerInfo.winningCard?.cardNumber || 'N/A'}
      </h3>
      <div className="text-yellow-300 text-xs bg-yellow-500/20 px-2 py-1 rounded-full">
        Winner
      </div>
    </div>

    {/* Mini Bingo Card */}
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-3 border border-yellow-500/30">
      {/* Mini BINGO Header */}
      <div className="grid grid-cols-5 gap-1 mb-2">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div
            key={letter}
            className="h-6 rounded flex items-center justify-center font-bold text-xs text-white bg-gradient-to-b from-purple-700 to-blue-800"
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Mini Card Numbers - FIXED VERSION */}
      <div className="grid grid-cols-5 gap-1">
        {winnerInfo.winningCard.numbers.map((row: (number | string)[], rowIndex: number) =>
          row.map((number: number | string, colIndex: number) => {
            const flatIndex = rowIndex * 5 + colIndex;
            const isMarked = winnerInfo.winningCard?.markedPositions?.includes(flatIndex);
            const isWinningPos = isWinningPosition(rowIndex, colIndex);
            const isFreeSpace = rowIndex === 2 && colIndex === 2;

            // CRITICAL FIX: Check winning position FIRST, then marked
            let bgClass = 'bg-gray-800 text-white/70'; // Default
            
            if (isFreeSpace) {
              bgClass = 'bg-purple-700 text-white';
            } else if (isWinningPos) {
              // Winning position gets yellow - HIGHEST PRIORITY
              bgClass = 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-[0_0_8px_rgba(251,191,36,0.6)]';
            } else if (isMarked) {
              // Marked but not winning gets green - LOWER PRIORITY
              bgClass = 'bg-green-600 text-white';
            }

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  h-8 rounded flex items-center justify-center 
                  font-bold text-xs relative transition-all duration-300
                  ${bgClass}
                `}
              >
                {isFreeSpace ? (
                  <span className="text-[10px] font-bold">FREE</span>
                ) : (
                  <span className={`
                    ${isMarked && !isWinningPos ? 'line-through' : ''}
                    ${isWinningPos ? 'font-extrabold' : ''}
                  `}>
                    {number}
                  </span>
                )}
                
                {/* Add special animation for winning positions */}
                {isWinningPos && (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full shadow-[0_0_4px_rgba(251,191,36,0.8)] z-10"
                    />
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 0.9, 0.7]
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 2,
                        ease: "easeInOut"
                      }}
                      className="absolute inset-0 rounded bg-gradient-to-br from-yellow-400/30 to-orange-400/20"
                    />
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Legend for colors - Updated */}
      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/20">
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-yellow-500 to-orange-500 shadow-[0_0_4px_rgba(251,191,36,0.6)]"></div>
            <span className="text-[10px] text-white/70">Winning Pattern</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-600"></div>
            <span className="text-[10px] text-white/70">Marked Numbers</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-purple-700"></div>
          <span className="text-[10px] text-white/70">Free Space</span>
        </div>
      </div>
    </div>
  </div>
)}
  </div>
)}
            </div>
          </div>
        )}

              {/* Countdown */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="text-center">
                  <p className="text-white/70 text-sm mb-1">
                    {winnerInfo.winner._id === 'no-winner' 
                      ? 'Next game starts in:' 
                      : 'Returning to lobby in:'}
                  </p>
                  <div className="text-2xl font-bold text-yellow-300 mb-2">
                    {countdown}s
                  </div>
                  <p className="text-white/60 text-xs">
                    {winnerInfo.winner._id === 'no-winner' 
                      ? 'Refunds processed automatically'
                      : 'Get ready for the next game'}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay for winner info */}
      {isWinnerLoading && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="bg-gradient-to-br from-purple-700 to-blue-800 rounded-2xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white font-medium">Loading winner information...</p>
          </div>
        </div>
      )}

      {/* Disqualification Warning Banner */}
      {isDisqualified && !showDisqualificationModal && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-2xl p-4 mb-6 backdrop-blur-lg cursor-pointer"
          onClick={() => setShowDisqualificationModal(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⛔</div>
              <div>
                <h3 className="text-white font-bold text-lg">DISQUALIFIED</h3>
                <p className="text-white/80 text-sm">Click for details</p>
              </div>
            </div>
            <div className="text-white/60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
        <div className="grid grid-cols-6 gap-4 text-center">
          <div>
            <p className="text-white text-xs font-semibold">{walletBalance} ብር</p>
            <p className="text-white/60 text-xs">Balance</p>
          </div>
          <div>
            <p className="text-white font-semibold text-xs">{(game?.currentPlayers||0)*10*0.8} ብር</p>
            <p className="text-white/60 text-xs">Pot</p>
          </div>
          <div>
            <p className="text-white font-semibold text-xs">{game?.currentPlayers || 0}</p>
            <p className="text-white/60 text-xs">Players</p>
          </div>
          <div>
            <p className="text-white font-semibold text-xs">10 ብር</p>
            <p className="text-white/60 text-xs">Bet</p>
          </div>
          <div>
            <p className="text-white font-semibold text-xs">
              {selectedNumber && !isDisqualified ? `#${selectedNumber}` : 'N/A'}
            </p>
            <p className="text-white/60 text-xs">Your Card</p>
          </div>
          <div>
            <p className="text-white font-semibold text-xs">{allCalledNumbers.length}/75</p>
            <p className="text-white/60 text-xs">Called</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {/* Left: Called Numbers */}
        <div className="col-span-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
            {/* BINGO Header */}
            <div className="grid grid-cols-5 gap-1 mb-2">
              {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                <div
                  key={letter}
                  className="h-8 rounded flex items-center justify-center font-bold text-md text-white bg-gradient-to-b from-purple-600/70 to-blue-700/70"
                >
                  {letter}
                </div>
              ))}
            </div>

            {/* Called Numbers Grid */}
            <div className="grid grid-cols-5 gap-1">
              {[
                { letter: 'B', range: { start: 1, end: 15 } },
                { letter: 'I', range: { start: 16, end: 30 } },
                { letter: 'N', range: { start: 31, end: 45 } },
                { letter: 'G', range: { start: 46, end: 60 } },
                { letter: 'O', range: { start: 61, end: 75 } }
              ].map((column) => {
                const numbersInColumn = Array.from(
                  { length: column.range.end - column.range.start + 1 },
                  (_, i) => column.range.start + i
                );

                return (
                  <div key={column.letter} className="flex flex-col gap-1">
                    {numbersInColumn.map((number: number) => {
                      const isCalled = allCalledNumbers.includes(number);
                      const isCurrent = currentCalledNumber?.number === number;

                      return (
                        <motion.div
                          key={number}
                          layout
                          initial={false}
                          animate={{
                            scale: isCurrent && currentCalledNumber?.isNew ? 1.1 : 1,
                          }}
                          className={`
                            aspect-square rounded flex items-center justify-center 
                            transition-all duration-200 cursor-pointer relative
                            ${isCurrent && currentCalledNumber?.isNew
                              ? 'bg-gradient-to-br from-yellow-500 to-orange-500 scale-105 ring-2 ring-yellow-400'
                              : isCurrent
                                ? 'bg-gradient-to-br from-yellow-500 to-orange-500 ring-1 ring-yellow-400'
                                : isCalled
                                  ? 'bg-gradient-to-br from-red-500 to-pink-600'
                                  : 'bg-white/10'
                            }
                          `}
                          onClick={() => isCalled && game?.status === 'ACTIVE' && !isDisqualified && handleMarkNumber(number)}
                        >
                          <span className={`
                            text-xs font-bold
                            ${isCurrent ? 'text-white' : isCalled ? 'text-white' : 'text-white/70'}
                          `}>
                            {number}
                          </span>

                          {isCurrent && currentCalledNumber?.isNew && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Bingo Card */}
        <div className="col-span-3">
          {/* Current Called Number Display */}
          {currentCalledNumber && (
            <div className="mb-3 sm:mb-4">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-3 rounded-2xl shadow-lg font-bold text-center">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <div className="text-xl sm:text-2xl">
                      {currentCalledNumber.letter}{currentCalledNumber.number}
                    </div>
                  </div>
                  <span className="text-2xl">🔔</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Recent Called Numbers */}
          {recentCalledNumbers.length > 0 && (
            <div className="mb-3 sm:mb-4">
              <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg rounded-xl border border-white/20 p-3">
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {recentCalledNumbers.map((item, index) => (
                    <motion.div
                      key={`${item.number}-${index}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={`
                        flex-1 max-w-[80px] aspect-square rounded-lg
                        flex flex-col items-center justify-center
                        transition-all duration-300
                        ${item.isCurrent
                          ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-400/50 shadow-lg shadow-yellow-500/20'
                          : 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10'
                        }
                      `}
                    >
                      <div className={`
                        text-xs sm:text-sm font-bold mb-0.5
                        ${item.isCurrent ? 'text-yellow-300' : 'text-white/70'}
                      `}>
                        {item.letter}
                      </div>
                      <div className={`
                        text-lg sm:text-xl md:text-2xl font-bold
                        ${item.isCurrent ? 'text-white' : 'text-white/90'}
                      `}>
                        {item.number}
                      </div>
                      {item.isCurrent && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="mt-1 w-2 h-2 bg-yellow-400 rounded-full"
                        />
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Bingo Card Display */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <h3 className="text-white font-bold text-sm sm:text-base md:text-md">
                  {isDisqualified ? 'DISQUALIFIED CARD' : 'Your Bingo Card'}
                </h3>
                {selectedNumber && !isDisqualified && (
                  <span className="text-white/90 text-xs sm:text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-full font-medium">
                    Card #{selectedNumber}
                  </span>
                )}
              </div>
              {!isDisqualified && (
                <div className="text-white/70 text-xs sm:text-sm bg-white/10 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-full">
                  Marked: <span className="text-white font-bold ml-0.5 sm:ml-1">{displayBingoCard?.markedPositions?.length || 0}</span>/24
                </div>
              )}
            </div>

            {isDisqualified ? (
              <div className="text-center py-12 bg-gradient-to-br from-red-900/20 to-orange-900/20 rounded-2xl border border-red-500/30">
                <div className="text-5xl mb-4">⛔</div>
                <h3 className="text-xl font-bold text-white mb-2">CARD DISQUALIFIED</h3>
                <p className="text-white/70 text-sm mb-4">
                  {disqualificationMessage || 'Your card has been removed from the game'}
                </p>
                <button
                  onClick={() => setShowDisqualificationModal(true)}
                  className="bg-gradient-to-r from-red-600/30 to-orange-600/30 text-white px-6 py-2 rounded-lg hover:from-red-600/40 hover:to-orange-600/40 transition-all text-sm"
                >
                  View Disqualification Details
                </button>
              </div>
            ) : displayBingoCard ? (
              <div className="mb-3 sm:mb-4">
                {/* BINGO Header */}
                <div className="grid grid-cols-5 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                    <div
                      key={letter}
                      className="aspect-square rounded-lg flex items-center justify-center font-bold text-base sm:text-lg md:text-xl text-white bg-gradient-to-b from-purple-600 to-blue-700"
                    >
                      {letter}
                    </div>
                  ))}
                </div>

                {/* Card Numbers */}
                <div className="grid grid-cols-5 gap-0.5 sm:gap-1">
                  {displayBingoCard.numbers.map((row: (number | string)[], rowIndex: number) =>
                    row.map((number: number | string, colIndex: number) => {
                      const flatIndex = rowIndex * 5 + colIndex;
                      const isMarked = displayBingoCard.markedPositions?.includes(flatIndex);
                      const isCalled = allCalledNumbers.includes(number as number);
                      const isFreeSpace = rowIndex === 2 && colIndex === 2;

                      return (
                        <motion.div
                          key={`${rowIndex}-${colIndex}`}
                          layout
                          initial={false}
                          animate={{
                            scale: isCalled && !isMarked && game?.status === 'ACTIVE' ? 1.02 : 1,
                          }}
                          className={`
                            aspect-square rounded-sm flex items-center justify-center 
                            font-bold transition-all duration-200 relative
                            ${isMarked
                              ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white border-2 border-green-400'
                              : isFreeSpace
                                ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white border-2 border-purple-400'
                                : 'bg-white/15 text-white'
                            }
                            ${isCalled && !isMarked && !isFreeSpace && game?.status === 'ACTIVE'
                              ? 'cursor-pointer'
                              : 'cursor-default'
                            }
                          `}
                          onClick={() => {
                            if (game?.status === 'ACTIVE' && !isFreeSpace && isCalled && !isMarked) {
                              handleMarkNumber(number as number);
                            }
                          }}
                        >
                          {isFreeSpace ? (
                            <div className="flex flex-col items-center justify-center w-full h-full p-0.5 sm:p-1">
                              <span className="text-[10px] xs:text-xs sm:text-sm font-bold">FREE</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full p-0.5 sm:p-1 relative">
                              <span className={`
                                text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl
                                ${isMarked ? 'line-through' : ''}
                              `}>
                                {number}
                              </span>
                              {isMarked && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 text-[8px] sm:text-[10px] opacity-90"
                                >
                                  ✓
                                </motion.div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-white/70 py-6 sm:py-8">
                <p className="text-base sm:text-lg mb-1.5 sm:mb-2">No bingo card found</p>
                <p className="text-xs sm:text-sm mb-4 sm:mb-6">{spectatorMessage || 'Join the game to get a card'}</p>
                {game?.status === 'WAITING_FOR_PLAYERS' || game?.status === 'CARD_SELECTION' ? (
                  <button
                    onClick={() => router.push('/')}
                    className="bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-white px-4 sm:px-6 py-1.5 sm:py-2.5 rounded-lg hover:from-purple-500/40 hover:to-blue-500/40 transition-all text-sm sm:text-base"
                  >
                    Select a Card
                  </button>
                ) : (
                  <p className="text-white/50 text-xs sm:text-sm">
                    Game has already started. You can watch as a spectator.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claim Bingo Button */}
      {game?.status === 'ACTIVE' && displayBingoCard && !isSpectatorMode && !isDisqualified && allCalledNumbers.length > 0 && (
        <div className="fixed bottom-4 right-2 sm:right-4 md:right-6 z-10">
          <div className="flex flex-col items-end">
            <button
              onClick={handleClaimBingo}
              disabled={isClaimingBingo}
              className={`
                bg-gradient-to-r from-yellow-600 to-orange-600 
                text-white px-4 py-3 sm:px-6 sm:py-3 md:px-8 md:py-4 
                rounded-xl sm:rounded-2xl font-bold 
                text-sm sm:text-base md:text-lg
                shadow-lg shadow-orange-800
                hover:from-yellow-600 hover:to-orange-600
                active:scale-95 transition-all duration-200
                flex items-center gap-1 sm:gap-2 md:gap-3 justify-center
                ${isClaimingBingo ? 'opacity-70 cursor-not-allowed' : ''}
                whitespace-nowrap
                max-w-[200px] sm:max-w-none
              `}
            >
              {isClaimingBingo ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                  <span className="text-xs sm:text-sm">Verifying...</span>
                </>
              ) : (
                <>
                  <span className="text-lg sm:text-xl md:text-2xl">🏆</span>
                  <span className="text-xs sm:text-sm md:text-base">CLAIM BINGO</span>
                  <span className="text-lg sm:text-xl md:text-2xl">🏆</span>
                </>
              )}
            </button>

            {claimResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  mt-2 p-2 rounded-lg text-center text-xs font-medium max-w-[200px]
                  ${claimResult.success
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }
                `}
              >
                {claimResult.message}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
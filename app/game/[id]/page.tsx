/* eslint-disable @typescript-eslint/no-explicit-any */
// app/game/[id]/page.tsx - COMPLETE FIXED VERSION
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
}

interface WinnerInfo {
  winner: {
    _id: string;
    username: string;
    firstName: string;
    telegramId?: string;
  };
  gameCode: string;
  endedAt: string;
  totalPlayers: number;
  numbersCalled: number;
  winningPattern?: string;
  winningCard?: {
    cardNumber: number;
    numbers: (number | string)[][];
    markedPositions: number[];
    winningPatternPositions?: number[];
  };
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

  // Refs
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameEndedCheckRef = useRef(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastGameStateRef = useRef<any>(null);
  const hasCardCheckedRef = useRef(false);
  const updateInProgressRef = useRef(false);
  const lastUpdateTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cardUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
//disquaified
const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
const [disqualificationMessage, setDisqualificationMessage] = useState<string>('');
  // Polling intervals
  const POLL_INTERVAL = 3000;
  const MIN_UPDATE_INTERVAL = 1500;

  // Helper function to get BINGO letter
  const getNumberLetter = (num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  // FIXED: Check if user has a bingo card
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
      
      // Check if card is disqualified
      if (apiCard.isDisqualified) {
        setIsDisqualified(true);
        setDisqualificationMessage(apiCard.disqualificationReason || 'Your card has been disqualified');
        setIsSpectatorMode(true);
        setSpectatorMessage('Your card has been disqualified. Watching as spectator.');
        setCardError('');
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
    console.error('Error checking user card:', error);

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
}, [id, localBingoCard, autoRetryInProgress]);

  // FIXED: Initialize user card
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
          console.log(`🔄 Auto-retry attempt ${attempts} for card loading...`);
          setAutoRetryInProgress(true);
        }

        try {
          success = await checkUserHasCard(forceCheck, attempts > 1);

          if (success) {
            console.log('✅ Card loaded successfully on attempt', attempts);
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

      if (!success && !isSpectatorMode) {
        console.log('⚠️ All retry attempts failed, falling back to spectator mode');
        setIsSpectatorMode(true);
        setSpectatorMessage('Unable to load your card. Watching as spectator.');
        setCardError('');
      }

    } catch (error: any) {
      console.error('Failed to initialize user card:', error);
      if (!isSpectatorMode) {
        setIsSpectatorMode(true);
        setSpectatorMessage('Unable to load your card. Watching as spectator.');
        setCardError('');
      }
    } finally {
      setIsLoadingCard(false);
      setAutoRetryInProgress(false);
      updateInProgressRef.current = false;
    }
  }, [checkUserHasCard, isSpectatorMode]);

  // Auto-retry card loading
  useEffect(() => {
    if (cardError && !localBingoCard && !isLoadingCard && retryCount < MAX_RETRY_ATTEMPTS) {
      const timer = setTimeout(() => {
        console.log('🔄 Auto-retrying card loading...');
        setIsLoadingCard(true);
        setCardError('');
        hasCardCheckedRef.current = false;
        initializeUserCard(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [cardError, localBingoCard, isLoadingCard, retryCount, initializeUserCard]);

  // FIXED: Check for winner
  const checkForWinner = useCallback(async (gameData?: Game) => {
    if (!gameData || abortControllerRef.current || showWinnerModal) return;

    try {
      setIsWinnerLoading(true);
      abortControllerRef.current = new AbortController();
      const winnerData = await getWinnerInfo();

      if (winnerData) {
        setWinnerInfo(winnerData);
        
        const hasWinner = !!winnerData.winner?._id;
        
        if (hasWinner) {
          const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
          if (userId) {
            const isWinner = winnerData.winner.telegramId === userId ||
              winnerData.winner._id.toString() === userId;
            setIsUserWinner(isWinner);

            const totalPot = (gameData.currentPlayers || 0) * 10;
            const platformFee = totalPot * 0.2;
            const winnerPrize = totalPot - platformFee;
            setWinningAmount(winnerPrize);
          }
        } else {
          setIsUserWinner(false);
          setWinningAmount(0);
          
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
        console.log('🗑️ Cleared stored card selection because game ended');

        setTimeout(() => {
          setShowWinnerModal(true);
          setIsWinnerLoading(false);

          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }, 1500);
      } else {
        if (gameData.status === 'FINISHED' || gameData.status === 'NO_WINNER') {
          const hasNoWinner = gameData.status === 'NO_WINNER' || gameData.noWinner;
          
          if (hasNoWinner) {
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
            console.log('🗑️ Cleared stored card selection because game ended with no winner');

            setTimeout(() => {
              setShowWinnerModal(true);
              setIsWinnerLoading(false);

              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }, 1500);
          } else if (gameData.status === 'FINISHED') {
            console.log('Game finished but no winner data, fetching...');
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch winner info:', error);
        setIsWinnerLoading(false);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [getWinnerInfo, showWinnerModal, clearSelectedCard]);

  // FIXED: Update game state
  const updateGameState = useCallback(async (force = false) => {
    if (updateInProgressRef.current && !force) return;
    if (!id || showWinnerModal) return;

    const now = Date.now();
    if (!force && now - lastUpdateTimeRef.current < MIN_UPDATE_INTERVAL) {
      return;
    }

    try {
      updateInProgressRef.current = true;
      lastUpdateTimeRef.current = now;

      const response = await gameAPI.getGame(id);
      const updatedGame = response.data.game as Game;

      if (updatedGame) {
        const currentState = lastGameStateRef.current;

        const numbersChanged = !currentState ||
          JSON.stringify(currentState.numbersCalled) !== JSON.stringify(updatedGame.numbersCalled);

        const statusChanged = currentState?.status !== updatedGame.status;
        const winnerChanged = currentState?.winnerId !== updatedGame.winnerId;

        if (numbersChanged || statusChanged || winnerChanged || force) {
          if (updatedGame.numbersCalled && updatedGame.numbersCalled.length > 0) {
            setAllCalledNumbers(updatedGame.numbersCalled);

            const lastNumber = updatedGame.numbersCalled[updatedGame.numbersCalled.length - 1];
            if (lastNumber) {
              setCurrentCalledNumber({
                number: lastNumber,
                letter: getNumberLetter(lastNumber),
                isNew: numbersChanged
              });

              if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
              }

              animationTimeoutRef.current = setTimeout(() => {
                setCurrentCalledNumber(prev =>
                  prev ? { ...prev, isNew: false } : null
                );
              }, 100);
            }
          }

          if (updatedGame.status === 'FINISHED' && updatedGame.winnerId && !gameEndedCheckRef.current) {
            gameEndedCheckRef.current = true;
            await checkForWinner(updatedGame);
          }

          lastGameStateRef.current = updatedGame;
        }
      }
    } catch (error) {
      console.warn('Failed to update game state:', error);
    } finally {
      updateInProgressRef.current = false;
    }
  }, [id, showWinnerModal, checkForWinner, MIN_UPDATE_INTERVAL]);

  // FIXED: Start polling
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    
    console.log('📡 Starting efficient polling...');
    
    updateGameState(true);
    
    pollingRef.current = setInterval(() => {
      if (game?.status === 'ACTIVE' && !showWinnerModal) {
        updateGameState(false);
      } else {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }, POLL_INTERVAL);
  }, [updateGameState, game?.status, showWinnerModal, POLL_INTERVAL]);

  // Initialize game
  useEffect(() => {
    if (initializationAttempted) return;
    
    const initializeGame = async () => {
      try {
        setInitializationAttempted(true);
        console.log('🎮 Initializing game page...');
        
        if (!game) {
          console.log('Game not loaded yet, waiting...');
          return;
        }
        
        const cardCheckTimeout = setTimeout(() => {
          if (isLoadingCard) {
            console.log('⏱️ Card check timeout, proceeding...');
            setIsLoadingCard(false);
          }
        }, 3000);
        
        await initializeUserCard();
        clearTimeout(cardCheckTimeout);
        
      } catch (error) {
        console.error('Failed to initialize game:', error);
        setIsLoadingCard(false);
      }
    };
    
    if (!isLoading && game && !initializationAttempted) {
      initializeGame();
    }
  }, [game, isLoading, initializeUserCard, initializationAttempted]);

  // Handle game status changes
  useEffect(() => {
    if (!game) return;

    if (game.status === 'ACTIVE' && !pollingRef.current) {
      startPolling();
    } else if ((game.status === 'FINISHED' || game.status === 'NO_WINNER' || game.status === 'CANCELLED' || game.status === 'COOLDOWN') && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if ((game.status === 'FINISHED' || game.status === 'NO_WINNER') && !showWinnerModal && !gameEndedCheckRef.current) {
      gameEndedCheckRef.current = true;
      checkForWinner(game as Game);
    }
    
    if (game.status === 'COOLDOWN' && !showWinnerModal && !gameEndedCheckRef.current) {
      gameEndedCheckRef.current = true;
      checkForWinner(game as Game);
    }

    if (game.status === 'CANCELLED') {
      clearSelectedCard();
      console.log('🗑️ Cleared stored card selection because game was cancelled');
    }
  }, [game, startPolling, showWinnerModal, checkForWinner, clearSelectedCard]);

  // FIXED: Countdown for winner modal
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

  // Safety timeout to exit loading state
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (isLoadingCard) {
        console.warn('⚠️ Loading timed out, forcing exit from loading state');
        setIsLoadingCard(false);
        setCardError('Loading timed out. Please refresh or check your connection.');
      }
    }, 20000);

    return () => clearTimeout(safetyTimeout);
  }, [isLoadingCard]);

  // FIXED: Handle manual number marking with immediate UI feedback
  const handleMarkNumber = async (number: number) => {
    if (isMarking || !allCalledNumbers.includes(number) || game?.status !== 'ACTIVE') return;

    try {
      setIsMarking(true);
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) throw new Error('User ID not found');

      // IMMEDIATE UI UPDATE: Mark the number locally first
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

      // Then send to backend (fire-and-forget)
      gameAPI.markNumber(id, userId, number)
        .then(response => {
          if (response.data.success) {
            console.log(`✅ Successfully marked number: ${number}`);
          } else {
            // If backend fails, revert the UI change
            console.warn('Backend marking failed, reverting UI...');
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
          }
        })
        .catch(error => {
          console.error('Failed to mark number on backend:', error);
          // Revert UI change on error
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
          
          setClaimResult({
            success: false,
            message: error.response?.data?.message || 'Failed to save mark'
          });
          setTimeout(() => setClaimResult(null), 3000);
        });

      setTimeout(() => updateGameState(true), 1000);
    } catch (error: any) {
      console.error('Failed to mark number:', error);
      setClaimResult({
        success: false,
        message: error.response?.data?.message || 'Failed to mark number'
      });
      setTimeout(() => setClaimResult(null), 3000);
    } finally {
      setIsMarking(false);
    }
  };

  // FIXED: Handle manual Bingo claim
const handleClaimBingo = async () => {
  if (isClaimingBingo || !id || game?.status !== 'ACTIVE' || !localBingoCard) return;

  try {
    setIsClaimingBingo(true);
    setClaimResult(null);

    const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
    if (!userId) throw new Error('User ID not found');

    const response = await gameAPI.claimBingo(id, userId, 'BINGO');

    if (response.data.success) {
      setClaimResult({
        success: true,
        message: response.data.message || 'Bingo claimed successfully!',
        patternType: response.data.patternType,
        prizeAmount: response.data.prizeAmount
      });

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      setTimeout(() => updateGameState(true), 2000);
    } else {
      // Handle backend error response
      const errorMsg = response.data.message || response.data.error || 'Failed to claim bingo';
      setClaimResult({
        success: false,
        message: errorMsg
      });
      
      // Check for disqualification in error message
      if (errorMsg.toLowerCase().includes('disqualified') || 
          errorMsg.toLowerCase().includes('false bingo claim')) {
        handleDisqualification(errorMsg);
      }
    }
  } catch (error: any) {
    console.error('❌ Bingo claim failed:', error);
    
    // Get the actual error message from the API response
    let errorMessage = 'Failed to claim bingo';
    
    if (error.response?.data) {
      // Try multiple possible error fields
      errorMessage = error.response.data.error || 
                     error.response.data.message || 
                     error.message || 
                     'Failed to claim bingo';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.log('Raw error data:', {
      responseData: error.response?.data,
      errorMessage
    });
    
    setClaimResult({
      success: false,
      message: errorMessage
    });
    
    // Check if this is a disqualification error
    const isDisqualifiedError = errorMessage.toLowerCase().includes('disqualified') || 
                                errorMessage.toLowerCase().includes('false bingo claim');
    
    if (isDisqualifiedError) {
      handleDisqualification(errorMessage);
    }
  } finally {
    setIsClaimingBingo(false);

    // Show disqualification message longer
    setTimeout(() => {
      setClaimResult(null);
    }, isDisqualified ? 10000 : 5000);
  }
};
// Helper function to handle disqualification

const handleDisqualification = (errorMessage: string) => {
  console.log('🚨 User disqualified:', errorMessage);
  
  // Update disqualification state
  setIsDisqualified(true);
  setDisqualificationMessage(errorMessage);
  
  // Mark card as disqualified in local state
  if (localBingoCard) {
    setLocalBingoCard({
      ...localBingoCard,
      isDisqualified: true,
    });
  }
  
  // Set spectator mode
  setIsSpectatorMode(true);
  setSpectatorMessage('You have been disqualified. Watching as spectator.');
  
  // Show a more prominent error message
  setClaimResult({
    success: false,
    message: `❌ ${errorMessage}`
  });
};
  // Handle returning to lobby
  const handleReturnToLobby = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (cardUpdateTimeoutRef.current) clearTimeout(cardUpdateTimeoutRef.current);

    setShowWinnerModal(false);
    setWinnerInfo(null);
    setIsUserWinner(false);
    setWinningAmount(0);
    setCurrentCalledNumber(null);
    setAllCalledNumbers([]);
    setClaimResult(null);
    setCountdown(10);

    gameEndedCheckRef.current = false;
    hasCardCheckedRef.current = false;
    updateInProgressRef.current = false;
    lastUpdateTimeRef.current = 0;

    router.push('/');
  };

  // Handle play again
  const handlePlayAgain = () => {
    handleReturnToLobby();
  };

  // Manual refresh button
  const handleManualRefresh = useCallback(() => {
    updateGameState(true);
  }, [updateGameState]);

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
  
  // 1. Show loading while useGame is fetching
  if (isLoading) {
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

  // 2. Show game not found only after loading is complete
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

  // 3. Show loading while fetching user card
  if (isLoadingCard && !cardError && !isSpectatorMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading your bingo card...</p>
          {retryCount > 0 && (
            <p className="text-white/60 text-sm mt-2">
              {retryCount < MAX_RETRY_ATTEMPTS 
                ? `Attempt ${retryCount} of ${MAX_RETRY_ATTEMPTS}`
                : 'Final attempt...'
              }
            </p>
          )}
          {autoRetryInProgress && (
            <p className="text-white/60 text-sm mt-2">Auto-retrying...</p>
          )}
        </div>
      </div>
    );
  }

  // Main game render - game exists and loading is complete
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4 relative">
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

              {/* Winner Profile - Compact */}
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

                  {/* Prize Amount - Compact */}
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

              {/* Game Stats - Compact */}
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

              {/* Winning Card - Compact (if exists) */}
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
                    <div className="grid grid-cols-5 gap-1">
                      {winnerInfo.winningCard.numbers.map((row: (number | string)[], rowIndex: number) =>
                        row.map((number: number | string, colIndex: number) => {
                          const flatIndex = rowIndex * 5 + colIndex;
                          const isMarked = winnerInfo.winningCard?.markedPositions?.includes(flatIndex);
                          const isWinningPos = isWinningPosition(rowIndex, colIndex);
                          const isFreeSpace = rowIndex === 2 && colIndex === 2;

                          return (
                            <div
                              key={`${rowIndex}-${colIndex}`}
                              className={`
                                h-8 rounded flex items-center justify-center 
                                font-bold text-xs relative
                                ${isWinningPos
                                  ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white'
                                  : isMarked
                                    ? 'bg-green-600 text-white'
                                    : isFreeSpace
                                      ? 'bg-purple-700 text-white'
                                      : 'bg-gray-800 text-white/70'
                                }
                              `}
                            >
                              {isFreeSpace ? (
                                <span className="text-[10px] font-bold">FREE</span>
                              ) : (
                                <span className={`${isMarked ? 'line-through' : ''}`}>
                                  {number}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Countdown Only */}
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
              {selectedNumber ? `#${selectedNumber}` : 'N/A'}
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
                          onClick={() => isCalled && game?.status === 'ACTIVE' && handleMarkNumber(number)}
                          title={`${column.letter}${number} ${isCurrent ? '(Current)' : isCalled ? '(Called)' : ''}`}
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
          {/* Permanent Current Called Number Display - Added here */}
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
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <h3 className="text-white font-bold text-sm sm:text-base md:text-md">Your Bingo Card</h3>
                {selectedNumber && (
                  <span className="text-white/90 text-xs sm:text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-full font-medium">
                    Card #{selectedNumber}
                  </span>
                )}
              </div>
              <div className="text-white/70 text-xs sm:text-sm bg-white/10 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-full">
                Marked: <span className="text-white font-bold ml-0.5 sm:ml-1">{displayBingoCard?.markedPositions?.length || 0}</span>/24
              </div>
            </div>

            {displayBingoCard ? (
              <div className="mb-3 sm:mb-4">
                {/* BINGO Header - Responsive text sizes */}
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

                {/* Card Numbers - Responsive grid with adjustable gap */}
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
                          whileHover={isCalled && !isMarked && !isFreeSpace && game?.status === 'ACTIVE' ? {
                            scale: 1.05,
                            backgroundColor: 'rgba(255, 255, 255, 0.25)'
                          } : {}}
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
                             if (isDisqualified) return; // Disable clicks if disqualified
                            if (game?.status === 'ACTIVE' && !isFreeSpace && isCalled && !isMarked) {
                              handleMarkNumber(number as number);
                            }
                          }}
                          title={
                            isFreeSpace ? 'FREE SPACE (Always marked)' :
                              isMarked ? `Marked: ${number}` :
                                isCalled ? `Click to mark ${number}` :
                                  `${number} (Not called yet)`
                          }
                        >
                          {isFreeSpace ? (
                            <div className="flex flex-col items-center justify-center w-full h-full p-0.5 sm:p-1">
                              <span className="text-[10px] xs:text-xs sm:text-sm font-bold">FREE</span>
                              <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 text-[8px] sm:text-[10px] opacity-90">✓</div>
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

      {/* Claim Bingo Button - Fixed Position */}
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

            {/* Optional: Compact result message for mobile */}
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
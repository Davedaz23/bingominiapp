/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/hooks/useCardSelection.ts - OPTIMIZED VERSION
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';
import { useAccountStorage } from './useAccountStorage';

// ⭐ MOVE generateBingoCard OUTSIDE the hook
const generateBingoCard = (cardNumber: number) => {
  const seed = cardNumber * 12345;
  const card = [];
  
  const ranges = [
    { min: 1, max: 15 },
    { min: 16, max: 30 },
    { min: 31, max: 45 },
    { min: 46, max: 60 },
    { min: 61, max: 75 }
  ];

  for (let col = 0; col < 5; col++) {
    const column = [];
    const usedNumbers = new Set();
    const range = ranges[col];
    
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        column.push('FREE');
        continue;
      }
      
      let number;
      let attempts = 0;
      do {
        const random = Math.sin(seed + col * 5 + row) * 10000;
        number = range.min + Math.floor((random - Math.floor(random)) * (range.max - range.min + 1));
        attempts++;
      } while (usedNumbers.has(number) && attempts < 10);
      
      usedNumbers.add(number);
      column.push(number);
    }
    card.push(column);
  }
  
  return card;
};

export const useCardSelection = (gameData: any, gameStatus: string) => {
  const { user, walletBalance } = useAuth();
  const { getAccountData, setAccountData, removeAccountData } = useAccountStorage(user);
  
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [bingoCard, setBingoCard] = useState<(number | string)[][] | null>(null);
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [takenCards, setTakenCards] = useState<{cardNumber: number, userId: string}[]>([]);
  const [cardSelectionStatus, setCardSelectionStatus] = useState<{
    isSelectionActive: boolean;
    selectionEndTime: Date | null;
    timeRemaining: number;
  }>({
    isSelectionActive: false,
    selectionEndTime: null,
    timeRemaining: 0
  });
  const [cardSelectionError, setCardSelectionError] = useState<string>('');
  
  // Refs to track last request times and prevent flooding
  const lastTakenCardsFetchRef = useRef<number>(0);
  const lastAvailableCardsFetchRef = useRef<number>(0);
  const lastStatusCheckRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
const [pendingSelection, setPendingSelection] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Optimistic update map for immediate UI feedback
  const optimisticTakenCards = useRef<Map<number, string>>(new Map());
  // Constants for request throttling
  const TAKEN_CARDS_INTERVAL = 30000; // 30 seconds
  const AVAILABLE_CARDS_INTERVAL = 60000; // 60 seconds
  const STATUS_CHECK_INTERVAL = 120000; // 2 minutes

  // Load selected number from account-specific storage
useEffect(() => {
  // Only load saved selection once when user changes
  if (user?.id) {
    const savedSelectedNumber = getAccountData('selected_number');
    if (savedSelectedNumber && !selectedNumber) {
      setSelectedNumber(savedSelectedNumber);
      setBingoCard(generateBingoCard(savedSelectedNumber));
      console.log('✅ Loaded saved card selection:', savedSelectedNumber);
    }
  }
}, [user?.id, getAccountData, selectedNumber]); // Add selectedNumber dependency

  const shouldEnableCardSelection = useCallback(() => {
    if (!gameData?._id) {
      return false;
    }

    if (walletBalance >= 10) {
      return true;
    }

    return false;
  }, [gameData?._id, walletBalance]);

  const clearSelectedCard = useCallback(() => {
    setSelectedNumber(null);
    setBingoCard(null);
    removeAccountData('selected_number');
    console.log('✅ Cleared selected card from storage');
  }, [removeAccountData]);

  // Throttled fetchTakenCards - only called when needed
    const fetchTakenCards = useCallback(async (force = false) => {
    if (!gameData?._id || isFetchingRef.current) return;

    const now = Date.now();
    if (!force && now - lastTakenCardsFetchRef.current < TAKEN_CARDS_INTERVAL) {
      return;
    }

    try {
      isFetchingRef.current = true;
      lastTakenCardsFetchRef.current = now;
      
      const response = await gameAPI.getTakenCards(gameData._id);
      
      if (response.data.success) {
        // Merge backend data with optimistic updates
        const backendCards = response.data.takenCards;
        const mergedCards = [...backendCards];
        
        // Add optimistic updates (cards being processed)
        for (const [cardNumber, userId] of optimisticTakenCards.current.entries()) {
          const exists = mergedCards.some(card => 
            card.cardNumber === cardNumber && card.userId === userId
          );
          if (!exists) {
            mergedCards.push({ cardNumber, userId });
          }
        }
        
        setTakenCards(mergedCards);
      }
    } catch (error: any) {
      console.error('❌ Error fetching taken cards:', error.message);
    } finally {
      isFetchingRef.current = false;
    }
  }, [gameData?._id]);

  // Throttled fetchAvailableCards - called less frequently
  const fetchAvailableCards = useCallback(async (force = false) => {
    try {
      if (!gameData?._id || !user?.id || isFetchingRef.current) return;
      
      const now = Date.now();
      if (!force && now - lastAvailableCardsFetchRef.current < AVAILABLE_CARDS_INTERVAL) {
        console.log('⏸️ Skipping available cards fetch - too soon');
        return;
      }
      
      lastAvailableCardsFetchRef.current = now;
      
      console.log('🔍 Fetching available cards with:', {
        gameId: gameData._id,
        userId: user.id
      });

      const response = await gameAPI.getAvailableCards(gameData._id, user.id, 400);
      
      console.log('📦 Available cards response:', response.data);
      
      if (response.data.success) {
        setAvailableCards(response.data.cards);
        console.log('✅ Available cards fetched:', response.data.cards.length);
        
        // Also fetch taken cards initially (but throttled)
        setTimeout(() => {
          fetchTakenCards(true);
        }, 1000);
      }
    } catch (error: any) {
      console.error('❌ Error fetching available cards:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
    }
  }, [gameData?._id, user?.id, fetchTakenCards]);

const handleCardSelect = async (cardNumber: number) => {
  if (!gameData?._id || !user?.id || isProcessing) return;
  
  try {
    setIsProcessing(true);
    setPendingSelection(cardNumber);
    setCardSelectionError('');
    
    // ⭐ CRITICAL: Clear previous selection IMMEDIATELY
    const previousSelectedNumber = selectedNumber;
    
    // Update local state immediately - clear previous
    setSelectedNumber(cardNumber);
    
    // Remove previous card from optimistic map and state
    if (previousSelectedNumber) {
      optimisticTakenCards.current.delete(previousSelectedNumber);
      
      // Update taken cards state to remove previous selection
      setTakenCards(prev => 
        prev.filter(card => !(card.userId === user.id && card.cardNumber === previousSelectedNumber))
      );
    }
    
    // Add new card to optimistic map
    optimisticTakenCards.current.set(cardNumber, user.id);
    
    // Update taken cards state with new selection
    setTakenCards(prev => {
      // Remove all user's selections first (should only be previous one)
      const newTakenCards = prev.filter(card => 
        !(card.userId === user.id && card.cardNumber !== cardNumber)
      );
      // Add new selection if not already there
      const exists = newTakenCards.some(card => 
        card.cardNumber === cardNumber && card.userId === user.id
      );
      if (!exists) {
        newTakenCards.push({ cardNumber, userId: user.id });
      }
      return newTakenCards;
    });
    
    // Find the selected card data
    const selectedCardData = availableCards.find(card => card.cardIndex === cardNumber);
    
    if (!selectedCardData) {
      throw new Error('Selected card not found');
    }

    // ⭐ Update bingo card immediately for better UX
    setBingoCard(selectedCardData.numbers);
    
    // ⭐ Save to local storage immediately
    setAccountData('selected_number', cardNumber);
    
    // Make API call
    const response = await gameAPI.selectCardWithNumber(gameData._id, {
      userId: user.id,
      cardNumbers: selectedCardData.numbers,
      cardNumber: cardNumber
    });
    
    if (response.data.success) {
      // API succeeded - confirm selection
      console.log(`✅ Card ${response.data.action === 'UPDATED' ? 'updated' : 'selected'} successfully`);
      
      // If previous card exists in local storage, remove it
      if (previousSelectedNumber) {
        // Remove previous from optimistic map (already done above)
        console.log(`🔄 Released previous card ${previousSelectedNumber}`);
      }
    } else {
      // API failed - rollback to previous state
      console.log('❌ API failed, rolling back to previous state');
      
      // Remove new from optimistic map
      optimisticTakenCards.current.delete(cardNumber);
      
      // Restore previous selection if it existed
      if (previousSelectedNumber) {
        setSelectedNumber(previousSelectedNumber);
        setAccountData('selected_number', previousSelectedNumber);
        
        // Restore bingo card for previous selection
        const previousCardData = availableCards.find(card => 
          card.cardIndex === previousSelectedNumber
        );
        if (previousCardData) {
          setBingoCard(previousCardData.numbers);
        }
        
        // Restore to optimistic map
        optimisticTakenCards.current.set(previousSelectedNumber, user.id);
      } else {
        // If no previous selection, clear everything
        setSelectedNumber(null);
        setBingoCard(null);
        removeAccountData('selected_number');
      }
      
      // Refresh to get correct state
      fetchTakenCards(true);
      setCardSelectionError(response.data.error || 'Failed to select card');
    }
    
  } catch (error: any) {
    console.error('❌ Card selection error:', error);
    
    // On error, try to restore previous state
    const previousSelectedNumber = selectedNumber;
    
    if (previousSelectedNumber) {
      setSelectedNumber(previousSelectedNumber);
      setAccountData('selected_number', previousSelectedNumber);
      
      // Restore bingo card
      const previousCardData = availableCards.find(card => 
        card.cardIndex === previousSelectedNumber
      );
      if (previousCardData) {
        setBingoCard(previousCardData.numbers);
      }
      
      // Restore optimistic map
      optimisticTakenCards.current.set(previousSelectedNumber, user.id);
    } else {
      // Clear everything if no previous
      setSelectedNumber(null);
      setBingoCard(null);
      removeAccountData('selected_number');
    }
    
    // Remove new card from optimistic map
    optimisticTakenCards.current.delete(cardNumber);
    
    // Refresh to get correct state
    fetchTakenCards(true);
    
    if (error.response?.data?.error) {
      setCardSelectionError(error.response.data.error);
    } else {
      setCardSelectionError('Failed to select card. Please try again.');
    }
  } finally {
    setIsProcessing(false);
    setPendingSelection(null);
  }
};
  const handleCardRelease = async () => {
    if (!user?.id || !gameData?._id || !selectedNumber) return;
    
    try {
      console.log('🔄 Releasing card:', selectedNumber);
      
      // Note: The backend doesn't have a release card endpoint yet
      // For now, we'll just clear the local state
      setSelectedNumber(null);
      removeAccountData('selected_number');
      setBingoCard(null);
      
      // Remove from local taken cards
      setTakenCards(prev => 
        prev.filter(card => !(card.userId === user.id && card.cardNumber === selectedNumber))
      );
      
      console.log('✅ Card released successfully (local state only)');
      
      // Refresh available cards and taken cards after release (throttled)
      setTimeout(() => {
        fetchAvailableCards(true);
        fetchTakenCards(true);
      }, 500);
    } catch (error: any) {
      console.error('❌ Card release error:', error);
    }
  };

  const checkCardSelectionStatus = useCallback(async () => {
    if (!gameData?._id || isFetchingRef.current) return;
    
    const now = Date.now();
    if (now - lastStatusCheckRef.current < STATUS_CHECK_INTERVAL) {
      console.log('⏸️ Skipping status check - too soon');
      return;
    }

    try {
      lastStatusCheckRef.current = now;
      isFetchingRef.current = true;
      
      console.log('🔍 Checking card selection status for game:', gameData._id);
      
      const response = await gameAPI.getCardSelectionStatus(gameData._id);
      console.log('📦 Card selection status response:', gameStatus);
      
      if (response.data.success) {
        // Note: The backend doesn't return time-based selection status
        // We'll use the game status to determine if selection is active
        const isSelectionActive = gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION';
        setCardSelectionStatus({
          isSelectionActive,
          selectionEndTime: null, // Not provided by backend
          timeRemaining: 0 // Not provided by backend
        });
        
        console.log('✅ Card selection status updated:', {
          isSelectionActive,
          gameStatus
        });
      }
    } catch (error: any) {
      console.error('❌ Error checking card selection status:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    } finally {
      isFetchingRef.current = false;
    }
  }, [gameData?._id, gameStatus]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Set up INFREQUENT polling only when selection is active
  useEffect(() => {
    if (!gameData?._id || !cardSelectionStatus.isSelectionActive) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log('🛑 Stopped polling - selection not active');
      }
      return;
    }

    console.log('⏰ Starting INFREQUENT polling for taken cards');
    
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Only poll every 30 seconds when selection is active
    pollingIntervalRef.current = setInterval(() => {
      fetchTakenCards();
    }, TAKEN_CARDS_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [gameData?._id, cardSelectionStatus.isSelectionActive, fetchTakenCards]);

  // Fetch available cards when game data changes - WITH THROTTLING
  useEffect(() => {
 

    if (gameData?._id && shouldEnableCardSelection() && user?.id) {
      console.log('🚀 Fetching available cards (throttled)...');
      
      // Use setTimeout to avoid immediate fetch on every render
      const timeoutId = setTimeout(() => {
        fetchAvailableCards();
        checkCardSelectionStatus();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      console.log('⏸️ Skipping card fetch - conditions not met:', {
        hasGameId: !!gameData?._id,
        shouldEnableCardSelection: shouldEnableCardSelection(),
        hasUserId: !!user?.id
      });
    }
  }, [gameData, gameStatus, walletBalance, user, selectedNumber, fetchAvailableCards, checkCardSelectionStatus, shouldEnableCardSelection]);

  // Check card selection status periodically - INFREQUENT
  useEffect(() => {
    if (!gameData?._id || !cardSelectionStatus.isSelectionActive) return;

    console.log('⏰ Starting INFREQUENT card selection status polling');
    
    const interval = setInterval(() => {
      checkCardSelectionStatus();
    }, STATUS_CHECK_INTERVAL); // Check every 2 minutes

    return () => {
      console.log('🛑 Stopping card selection status polling');
      clearInterval(interval);
    };
  }, [gameData, cardSelectionStatus.isSelectionActive, checkCardSelectionStatus]);

  return {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    cardSelectionStatus,
    cardSelectionError,
    shouldEnableCardSelection,
    handleCardSelect,
    handleCardRelease,
    fetchAvailableCards,
    checkCardSelectionStatus,
    setCardSelectionError,
    fetchTakenCards,
    clearSelectedCard,
      pendingSelection, // Add this
    isProcessing, // Add this
  };
};
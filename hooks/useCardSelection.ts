/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/hooks/useCardSelection.ts - FIXED VERSION
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';
import { useAccountStorage } from './useAccountStorage';

export const useCardSelection = (gameData: any, gameStatus: string) => {
  const { user, walletBalance } = useAuth();
  const { getAccountData, setAccountData, removeAccountData } = useAccountStorage(user);
  
  // Use refs to track polling intervals
  const takenCardsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);

  // Helper function to clear all intervals
  const clearAllIntervals = useCallback(() => {
    if (takenCardsIntervalRef.current) {
      clearInterval(takenCardsIntervalRef.current);
      takenCardsIntervalRef.current = null;
      console.log('🛑 Cleared taken cards polling interval');
    }
    if (statusPollingIntervalRef.current) {
      clearInterval(statusPollingIntervalRef.current);
      statusPollingIntervalRef.current = null;
      console.log('🛑 Cleared status polling interval');
    }
  }, []);

  // Memoize the condition to check if card selection should be enabled
  const shouldEnableCardSelection = useMemo(() => {
    const gameId = gameData?._id || gameData?.id;
    
    if (!gameId) {
      console.log('❌ No game ID');
      return false;
    }

    if (walletBalance >= 10) {
      console.log('✅ Wallet balance sufficient:', walletBalance);
      return true;
    }

    console.log('❌ Insufficient wallet balance:', walletBalance);
    return false;
  }, [gameData?._id || gameData?.id, walletBalance]);

  // Load selected number from account-specific storage (only once)
  useEffect(() => {
    console.log('🔄 Loading saved card selection for user:', user?.id);
    const savedSelectedNumber = getAccountData('selected_number');
    if (savedSelectedNumber) {
      setSelectedNumber(savedSelectedNumber);
      console.log('✅ Loaded saved card selection:', savedSelectedNumber);
    } else {
      console.log('ℹ️ No saved card selection found for user');
    }
  }, [user, getAccountData]);

  // When availableCards loads and user has a selected card, find and set the bingoCard
  useEffect(() => {
    if (selectedNumber && availableCards.length > 0) {
      const selectedCardData = availableCards.find(card => card.cardIndex === selectedNumber);
      if (selectedCardData) {
        setBingoCard(selectedCardData.numbers);
        console.log('✅ Set bingo card from backend data for card #', selectedNumber);
      } else {
        console.log('⚠️ Selected card not found in availableCards:', selectedNumber);
        // Card might be taken by someone else, clear selection
        setSelectedNumber(null);
        removeAccountData('selected_number');
        setBingoCard(null);
      }
    }
  }, [availableCards, selectedNumber, removeAccountData]);

  const clearSelectedCard = useCallback(() => {
    setSelectedNumber(null);
    setBingoCard(null);
    removeAccountData('selected_number');
    console.log('✅ Cleared selected card from storage');
  }, [removeAccountData]);

  // Real-time polling for taken cards - with cleanup
  const fetchTakenCards = useCallback(async () => {
    const gameId = gameData?._id || gameData?.id;
    if (!gameId) {
      console.log('❌ No game ID for fetching taken cards');
      return;
    }

    try {
      console.log('🔄 Polling for taken cards...');
      const response = await gameAPI.getTakenCards(gameId);
      
      if (response.data.success) {
        const backendCards = response.data.takenCards;
        
        // If user has a selected card, ensure it's included
        if (selectedNumber && user?.id) {
          const userCardExists = backendCards.some(card => 
            card.cardNumber === selectedNumber && card.userId === user.id
          );
          
          if (!userCardExists) {
            // Add user's current selection to the backend data
            const updatedCards = [...backendCards, { cardNumber: selectedNumber, userId: user.id }];
            setTakenCards(updatedCards);
            console.log('➕ Added user selection to taken cards');
          } else {
            setTakenCards(backendCards);
          }
        } else {
          setTakenCards(backendCards);
        }
      }
    } catch (error: any) {
      console.error('❌ Error fetching taken cards:', error.message);
      // If network error, stop polling temporarily
      if (error.message === 'Network Error' || error.message.includes('502')) {
        console.warn('⚠️ Network error detected, stopping polling temporarily');
        clearAllIntervals();
      }
    }
  }, [gameData?._id || gameData?.id, selectedNumber, user?.id, clearAllIntervals]);

  const fetchAvailableCards = useCallback(async () => {
    const gameId = gameData?._id || gameData?.id;
    
    if (!gameId || !user?.id) {
      console.log('❌ Missing gameId or userId for fetching available cards');
      return;
    }

    // Only fetch if card selection should be enabled
    if (!shouldEnableCardSelection) {
      console.log('⏸️ Skipping available cards fetch - card selection not enabled');
      return;
    }

    try {
      setIsLoadingCards(true);
      console.log('🔍 Fetching available cards...');

      const response = await gameAPI.getAvailableCards(gameId, user.id, 400);
      
      if (response.data.success) {
        const cards = response.data.cards || [];
        setAvailableCards(cards);
        console.log('✅ Available cards fetched:', cards.length, 'cards');
      } else {
        console.error('❌ Available cards fetch not successful');
        setAvailableCards([]);
      }
    } catch (error: any) {
      console.error('❌ Error fetching available cards:', error.message);
      setAvailableCards([]);
    } finally {
      setIsLoadingCards(false);
    }
  }, [gameData?._id || gameData?.id, user?.id, shouldEnableCardSelection]);

  // MAIN EFFECT - Controlled fetching logic
  useEffect(() => {
    const gameId = gameData?._id || gameData?.id;
    console.log('🔄 useCardSelection main effect triggered:', {
      gameId,
      gameStatus,
      hasUser: !!user?.id,
      shouldEnableCardSelection
    });

    // Clear previous intervals
    clearAllIntervals();

    // Only proceed if we have valid game and user
    if (!gameId || !user?.id) {
      console.log('⏸️ Skipping - missing game or user');
      return;
    }

    // Check if we should enable polling based on game status
    const shouldPoll = shouldEnableCardSelection && 
      (gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION');
    
    if (!shouldPoll) {
      console.log('⏸️ Polling not needed for status:', gameStatus);
      return;
    }

    console.log('🚀 Starting polling for game:', gameId);

    // Initial fetch
    fetchAvailableCards();
    fetchTakenCards();

    // Set up polling intervals
    takenCardsIntervalRef.current = setInterval(() => {
      fetchTakenCards();
    }, 3000); // Reduced from 2s to 3s to reduce load

    // Set up status polling
    const checkCardSelectionStatus = async () => {
      try {
        const response = await gameAPI.getCardSelectionStatus(gameId);
        if (response.data.success) {
          setCardSelectionStatus(prev => ({
            ...prev,
            isSelectionActive: gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION'
          }));
        }
      } catch (error) {
        console.error('❌ Status check failed:', error);
      }
    };

    statusPollingIntervalRef.current = setInterval(() => {
      checkCardSelectionStatus();
    }, 10000); // Check status every 10s

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up polling intervals');
      clearAllIntervals();
    };
  }, [
    gameData?._id || gameData?.id,
    gameStatus,
    user?.id,
    shouldEnableCardSelection,
    fetchAvailableCards,
    fetchTakenCards,
    clearAllIntervals
  ]);

  // Handle card select with rate limiting
  const handleCardSelect = async (cardNumber: number) => {
    const gameId = gameData?._id || gameData?.id;
    
    if (!gameId || !user?.id) {
      console.log('❌ Missing gameId or userId');
      setCardSelectionError('Please log in to select a card');
      return;
    }

    // Debounce multiple clicks
    if (isLoadingCards) {
      console.log('⏸️ Skipping - already processing');
      return;
    }

    try {
      setIsLoadingCards(true);
      setCardSelectionError('');
      
      // Find the selected card data from availableCards
      const selectedCardData = availableCards.find(card => card.cardIndex === cardNumber);
      
      if (!selectedCardData) {
        const errorMsg = `Card ${cardNumber} not found in available cards. Refresh and try again.`;
        setCardSelectionError(errorMsg);
        console.log('❌ Card not in availableCards');
        
        // Refresh available cards
        await fetchAvailableCards();
        return;
      }

      // Check if card is already taken
      const isAlreadyTaken = takenCards.some(card => card.cardNumber === cardNumber);
      if (isAlreadyTaken) {
        const errorMsg = `Card ${cardNumber} is already taken. Please select another card.`;
        setCardSelectionError(errorMsg);
        console.log('❌ Card already taken:', cardNumber);
        await fetchTakenCards(); // Refresh taken cards
        return;
      }

      // Send the EXACT format backend expects
      const requestData = {
        userId: user.id,
        cardNumbers: selectedCardData.numbers,
        cardNumber: selectedCardData.cardIndex
      };
      
      console.log('📤 Selecting card:', cardNumber);
      
      const response = await gameAPI.selectCardWithNumber(gameId, requestData);
      
      if (response.data.success) {
        console.log(`✅ Card selection successful!`);
        
        setSelectedNumber(cardNumber);
        setBingoCard(selectedCardData.numbers);
        setAccountData('selected_number', cardNumber);
        
        // Update taken cards locally
        setTakenCards(prev => {
          const filtered = prev.filter(card => card.userId !== user.id);
          return [...filtered, { cardNumber, userId: user.id }];
        });
        
        console.log('🎯 Card #' + cardNumber + ' selected successfully!');
        
        // Refresh data after selection
        setTimeout(() => {
          fetchTakenCards();
        }, 1000);
        
      } else {
        const errorMsg = response.data.error || 'Failed to select card';
        setCardSelectionError(errorMsg);
        console.error('❌ Backend error:', errorMsg);
      }
    } catch (error: any) {
      console.error('❌ Card selection API error:', error);
      
      // Handle specific error cases
      if (error.response?.status === 400) {
        setCardSelectionError('Card is no longer available. Please select another.');
        await fetchTakenCards();
      } else if (error.response?.status === 502) {
        setCardSelectionError('Server is temporarily unavailable. Please try again.');
        clearAllIntervals();
      } else if (error.message === 'Network Error') {
        setCardSelectionError('Network error. Please check your connection.');
        clearAllIntervals();
      } else {
        setCardSelectionError('Failed to select card. Please try again.');
      }
    } finally {
      setIsLoadingCards(false);
    }
  };

  const handleCardRelease = async () => {
    if (!user?.id || !(gameData?._id || gameData?.id) || !selectedNumber) return;
    
    try {
      console.log('🔄 Releasing card:', selectedNumber);
      
      // Note: The backend doesn't have a release card endpoint yet
      // For now, we'll just clear the local state
      setSelectedNumber(null);
      removeAccountData('selected_number');
      setBingoCard(null);
      
      console.log('✅ Card released successfully (local state only)');
      
      // Refresh data after release
      setTimeout(() => {
        fetchTakenCards();
      }, 500);
    } catch (error: any) {
      console.error('❌ Card release error:', error);
    }
  };

  return {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    cardSelectionStatus,
    cardSelectionError,
    isLoadingCards,
    shouldEnableCardSelection,
    handleCardSelect,
    handleCardRelease,
    fetchAvailableCards,
    setCardSelectionError,
    fetchTakenCards,
    clearSelectedCard
  };
};
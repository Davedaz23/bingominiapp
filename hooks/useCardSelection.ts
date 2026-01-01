// app/hooks/useCardSelection.ts - WEB SOCKET VERSION
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';
import { useAccountStorage } from './useAccountStorage';
import { useWebSocket } from './useWebSocket'; // Import the new hook

export const useCardSelection = (gameData: any, gameStatus: string) => {
  const { user, walletBalance } = useAuth();
  const { getAccountData, setAccountData, removeAccountData } = useAccountStorage(user);
  
  // Use WebSocket instead of polling
  const {
    isConnected,
    takenCards: wsTakenCards,
    gameStatus: wsGameStatus,
    error: wsError,
    sendMessage,
    onMessage
  } = useWebSocket(gameData?._id || gameData?.id, user?.id);
  
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [bingoCard, setBingoCard] = useState<(number | string)[][] | null>(null);
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [cardSelectionError, setCardSelectionError] = useState<string>('');
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);

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

  // Load selected number from account-specific storage
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

  // When availableCards loads and user has a selected card
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

  // Handle card select
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

      // Check if card is already taken using WebSocket data
      const isAlreadyTaken = wsTakenCards.some(card => card.cardNumber === cardNumber);
      if (isAlreadyTaken) {
        const errorMsg = `Card ${cardNumber} is already taken. Please select another card.`;
        setCardSelectionError(errorMsg);
        console.log('❌ Card already taken:', cardNumber);
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
        
        console.log('🎯 Card #' + cardNumber + ' selected successfully!');
        
        // Notify other players via WebSocket (backend will handle this)
        // The backend will broadcast the CARD_SELECTED event
        
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
      } else if (error.response?.status === 502) {
        setCardSelectionError('Server is temporarily unavailable. Please try again.');
      } else if (error.message === 'Network Error') {
        setCardSelectionError('Network error. Please check your connection.');
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
      
    } catch (error: any) {
      console.error('❌ Card release error:', error);
    }
  };

  // MAIN EFFECT - Fetch available cards when needed
  useEffect(() => {
    const gameId = gameData?._id || gameData?.id;
    console.log('🔄 useCardSelection main effect triggered:', {
      gameId,
      gameStatus,
      hasUser: !!user?.id,
      shouldEnableCardSelection,
      wsConnected: isConnected
    });

    // Only proceed if we have valid game and user
    if (!gameId || !user?.id) {
      console.log('⏸️ Skipping - missing game or user');
      return;
    }

    // Check if we should fetch cards
    const shouldFetchCards = shouldEnableCardSelection && 
      (gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION');
    
    if (shouldFetchCards) {
      console.log('🚀 Fetching available cards...');
      fetchAvailableCards();
    } else {
      console.log('⏸️ Card fetch not needed for status:', gameStatus);
    }
  }, [
    gameData?._id || gameData?.id,
    gameStatus,
    user?.id,
    shouldEnableCardSelection,
    fetchAvailableCards,
    isConnected
  ]);

  // Listen for WebSocket events related to card selection
  useEffect(() => {
    if (!user?.id) return;
    
    // Listen for CARD_SELECTED events (when other players select cards)
    const cleanup = onMessage('CARD_SELECTED', (data) => {
      console.log('🎯 Another player selected card:', data.cardNumber);
      // You could update UI or show notification here
    });
    
    return cleanup;
  }, [user?.id, onMessage]);

  return {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards: wsTakenCards, // Use WebSocket taken cards
    cardSelectionStatus: {
      isSelectionActive: gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION',
      selectionEndTime: null,
      timeRemaining: 0
    },
    cardSelectionError,
    isLoadingCards,
    shouldEnableCardSelection,
    handleCardSelect,
    handleCardRelease,
    fetchAvailableCards,
    setCardSelectionError,
    clearSelectedCard,
    wsConnected: isConnected,
    wsError
  };
};
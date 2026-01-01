/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/hooks/useCardSelection.ts - OPTIMIZED VERSION
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '@/app/contexts/AuthContext';
import { useAccountStorage } from './useAccountStorage';

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
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);

  // Refs to prevent unnecessary re-renders
  const gameIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');
  const walletBalanceRef = useRef<number>(0);
  const hasSufficientBalanceRef = useRef<boolean>(false);
  const lastShouldEnableCheckRef = useRef<number>(0);
  
  // Update refs when dependencies change
  useEffect(() => {
    gameIdRef.current = gameData?._id || gameData?.id || '';
    userIdRef.current = user?.id || '';
    walletBalanceRef.current = walletBalance;
    hasSufficientBalanceRef.current = walletBalance >= 10;
  }, [gameData?._id, gameData?.id, user?.id, walletBalance]);

  // Load selected number from account-specific storage - optimized
  useEffect(() => {
    if (!userIdRef.current) return;
    
    console.log('🔄 Loading saved card selection for user:', userIdRef.current);
    const savedSelectedNumber = getAccountData('selected_number');
    if (savedSelectedNumber) {
      setSelectedNumber(savedSelectedNumber);
      console.log('✅ Loaded saved card selection:', savedSelectedNumber);
    }
  }, [user?.id, getAccountData]); // Only depend on user.id, not the whole user object

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

  // MEMOIZED: shouldEnableCardSelection with caching
  const shouldEnableCardSelection = useMemo(() => {
    const now = Date.now();
    // Throttle checks to prevent excessive calls
    if (now - lastShouldEnableCheckRef.current < 1000) {
      return hasSufficientBalanceRef.current;
    }
    
    lastShouldEnableCheckRef.current = now;
    
    if (!gameIdRef.current) {
      console.log('❌ No game ID');
      hasSufficientBalanceRef.current = false;
      return false;
    }

    if (walletBalanceRef.current >= 10) {
      console.log('✅ Wallet balance sufficient:', walletBalanceRef.current);
      hasSufficientBalanceRef.current = true;
      return true;
    }

    console.log('❌ Insufficient wallet balance:', walletBalanceRef.current);
    hasSufficientBalanceRef.current = false;
    return false;
  }, [gameData?._id, gameData?.id, walletBalance]);

  const clearSelectedCard = useCallback(() => {
    setSelectedNumber(null);
    setBingoCard(null);
    removeAccountData('selected_number');
    console.log('✅ Cleared selected card from storage');
  }, [removeAccountData]);

  // Real-time polling for taken cards - optimized with abort controller
  const fetchTakenCards = useCallback(async () => {
    const gameId = gameIdRef.current;
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
        if (selectedNumber && userIdRef.current) {
          const userCardExists = backendCards.some(card => 
            card.cardNumber === selectedNumber && card.userId === userIdRef.current
          );
          
          if (!userCardExists) {
            // Add user's current selection to the backend data
            const updatedCards = [...backendCards, { cardNumber: selectedNumber, userId: userIdRef.current }];
            setTakenCards(updatedCards);
            console.log('➕ Added user selection to taken cards');
          } else {
            setTakenCards(backendCards);
          }
        } else {
          setTakenCards(backendCards);
        }
        
        console.log('✅ Taken cards updated:', backendCards.length, 'cards taken');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('❌ Error fetching taken cards:', error.message);
      }
    }
  }, [selectedNumber]);

  const fetchAvailableCards = useCallback(async () => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    
    if (!gameId || !userId) {
      console.log('❌ Missing gameId or userId for fetching available cards');
      return;
    }

    try {
      setIsLoadingCards(true);
      console.log('🔍 Fetching available cards with:', {
        gameId,
        userId,
        walletBalance: walletBalanceRef.current,
        gameStatus
      });

      const response = await gameAPI.getAvailableCards(gameId, userId, 400);
      
      console.log('📦 Available cards response:', {
        success: response.data.success,
        cardsCount: response.data.cards?.length,
      });
      
      if (response.data.success) {
        const cards = response.data.cards || [];
        setAvailableCards(cards);
        console.log('✅ Available cards fetched:', cards.length, 'cards');
        
        // Also fetch taken cards initially
        await fetchTakenCards();
      } else {
        console.error('❌ Available cards fetch not successful:', response.data);
        setAvailableCards([]);
      }
    } catch (error: any) {
      console.error('❌ Error fetching available cards:', {
        message: error.message,
        status: error.response?.status,
        url: error.config?.url
      });
      setAvailableCards([]);
    } finally {
      setIsLoadingCards(false);
    }
  }, [gameStatus, fetchTakenCards]);

  const handleCardSelect = async (cardNumber: number) => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    
    if (!gameId || !userId) {
      console.log('❌ Missing gameId or userId');
      setCardSelectionError('Please log in to select a card');
      return;
    }

    try {
      setCardSelectionError('');
      
      // Find the selected card data from availableCards
      const selectedCardData = availableCards.find(card => card.cardIndex === cardNumber);
      
      console.log('🔍 Looking for card:', {
        cardNumber,
        availableCardsLength: availableCards.length,
        selectedCardData
      });
      
      if (!selectedCardData) {
        const errorMsg = `Card ${cardNumber} not found in available cards. Refresh and try again.`;
        setCardSelectionError(errorMsg);
        
        // Refresh available cards
        await fetchAvailableCards();
        return;
      }

      // Check if card is already taken
      const isAlreadyTaken = takenCards.some(card => card.cardNumber === cardNumber);
      if (isAlreadyTaken) {
        const errorMsg = `Card ${cardNumber} is already taken. Please select another card.`;
        setCardSelectionError(errorMsg);
        await fetchTakenCards(); // Refresh taken cards
        return;
      }

      // ✅ Send the EXACT format backend expects
      const requestData = {
        userId,
        cardNumbers: selectedCardData.numbers,
        cardNumber: selectedCardData.cardIndex
      };
      
      console.log('📤 Sending to backend:', {
        url: `/games/${gameId}/select-card-with-number`,
        data: requestData,
        cardIndex: selectedCardData.cardIndex
      });
      
      const response = await gameAPI.selectCardWithNumber(gameId, requestData);
      
      console.log("📡 Backend response:", response.data);
      
      if (response.data.success) {
        console.log(`✅ Card selection successful! Action: ${response.data.action || 'selected'}`);
        
        // ✅ USE THE BACKEND CARD DATA
        setSelectedNumber(cardNumber);
        setBingoCard(selectedCardData.numbers);
        setAccountData('selected_number', cardNumber);
        
        // Update taken cards locally for immediate UI feedback
        setTakenCards(prev => {
          const filtered = prev.filter(card => card.userId !== userId);
          return [...filtered, { cardNumber, userId }];
        });
        
        console.log('🎯 Card #' + cardNumber + ' selected successfully!');
        
        // Refresh from backend after short delay
        setTimeout(() => {
          fetchTakenCards();
          fetchAvailableCards();
        }, 500);
        
      } else {
        const errorMsg = response.data.error || 'Failed to select card';
        setCardSelectionError(errorMsg);
        console.error('❌ Backend error:', errorMsg);
        
        if (errorMsg.includes('already taken') || errorMsg.includes('taken')) {
          await fetchTakenCards();
        }
      }
    } catch (error: any) {
      console.error('❌ Card selection API error:', error);
      
      // Enhanced error handling for 400 Bad Request
      if (error.response?.status === 400) {
        const errorData = error.response?.data;
        let errorMessage = 'Bad request - server rejected the data';
        
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }
        
        setCardSelectionError(`Server error: ${errorMessage}`);
      } else if (error.response?.data?.error) {
        setCardSelectionError(error.response.data.error);
      } else {
        setCardSelectionError('Failed to select card. Please try again.');
      }
    }
  };

  const handleCardRelease = async () => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    
    if (!userId || !gameId || !selectedNumber) return;
    
    try {
      console.log('🔄 Releasing card:', selectedNumber);
      
      // Note: The backend doesn't have a release card endpoint yet
      // For now, we'll just clear the local state
      setSelectedNumber(null);
      removeAccountData('selected_number');
      setBingoCard(null);
      
      console.log('✅ Card released successfully (local state only)');
      
      // Refresh available cards and taken cards after release
      await fetchAvailableCards();
      await fetchTakenCards();
    } catch (error: any) {
      console.error('❌ Card release error:', error);
    }
  };

  const checkCardSelectionStatus = useCallback(async () => {
    const gameId = gameIdRef.current;
    if (!gameId) return;
    
    try {
      console.log('🔍 Checking card selection status for game:', gameId);
      
      const response = await gameAPI.getCardSelectionStatus(gameId);
      
      if (response.data.success) {
        // Use the game status to determine if selection is active
        const isSelectionActive = gameStatus === 'WAITING_FOR_PLAYERS' || gameStatus === 'CARD_SELECTION';
        setCardSelectionStatus({
          isSelectionActive,
          selectionEndTime: null,
          timeRemaining: 0
        });
        
        console.log('✅ Card selection status updated:', {
          isSelectionActive,
          gameStatus
        });
      }
    } catch (error: any) {
      console.error('❌ Error checking card selection status:', error.message);
    }
  }, [gameStatus]);

  // Real-time polling for taken cards when selection is active - OPTIMIZED
  useEffect(() => {
    const gameId = gameIdRef.current;
    const isSelectionActive = cardSelectionStatus.isSelectionActive;
    
    if (!gameId || !isSelectionActive) {
      console.log('⏸️ Skipping taken cards polling:', {
        hasGameId: !!gameId,
        isSelectionActive
      });
      return;
    }

    console.log('⏰ Starting real-time taken cards polling');
    
    // Initial fetch
    fetchTakenCards();
    
    const interval = setInterval(() => {
      fetchTakenCards();
    }, 2000); // Poll every 2 seconds for real-time updates

    return () => {
      console.log('🛑 Stopping real-time taken cards polling');
      clearInterval(interval);
    };
  }, [cardSelectionStatus.isSelectionActive, fetchTakenCards]);

  // Fetch available cards when conditions are met - THROTTLED
  useEffect(() => {
    // Throttle this effect to prevent excessive calls
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    
    console.log('🔄 useCardSelection main effect triggered:', {
      gameId,
      gameStatus,
      walletBalance: walletBalanceRef.current,
      userId,
      shouldEnable: shouldEnableCardSelection,
      isSelectionActive: cardSelectionStatus.isSelectionActive
    });

    const canFetchCards = gameId && shouldEnableCardSelection && userId;
    
    if (canFetchCards) {
      console.log('🚀 Fetching available cards...');
      fetchAvailableCards();
      checkCardSelectionStatus();
    } else {
      console.log('⏸️ Skipping card fetch - conditions not met:', {
        hasGameId: !!gameId,
        shouldEnableCardSelection,
        hasUserId: !!userId,
        walletBalance: walletBalanceRef.current,
        gameStatus
      });
    }
  }, [gameStatus, shouldEnableCardSelection, fetchAvailableCards, checkCardSelectionStatus]);

  // Check card selection status periodically
  useEffect(() => {
    const gameId = gameIdRef.current;
    const isSelectionActive = cardSelectionStatus.isSelectionActive;
    
    if (!gameId || !isSelectionActive) {
      console.log('⏸️ Skipping status polling - selection not active');
      return;
    }

    console.log('⏰ Starting card selection status polling');
    
    const interval = setInterval(() => {
      checkCardSelectionStatus();
    }, 10000); // Check every 10 seconds

    return () => {
      console.log('🛑 Stopping card selection status polling');
      clearInterval(interval);
    };
  }, [cardSelectionStatus.isSelectionActive, checkCardSelectionStatus]);

  return {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    cardSelectionStatus,
    cardSelectionError,
    isLoadingCards,
    shouldEnableCardSelection, // Now returns the memoized value directly
    handleCardSelect,
    handleCardRelease,
    fetchAvailableCards,
    checkCardSelectionStatus,
    setCardSelectionError,
    fetchTakenCards,
    clearSelectedCard
  };
};
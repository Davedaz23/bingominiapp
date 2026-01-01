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
  const lastShouldEnableCheckRef = useRef<number>(0);
  
  // Update refs when dependencies change
  useEffect(() => {
    gameIdRef.current = gameData?._id || gameData?.id || '';
    userIdRef.current = user?.id || '';
    walletBalanceRef.current = walletBalance;
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
  }, [user?.id, getAccountData]);

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

  // FIXED: shouldEnableCardSelection as a function (not memoized boolean)
  const shouldEnableCardSelection = useCallback(() => {
    const now = Date.now();
    // Throttle checks to prevent excessive calls
    if (now - lastShouldEnableCheckRef.current < 1000) {
      return !!gameIdRef.current && walletBalanceRef.current >= 10;
    }
    
    lastShouldEnableCheckRef.current = now;
    
    if (!gameIdRef.current) {
      console.log('❌ No game ID');
      return false;
    }

    if (walletBalanceRef.current >= 10) {
      console.log('✅ Wallet balance sufficient:', walletBalanceRef.current);
      return true;
    }

    console.log('❌ Insufficient wallet balance:', walletBalanceRef.current);
    return false;
  }, []); // No dependencies since we use refs

  // NEW: Memoized version of the check result for useEffect dependencies
  const shouldEnableCardSelectionResult = useMemo(() => {
    return shouldEnableCardSelection();
  }, [gameData?._id, gameData?.id, walletBalance, shouldEnableCardSelection]);

  const clearSelectedCard = useCallback(() => {
    setSelectedNumber(null);
    setBingoCard(null);
    removeAccountData('selected_number');
    console.log('✅ Cleared selected card from storage');
  }, [removeAccountData]);

  // Real-time polling for taken cards
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
      console.error('❌ Error fetching taken cards:', error.message);
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
      console.error('❌ Error fetching available cards:', error.message);
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
      
      const selectedCardData = availableCards.find(card => card.cardIndex === cardNumber);
      
      if (!selectedCardData) {
        const errorMsg = `Card ${cardNumber} not found in available cards. Refresh and try again.`;
        setCardSelectionError(errorMsg);
        await fetchAvailableCards();
        return;
      }

      const isAlreadyTaken = takenCards.some(card => card.cardNumber === cardNumber);
      if (isAlreadyTaken) {
        const errorMsg = `Card ${cardNumber} is already taken. Please select another card.`;
        setCardSelectionError(errorMsg);
        await fetchTakenCards();
        return;
      }

      const requestData = {
        userId,
        cardNumbers: selectedCardData.numbers,
        cardNumber: selectedCardData.cardIndex
      };
      
      const response = await gameAPI.selectCardWithNumber(gameId, requestData);
      
      if (response.data.success) {
        console.log(`✅ Card selection successful! Action: ${response.data.action || 'selected'}`);
        
        setSelectedNumber(cardNumber);
        setBingoCard(selectedCardData.numbers);
        setAccountData('selected_number', cardNumber);
        
        // Update taken cards locally
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
      
      setSelectedNumber(null);
      removeAccountData('selected_number');
      setBingoCard(null);
      
      console.log('✅ Card released successfully (local state only)');
      
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

  // Real-time polling for taken cards when selection is active
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
    }, 2000);

    return () => {
      console.log('🛑 Stopping real-time taken cards polling');
      clearInterval(interval);
    };
  }, [cardSelectionStatus.isSelectionActive, fetchTakenCards]);

  // MAIN FIX: Fetch available cards when conditions are met
  useEffect(() => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    const shouldEnable = shouldEnableCardSelectionResult;
    
    console.log('🔄 useCardSelection main effect triggered:', {
      gameId,
      gameStatus,
      walletBalance: walletBalanceRef.current,
      userId,
      shouldEnable,
      isSelectionActive: cardSelectionStatus.isSelectionActive
    });

    const canFetchCards = gameId && shouldEnable && userId;
    
    if (canFetchCards) {
      console.log('🚀 Fetching available cards...');
      fetchAvailableCards();
      checkCardSelectionStatus();
    } else {
      console.log('⏸️ Skipping card fetch - conditions not met:', {
        hasGameId: !!gameId,
        shouldEnable,
        hasUserId: !!userId,
        walletBalance: walletBalanceRef.current,
        gameStatus
      });
    }
  }, [gameStatus, shouldEnableCardSelectionResult, fetchAvailableCards, checkCardSelectionStatus]);

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
    }, 10000);

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
    shouldEnableCardSelection: shouldEnableCardSelection, // Return the function
    handleCardSelect,
    handleCardRelease,
    fetchAvailableCards,
    checkCardSelectionStatus,
    setCardSelectionError,
    fetchTakenCards,
    clearSelectedCard
  };
};
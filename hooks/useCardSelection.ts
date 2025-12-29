/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/hooks/useCardSelection.ts - FIXED VERSION
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);

  // Load selected number from account-specific storage
  useEffect(() => {
    console.log('🔄 Loading saved card selection for user:', user?.id);
    const savedSelectedNumber = getAccountData('selected_number');
    if (savedSelectedNumber) {
      setSelectedNumber(savedSelectedNumber);
      setBingoCard(generateBingoCard(savedSelectedNumber));
      console.log('✅ Loaded saved card selection:', savedSelectedNumber);
    } else {
      console.log('ℹ️ No saved card selection found for user');
    }
  }, [user, getAccountData]);

  const shouldEnableCardSelection = useCallback(() => {
    if (!gameData?._id) {
      console.log('❌ No game ID');
      return false;
    }

    if (walletBalance >= 10) {
      console.log('✅ Wallet balance sufficient:', walletBalance);
      return true;
    }

    console.log('❌ Insufficient wallet balance:', walletBalance);
    return false;
  }, [gameData?._id, walletBalance]);

  const clearSelectedCard = useCallback(() => {
    setSelectedNumber(null);
    setBingoCard(null);
    removeAccountData('selected_number');
    console.log('✅ Cleared selected card from storage');
  }, [removeAccountData]);

  // Real-time polling for taken cards
  const fetchTakenCards = useCallback(async () => {
    if (!gameData?._id) {
      console.log('❌ No game ID for fetching taken cards');
      return;
    }

    try {
      console.log('🔄 Polling for taken cards...');
      const response = await gameAPI.getTakenCards(gameData._id);
      console.log("📦 Taken cards response:", response.data);
      
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
        
        console.log('✅ Taken cards updated:', backendCards.length, 'cards taken');
      }
    } catch (error: any) {
      console.error('❌ Error fetching taken cards:', error.message);
    }
  }, [gameData?._id, selectedNumber, user?.id]);

  const fetchAvailableCards = useCallback(async () => {
    if (!gameData?._id || !user?.id) {
      console.log('❌ Missing gameId or userId for fetching available cards');
      return;
    }

    try {
      setIsLoadingCards(true);
      console.log('🔍 Fetching available cards with:', {
        gameId: gameData._id,
        userId: user.id,
        walletBalance,
        gameStatus
      });

      const response = await gameAPI.getAvailableCards(gameData._id, user.id, 400);
      
      console.log('📦 Available cards response:', {
        success: response.data.success,
        cardsCount: response.data.cards?.length,
        firstCard: response.data.cards?.[0],
       
      });
      
      if (response.data.success) {
        setAvailableCards(response.data.cards || []);
        console.log('✅ Available cards fetched:', response.data.cards?.length || 0, 'cards');
        
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
        data: error.response?.data,
        url: error.config?.url
      });
      setAvailableCards([]);
    } finally {
      setIsLoadingCards(false);
    }
  }, [gameData?._id, user?.id, walletBalance, gameStatus, fetchTakenCards]);

  const handleCardSelect = async (cardNumber: number) => {
    if (!gameData?._id || !user?.id) {
      console.log('❌ Missing gameId or userId');
      setCardSelectionError('Please log in to select a card');
      return;
    }

    try {
      setCardSelectionError('');
      
 

      // Find the selected card data from availableCards
      const selectedCardData = availableCards.find(card => card.cardNumber === cardNumber);
      
      if (!selectedCardData) {
        const errorMsg = `Card ${cardNumber} not found in available cards. Refresh and try again.`;
        setCardSelectionError(errorMsg);
        console.log('❌ Card not in availableCards:', {
          cardNumber,
          availableCardNumbers: availableCards.map(c => c.cardNumber)
        });
        
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

      // ✅ CRITICAL: Send the EXACT format backend expects
      const requestData = {
        userId: user.id,
        cardNumbers: selectedCardData.numbers, // The 5x5 array
        cardNumber: cardNumber // The card number/index
      };
      
      console.log('📤 Sending to backend:', {
        url: `/games/${gameData._id}/select-card-with-number`,
        data: requestData
      });
      
      const response = await gameAPI.selectCardWithNumber(gameData._id, requestData);
      
      console.log("📡 Backend response:", response.data);
      
      if (response.data.success) {
        console.log(`✅ Card selection successful! Action: ${response.data.action || 'selected'}`);
        
        // Update local state
        setSelectedNumber(cardNumber);
        setBingoCard(selectedCardData.numbers);
        setAccountData('selected_number', cardNumber);
        
        // Update taken cards locally for immediate UI feedback
        setTakenCards(prev => {
          const filtered = prev.filter(card => card.userId !== user.id);
          return [...filtered, { cardNumber, userId: user.id }];
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
        console.error('🔍 400 Bad Request Full Details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.response?.data?.error || error.response?.data?.message,
          requestSent: {
            url: error.config?.url,
            data: error.config?.data ? JSON.parse(error.config.data) : null,
            method: error.config?.method
          }
        });
        
        // Try to get specific error message
        const errorData = error.response?.data;
        let errorMessage = 'Bad request - server rejected the data';
        
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (errorData?.errors) {
          // Handle validation errors
          errorMessage = 'Validation errors: ' + JSON.stringify(errorData.errors);
        }
        
        setCardSelectionError(`Server error: ${errorMessage}`);
        
      } else if (error.response?.data?.error) {
        setCardSelectionError(error.response.data.error);
      } else if (error.message === 'Network Error') {
        setCardSelectionError('Network error. Please check your connection.');
      } else {
        setCardSelectionError('Failed to select card. Please try again.');
      }
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
      
      console.log('✅ Card released successfully (local state only)');
      
      // Refresh available cards and taken cards after release
      await fetchAvailableCards();
      await fetchTakenCards();
    } catch (error: any) {
      console.error('❌ Card release error:', error);
    }
  };

  const checkCardSelectionStatus = useCallback(async () => {
    if (!gameData?._id) return;
    
    try {
      console.log('🔍 Checking card selection status for game:', gameData._id);
      
      const response = await gameAPI.getCardSelectionStatus(gameData._id);
      console.log('📦 Card selection status response:', response.data);
      
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
          gameStatus,
          responseData: response.data
        });
      }
    } catch (error: any) {
      console.error('❌ Error checking card selection status:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  }, [gameData?._id, gameStatus]);

  // Real-time polling for taken cards when selection is active
  useEffect(() => {
    if (!gameData?._id || !cardSelectionStatus.isSelectionActive) {
      console.log('⏸️ Skipping taken cards polling:', {
        hasGameId: !!gameData?._id,
        isSelectionActive: cardSelectionStatus.isSelectionActive
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
  }, [gameData?._id, cardSelectionStatus.isSelectionActive, fetchTakenCards]);

  // Fetch available cards when conditions are met
  useEffect(() => {
    console.log('🔄 useCardSelection main effect triggered:', {
      gameId: gameData?._id,
      gameStatus,
      walletBalance,
      userId: user?.id,
      shouldEnable: shouldEnableCardSelection(),
      isSelectionActive: cardSelectionStatus.isSelectionActive
    });

    const canFetchCards = gameData?._id && shouldEnableCardSelection() && user?.id;
    
    if (canFetchCards) {
      console.log('🚀 Fetching available cards...');
      fetchAvailableCards();
      checkCardSelectionStatus();
    } else {
      console.log('⏸️ Skipping card fetch - conditions not met:', {
        hasGameId: !!gameData?._id,
        shouldEnableCardSelection: shouldEnableCardSelection(),
        hasUserId: !!user?.id,
        walletBalance,
        gameStatus
      });
    }
  }, [gameData, gameStatus, walletBalance, user, shouldEnableCardSelection, fetchAvailableCards, checkCardSelectionStatus]);

  // Check card selection status periodically
  useEffect(() => {
    if (!gameData?._id || !cardSelectionStatus.isSelectionActive) {
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
  }, [gameData?._id, cardSelectionStatus.isSelectionActive, checkCardSelectionStatus]);

  return {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    cardSelectionStatus,
    cardSelectionError,
    isLoadingCards,
    shouldEnableCardSelection: shouldEnableCardSelection(),
    handleCardSelect,
    handleCardRelease,
    fetchAvailableCards,
    checkCardSelectionStatus,
    setCardSelectionError,
    fetchTakenCards,
    clearSelectedCard
  };
};
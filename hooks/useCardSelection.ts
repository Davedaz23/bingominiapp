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

  // Load selected number from account-specific storage
  useEffect(() => {
    const savedSelectedNumber = getAccountData('selected_number');
    if (savedSelectedNumber) {
     
      setSelectedNumber(savedSelectedNumber);
      setBingoCard(generateBingoCard(savedSelectedNumber)); // ✅ Now this works
      console.log('✅ Loaded saved card selection:', savedSelectedNumber);
    }
  }, [user]);

  const shouldEnableCardSelection = () => {
    if (!gameData?._id) {
      return false;
    }

    if (walletBalance >= 10) {
      return true;
    }

    return false;
  };
  const clearSelectedCard = useCallback(() => {
  setSelectedNumber(null);
  setBingoCard(null);
  removeAccountData('selected_number');
  console.log('✅ Cleared selected card from storage');
}, [removeAccountData]);

  // Rest of your hook code remains the same...
  // Real-time polling for taken cards
  const fetchTakenCards = useCallback(async () => {
    if (!gameData?._id) return;

    try {
      console.log('🔄 Polling for taken cards...');
      const response = await gameAPI.getTakenCards(gameData._id);
      console.log("taken payload",response);
      if (response.data.success) {
        // Merge with current user's selection to avoid flickering
        setTakenCards(() => {
          const backendCards = response.data.takenCards;
          
          // If user has a selected card, ensure it's included
          if (selectedNumber && user?.id) {
            const userCardExists = backendCards.some(card => 
              card.cardNumber === selectedNumber && card.userId === user.id
            );
            
            if (!userCardExists) {
              // Add user's current selection to the backend data
              return [...backendCards, { cardNumber: selectedNumber, userId: user.id }];
            }
          }
          
          return backendCards;
        });
        
        console.log('✅ Taken cards updated:', response.data.takenCards.length, 'cards taken');
      }
    } catch (error: any) {
      console.error('❌ Error fetching taken cards:', error.message);
    }
  }, [gameData?._id, selectedNumber, user?.id]);

  const fetchAvailableCards = async () => {
    try {
      if (!gameData?._id || !user?.id) return;
      
      console.log('🔍 Fetching available cards with:', {
        gameId: gameData._id,
        userId: user.id
      });

      const response = await gameAPI.getAvailableCards(gameData._id, user.id, 400);
      
      console.log('📦 Available cards response:', response.data);
      
      if (response.data.success) {
        setAvailableCards(response.data.cards);
        console.log('✅ Available cards fetched:', response.data.cards);
        
        // Also fetch taken cards initially
        await fetchTakenCards();
      }
    } catch (error: any) {
      console.error('❌ Error fetching available cards:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
    }
  };

const handleCardSelect = async (cardNumber: number) => {
  if (!gameData?._id || !user?.id) {
    console.log('❌ Missing gameId or userId');
    return;
  }

  try {
    setCardSelectionError('');
    
    console.log('🔄 Selecting card:', {
      gameId: gameData._id,
      userId: user.id,
      cardNumber: cardNumber
    });

    // Find the selected card data from availableCards
    const selectedCardData = availableCards.find(card => card.cardNumber === cardNumber);
    
    if (!selectedCardData) {
      setCardSelectionError('Selected card not found in available cards');
      console.log('❌ Card not in availableCards:', cardNumber);
      await fetchAvailableCards();
      return;
    }

    // ✅ CRITICAL FIX: Use cardIndex instead of cardNumber in the request
    // The backend expects "cardIndex" field, not "cardNumber"
    const response = await gameAPI.selectCardWithNumber(gameData._id, {
      userId: user.id,
      cardNumbers: selectedCardData.numbers,
      cardIndex: cardNumber  // ← Changed from cardNumber to cardIndex
    });
    
    console.log("📡 Backend response:", response.data);
    
    if (response.data.success) {
      console.log(`✅ Card selection successful! Action: ${response.data.action}`);
      
      // Update local state
      setSelectedNumber(cardNumber);
      setBingoCard(selectedCardData.numbers);
      setAccountData('selected_number', cardNumber);
      
      // Update taken cards locally first for immediate UI feedback
      setTakenCards(prev => {
        const filtered = prev.filter(card => card.userId !== user.id);
        return [...filtered, { cardNumber, userId: user.id }];
      });
      
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
    
    // Enhanced error logging for 400 Bad Request
    if (error.response?.status === 400) {
      console.error('🔍 400 Bad Request Details:', {
        requestData: error.config?.data,
        responseData: error.response?.data
      });
      
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Bad request - check your data format';
      setCardSelectionError(`Server rejected request: ${errorMsg}`);
      
      // Check for specific validation errors
      if (error.response?.data?.errors) {
        console.error('🔍 Validation errors:', error.response.data.errors);
      }
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

  const checkCardSelectionStatus = async () => {
    if (!gameData?._id) return;
    
    try {
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
    }
  };

  // Real-time polling for taken cards
  useEffect(() => {
    if (!gameData?._id || !cardSelectionStatus.isSelectionActive) return;

    console.log('⏰ Starting real-time taken cards polling');
    
    const interval = setInterval(() => {
      fetchTakenCards();
    }, 2000); // Poll every 2 seconds for real-time updates

    return () => {
      console.log('🛑 Stopping real-time taken cards polling');
      clearInterval(interval);
    };
  }, [gameData?._id, cardSelectionStatus.isSelectionActive, fetchTakenCards]);

  // Fetch available cards when game data changes
  useEffect(() => {
    console.log('🔄 useCardSelection effect triggered:', {
      gameId: gameData?._id,
      gameStatus,
      walletBalance,
      userId: user?.id,
      shouldEnableCardSelection: shouldEnableCardSelection()
    });

    if (gameData?._id && shouldEnableCardSelection() && user?.id) {
      console.log('🚀 Fetching available cards...');
      fetchAvailableCards();
      checkCardSelectionStatus();
    } else {
      console.log('⏸️ Skipping card fetch - conditions not met:', {
        hasGameId: !!gameData?._id,
        shouldEnableCardSelection: shouldEnableCardSelection(),
        hasUserId: !!user?.id
      });
    }
  }, [gameData, gameStatus, walletBalance, user, selectedNumber]);

  // Check card selection status periodically
  useEffect(() => {
    if (!gameData?._id || !cardSelectionStatus.isSelectionActive) return;

    console.log('⏰ Starting card selection status polling');
    
    const interval = setInterval(() => {
      checkCardSelectionStatus();
    }, 10000); // Check every 10 seconds

    return () => {
      console.log('🛑 Stopping card selection status polling');
      clearInterval(interval);
    };
  }, [gameData, cardSelectionStatus.isSelectionActive]);

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
      clearSelectedCard // Add this

  };
};
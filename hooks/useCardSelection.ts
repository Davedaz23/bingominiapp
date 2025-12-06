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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        console.log('✅ Available cards fetched:', response.data.cards.length);
        
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
    if (!gameData?._id || !user?.id) return;

    try {
      setCardSelectionError('');
       if (selectedNumber && selectedNumber !== cardNumber) {
      await handleCardRelease(); // Release the previous card
    }
      // Check if card is already taken (real-time check)
      const isCardTaken = takenCards.some(card => card.cardNumber === cardNumber);
      if (isCardTaken) {
        setCardSelectionError(`Card #${cardNumber} is already taken by another player`);
        
        // Refresh taken cards to get latest status
        await fetchTakenCards();
        return;
      }

      // Find the selected card data from availableCards
      const selectedCardData = availableCards.find(card => card.cardIndex === cardNumber);
      
      if (!selectedCardData) {
        setCardSelectionError('Selected card not found');
        return;
      }

      console.log('🔄 Selecting card:', {
        gameId: gameData._id,
        userId: user.id,
        cardIndex: cardNumber,
        cardNumbers: selectedCardData.numbers
      });

      // Call the API to select the card with card number
      const response = await gameAPI.selectCardWithNumber(gameData._id, {
        userId: user.id,
        cardNumbers: selectedCardData.numbers,
        cardNumber: cardNumber
      });
      
      if (response.data.success) {
        console.log(`✅ Card ${response.data.action === 'UPDATED' ? 'updated' : 'selected'} successfully:`, response.data);
        
        // Update local state
        setSelectedNumber(cardNumber);
        setBingoCard(selectedCardData.numbers);
        
        // Save to account storage
        setAccountData('selected_number', cardNumber);
        
        // Immediately update taken cards to reflect this selection
        await fetchTakenCards();
        
        // Show success message based on action
        if (response.data.action === 'UPDATED') {
          setCardSelectionError(''); // Clear any previous errors
          console.log('🔄 Card successfully updated!');
        } else {
          console.log('✅ Card successfully selected!');
        }
        
      } else {
        setCardSelectionError(response.data.error || 'Failed to select card');
      }
    } catch (error: any) {
      console.error('❌ Card selection error:', error);
      
      // Handle specific error cases
      if (error.response?.data?.error) {
        setCardSelectionError(error.response.data.error);
        
        // If card is taken, refresh the taken cards list
        if (error.response.data.error.includes('already taken')) {
          await fetchTakenCards();
        }
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
      console.log('📦 Card selection status response:', response.data);
      
      if (response.data.success) {
        // Note: The backend doesn't return time-based selection status
        // We'll use the game status to determine if selection is active
        const isSelectionActive = gameStatus === 'WAITING' || gameStatus === 'ACTIVE';
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
    fetchTakenCards
  };
};
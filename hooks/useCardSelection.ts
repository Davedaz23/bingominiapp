// app/hooks/useCardSelection.ts - FIXED
import { useState, useEffect } from 'react';
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

  // Load selected number from account-specific storage
  useEffect(() => {
    const savedSelectedNumber = getAccountData('selected_number');
    if (savedSelectedNumber) {
      setSelectedNumber(savedSelectedNumber);
      setBingoCard(generateBingoCard(savedSelectedNumber));
      console.log('✅ Loaded saved card selection:', savedSelectedNumber);
    }
  }, [user]);

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

  const shouldEnableCardSelection = () => {
    if (selectedNumber) {
      return false;
    }

    if (!gameData?._id) {
      return false;
    }

    if (walletBalance >= 10) {
      return true;
    }

    return false;
  };

  const fetchAvailableCards = async () => {
    try {
      if (!gameData?._id || !user?.id) {
        console.log('❌ Missing gameId or userId:', { 
          gameId: gameData?._id, 
          userId: user?.id 
        });
        return;
      }
      
      console.log('🔍 Fetching available cards with:', {
        gameId: gameData._id,
        userId: user.id
      });

      // FIXED: Make sure userId is properly passed to the API call
      const response = await gameAPI.getAvailableCards(gameData._id, user.id, 3);
      
      console.log('📦 Available cards response:', response.data);
      
      if (response.data.success) {
        setAvailableCards(response.data.cards);
        console.log('✅ Available cards fetched:', response.data.cards);
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

  const handleCardSelect = async (cardIndex: number) => {
    if (!user?.id || !gameData?._id) {
      console.log('❌ Missing user ID or game ID for card selection');
      return;
    }
    
    try {
      setCardSelectionError('');
      
      // Get the selected card numbers from available cards
      const selectedCard = availableCards.find(card => card.cardIndex === cardIndex);
      if (!selectedCard) {
        throw new Error('Selected card not found in available cards');
      }

      console.log('🔄 Selecting card:', {
        gameId: gameData._id,
        userId: user.id,
        cardIndex,
        cardNumbers: selectedCard.numbers
      });

      const response = await gameAPI.selectCard(gameData._id, user.id, selectedCard.numbers);
      
      if (response.data.success) {
        setSelectedNumber(cardIndex);
        setAccountData('selected_number', cardIndex);
        setBingoCard(selectedCard.numbers);
        setCardSelectionError('');
        
        console.log(`✅ Card #${cardIndex} selected successfully`);
        
        // Refresh available cards after selection
        fetchAvailableCards();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to select card';
      setCardSelectionError(errorMessage);
      console.error('❌ Card selection error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  };

  const handleCardRelease = async () => {
    if (!user?.id || !gameData?._id) return;
    
    try {
      // Note: The backend doesn't have a release card endpoint yet
      // For now, we'll just clear the local state
      setSelectedNumber(null);
      removeAccountData('selected_number');
      setBingoCard(null);
      
      console.log('🔄 Card released successfully (local state only)');
      
      // Refresh available cards after release
      fetchAvailableCards();
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
        const isSelectionActive = gameStatus === 'WAITING';
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

  // Fetch available cards when game data changes
  useEffect(() => {
    console.log('🔄 useCardSelection effect triggered:', {
      gameId: gameData?._id,
      gameStatus,
      walletBalance,
      userId: user?.id,
      shouldEnable: shouldEnableCardSelection()
    });

    if (gameData?._id && shouldEnableCardSelection() && user?.id) {
      console.log('🚀 Fetching available cards...');
      fetchAvailableCards();
      checkCardSelectionStatus();
    } else {
      console.log('⏸️ Skipping card fetch - conditions not met:', {
        hasGameId: !!gameData?._id,
        shouldEnable: shouldEnableCardSelection(),
        hasUserId: !!user?.id
      });
    }
  }, [gameData, gameStatus, walletBalance, user]);

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
    setCardSelectionError
  };
};
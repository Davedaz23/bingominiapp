// app/hooks/useCardSelection.ts - UPDATED
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
      if (!gameData?._id || !user?.id) return;
      
      const response = await gameAPI.getAvailableCards(gameData._id, user.id, 3);
      if (response.data.success) {
        setAvailableCards(response.data.cards);
        // Note: takenCards is not returned by the backend, so we'll handle selection differently
        console.log('✅ Available cards fetched:', response.data.cards);
      }
    } catch (error) {
      console.error('Error fetching available cards:', error);
    }
  };

  const handleCardSelect = async (cardIndex: number) => {
    if (!user?.id || !gameData?._id) return;
    
    try {
      setCardSelectionError('');
      
      // Get the selected card numbers from available cards
      const selectedCard = availableCards.find(card => card.cardIndex === cardIndex);
      if (!selectedCard) {
        throw new Error('Selected card not found');
      }

      const response = await gameAPI.selectCard(gameData._id, user.id, selectedCard.numbers);
      
      if (response.data.success) {
        setSelectedNumber(cardIndex);
        setAccountData('selected_number', cardIndex);
        setBingoCard(selectedCard.numbers);
        setCardSelectionError('');
        
        console.log(`✅ Card #${cardIndex} selected successfully`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to select card';
      setCardSelectionError(errorMessage);
      console.error('Card selection error:', error);
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
    } catch (error: any) {
      console.error('Card release error:', error);
    }
  };

  const checkCardSelectionStatus = async () => {
    if (!gameData?._id) return;
    
    try {
      const response = await gameAPI.getCardSelectionStatus(gameData._id);
      if (response.data.success) {
        // Note: The backend doesn't return time-based selection status
        // We'll use the game status to determine if selection is active
        const isSelectionActive = gameStatus === 'WAITING';
        setCardSelectionStatus({
          isSelectionActive,
          selectionEndTime: null, // Not provided by backend
          timeRemaining: 0 // Not provided by backend
        });
        
        console.log('✅ Card selection status:', response.data);
      }
    } catch (error) {
      console.error('Error checking card selection status:', error);
    }
  };

  // Fetch available cards when game data changes
  useEffect(() => {
    if (gameData?._id && shouldEnableCardSelection() && user?.id) {
      fetchAvailableCards();
      checkCardSelectionStatus();
    }
  }, [gameData, gameStatus, walletBalance, user]);

  // Check card selection status periodically
  useEffect(() => {
    if (!gameData?._id || !cardSelectionStatus.isSelectionActive) return;

    const interval = setInterval(() => {
      checkCardSelectionStatus();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
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
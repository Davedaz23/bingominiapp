// hooks/useCardSelection.ts - UPDATED VERSION
import { useState, useEffect, useCallback } from 'react';
import { gameAPI } from '../services/api';

export const useCardSelection = (gameData: any, gameStatus: string) => {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [bingoCard, setBingoCard] = useState<(number | string)[][] | null>(null);
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [takenCards, setTakenCards] = useState<any[]>([]);
  const [cardSelectionStatus, setCardSelectionStatus] = useState({
    isSelectionActive: false,
    timeRemaining: 0,
    totalPlayers: 0,
    playersWithCards: 0
  });
  const [cardSelectionError, setCardSelectionError] = useState<string>('');

  const shouldEnableCardSelection = useCallback(() => {
    if (!gameData) return false;
    
    // Card selection is only available during these phases
    return gameData.canSelectCard !== false && 
           (gameData.status === 'WAITING_FOR_PLAYERS' || gameData.status === 'CARD_SELECTION');
  }, [gameData]);

  const handleCardSelect = useCallback(async (cardNumber: number) => {
    try {
      // Check if card selection is allowed
      if (!shouldEnableCardSelection()) {
        setCardSelectionError('Cannot select card at this time');
        return;
      }

      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (!userId) {
        setCardSelectionError('User not authenticated');
        return;
      }

      if (!gameData?._id) {
        setCardSelectionError('No active game');
        return;
      }

      // Generate card numbers
      const generatedCard = generateBingoCard();
      
      // Call API to select card
      const response = await gameAPI.selectCardWithNumber({
        gameId: gameData._id,
        userId: userId,
        cardNumbers: generatedCard,
        cardNumber: cardNumber
      });

      if (response.data.success) {
        setSelectedNumber(cardNumber);
        setBingoCard(generatedCard);
        setCardSelectionError('');
        
        // Refresh taken cards
        await fetchTakenCards(gameData._id);
        
        return true;
      } else {
        setCardSelectionError(response.data.message || 'Failed to select card');
        return false;
      }
    } catch (error: any) {
      setCardSelectionError(error.response?.data?.error || 'Failed to select card');
      return false;
    }
  }, [gameData, shouldEnableCardSelection]);

  const generateBingoCard = (): (number | string)[][] => {
    const columns = [];
    
    // B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
    const ranges = [
      { start: 1, end: 15 },
      { start: 16, end: 30 },
      { start: 31, end: 45 },
      { start: 46, end: 60 },
      { start: 61, end: 75 }
    ];
    
    for (let col = 0; col < 5; col++) {
      const columnNumbers: number[] = [];
      const range = ranges[col];
      
      // Generate 5 unique numbers for this column
      while (columnNumbers.length < 5) {
        const num = Math.floor(Math.random() * (range.end - range.start + 1)) + range.start;
        if (!columnNumbers.includes(num)) {
          columnNumbers.push(num);
        }
      }
      
      // Sort numbers
      columnNumbers.sort((a, b) => a - b);
      columns.push(columnNumbers);
    }
    
    // Convert columns to rows
    const rows: (number | string)[][] = [];
    for (let row = 0; row < 5; row++) {
      const rowNumbers: (number | string)[] = [];
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          rowNumbers.push('FREE');
        } else {
          rowNumbers.push(columns[col][row]);
        }
      }
      rows.push(rowNumbers);
    }
    
    return rows;
  };

  const fetchTakenCards = useCallback(async (gameId: string) => {
    try {
      const response = await gameAPI.getTakenCards(gameId);
      if (response.data.success) {
        setTakenCards(response.data.takenCards || []);
      }
    } catch (error) {
      console.error('Failed to fetch taken cards:', error);
    }
  }, []);

  const fetchAvailableCards = useCallback(async (gameId: string, userId: string) => {
    try {
      const response = await gameAPI.getAvailableCards(gameId, userId, 20);
      if (response.data.success) {
        setAvailableCards(response.data.cards || []);
      }
    } catch (error) {
      console.error('Failed to fetch available cards:', error);
    }
  }, []);

  const fetchCardSelectionStatus = useCallback(async (gameId: string) => {
    try {
      const response = await gameAPI.getCardSelectionStatus(gameId);
      if (response.data.success) {
        setCardSelectionStatus({
          isSelectionActive: response.data.canStart || false,
          timeRemaining: response.data.timeRemaining || 0,
          totalPlayers: response.data.totalPlayers || 0,
          playersWithCards: response.data.playersWithCards || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch card selection status:', error);
    }
  }, []);

  // Update card selection status when game data changes
  useEffect(() => {
    if (gameData?._id) {
      // Update from gameData
      setCardSelectionStatus({
        isSelectionActive: shouldEnableCardSelection(),
        timeRemaining: gameData.cardSelectionTimeRemaining || 0,
        totalPlayers: gameData.currentPlayers || 0,
        playersWithCards: gameData.playersWithCards || 0
      });

      // Fetch taken cards
      fetchTakenCards(gameData._id);
      
      // Fetch available cards if needed
      const userId = localStorage.getItem('user_id') || localStorage.getItem('telegram_user_id');
      if (userId) {
        fetchAvailableCards(gameData._id, userId);
      }
    }
  }, [gameData, shouldEnableCardSelection, fetchTakenCards, fetchAvailableCards]);

  return {
    selectedNumber,
    bingoCard,
    availableCards,
    takenCards,
    cardSelectionStatus,
    cardSelectionError,
    shouldEnableCardSelection: shouldEnableCardSelection,
    handleCardSelect,
    handleCardRelease: () => setSelectedNumber(null),
    setCardSelectionError
  };
};
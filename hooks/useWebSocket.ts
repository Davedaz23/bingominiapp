import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface TakenCard {
  cardNumber: number;
  userId: string;
}

interface CardAvailabilityUpdate {
  type: 'CARD_AVAILABILITY_UPDATE';
  takenCards: TakenCard[];
  availableCards: number[];
  totalTakenCards: number;
  totalAvailableCards: number;
}

export const useWebSocket = (
  gameId?: string, 
  userId?: string, 
  onCardsAvailabilityUpdate?: (data: CardAvailabilityUpdate) => void
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [takenCards, setTakenCards] = useState<TakenCard[]>([]);
  const [availableCards, setAvailableCards] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState<any>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<{
    number: number;
    letter: string;
  } | null>(null);
  const [recentCalledNumbers, setRecentCalledNumbers] = useState<
    Array<{ number: number; letter: string; isCurrent?: boolean }>
  >([]);
  const [error, setError] = useState<string>('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  // Message handlers
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

  // Helper function to get BINGO letter
  const getNumberLetter = useCallback((num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  }, []);

  // Initialize available cards (1-400)
  const initializeAvailableCards = useCallback(() => {
    const allCards = Array.from({ length: 400 }, (_, i) => i + 1);
    setAvailableCards(allCards);
  }, []);

  // Update available cards based on taken cards
  const updateAvailableCards = useCallback((newTakenCards: TakenCard[]) => {
    const takenCardNumbers = newTakenCards.map(card => card.cardNumber);
    const allCards = Array.from({ length: 400 }, (_, i) => i + 1);
    const newAvailableCards = allCards.filter(card => !takenCardNumbers.includes(card));
    setAvailableCards(newAvailableCards);
    return { availableCards: newAvailableCards, takenCardNumbers };
  }, []);

  const connect = useCallback(() => {
    if (!gameId || !userId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Initialize available cards
    initializeAvailableCards();

    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://telegram-bingo-bot-opj9.onrender.com'
      : 'ws://localhost:3000';
    
    const wsUrl = `${backendUrl}/ws/game?gameId=${gameId}&userId=${userId}`;
    
    console.log('🔗 Connecting to WebSocket:', wsUrl);
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('✅ WebSocket connected to Render backend');
      console.log('🌐 Backend URL:', backendUrl);
      setIsConnected(true);
      setError('');
      setReconnectAttempts(0);
      
      // Request initial card availability
      if (gameId) {
        sendMessage({
          type: 'GET_CARD_AVAILABILITY',
          gameId
        });
      }
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data.type, data);
        
        // Handle different message types
        switch (data.type) {
          case 'TAKEN_CARDS_UPDATE':
            setTakenCards(data.takenCards || []);
            const { availableCards: updatedCards } = updateAvailableCards(data.takenCards || []);
            
            // Notify parent component if callback provided
            if (onCardsAvailabilityUpdate) {
              onCardsAvailabilityUpdate({
                type: 'CARD_AVAILABILITY_UPDATE',
                takenCards: data.takenCards || [],
                availableCards: updatedCards,
                totalTakenCards: data.takenCards?.length || 0,
                totalAvailableCards: updatedCards.length
              });
            }
            break;
            
          case 'CARD_AVAILABILITY_UPDATE':
            // Direct card availability update from server
            setTakenCards(data.takenCards || []);
            setAvailableCards(data.availableCards || []);
            
            if (onCardsAvailabilityUpdate) {
            onCardsAvailabilityUpdate(data.availableCards);
            }
            break;
            
          case 'CARD_SELECTED':
          case 'CARD_SELECTED_WITH_NUMBER':
            // When a card is selected, update available cards
            if (data.cardNumber) {
              const newTakenCard = {
                cardNumber: data.cardNumber,
                userId: data.userId
              };
              const updatedTakenCards = [...takenCards, newTakenCard];
              setTakenCards(updatedTakenCards);
              const { availableCards: newAvailableCards } = updateAvailableCards(updatedTakenCards);
              
              if (onCardsAvailabilityUpdate) {
                onCardsAvailabilityUpdate({
                  type: 'CARD_AVAILABILITY_UPDATE',
                  takenCards: updatedTakenCards,
                  availableCards: newAvailableCards,
                  totalTakenCards: updatedTakenCards.length,
                  totalAvailableCards: newAvailableCards.length
                });
              }
            }
            break;
            
          case 'GAME_STATUS_UPDATE':
            setGameStatus(data);
            if (data.calledNumbers) {
              setCalledNumbers(data.calledNumbers);
              
              // Update recent called numbers
              const recent = [];
              const totalCalled = data.calledNumbers.length;
              for (let i = Math.max(totalCalled - 3, 0); i < totalCalled; i++) {
                const num = data.calledNumbers[i];
                if (num) {
                  recent.push({
                    number: num,
                    letter: getNumberLetter(num),
                    isCurrent: i === totalCalled - 1
                  });
                }
              }
              setRecentCalledNumbers(recent);
              
              // Update current number
              if (data.currentNumber) {
                setCurrentNumber({
                  number: data.currentNumber,
                  letter: getNumberLetter(data.currentNumber)
                });
              }
            }
            break;
            
          case 'NUMBER_CALLED':
            setCalledNumbers(prev => [...prev, data.number]);
            setCurrentNumber({
              number: data.number,
              letter: getNumberLetter(data.number)
            });
            
            // Update recent called numbers
            setRecentCalledNumbers(prev => {
              const newRecent = [...prev.slice(-2), {
                number: data.number,
                letter: getNumberLetter(data.number),
                isCurrent: true
              }];
              // Mark previous ones as not current
              if (newRecent.length > 1) {
                newRecent[newRecent.length - 2].isCurrent = false;
              }
              return newRecent;
            });
            break;
            
          case 'USER_JOINED':
          case 'USER_LEFT':
          case 'GAME_STARTED':
          case 'BINGO_CLAIMED':
          case 'WINNER_DECLARED':
          case 'NO_WINNER':
            // These events might trigger UI updates
            console.log('🔔 Game event:', data.type);
            break;
            
          case 'PLAYER_DISQUALIFIED':
            if (data.userId === userId) {
              console.log('⛔ You have been disqualified');
              setError('You have been disqualified from this game');
            }
            break;
            
          case 'PONG':
            // Keep alive response
            break;
            
          default:
            // Check for custom message handlers
            const handler = messageHandlers.current.get(data.type);
            if (handler) {
              handler(data);
            }
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };
    
    wsRef.current.onclose = (event) => {
      console.log('🔌 WebSocket disconnected from Render:', event.code, event.reason);
      console.log('🌐 Attempted URL:', backendUrl);
      setIsConnected(false);
      
      // Don't reconnect for error 1006 (abnormal closure)
      if (event.code === 1006) {
        setError('Cannot connect to game server. Please check your internet connection.');
        return;
      }
      
      // Attempt reconnection with exponential backoff
      if (reconnectAttempts < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms...`);
        
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      } else {
        setError('Failed to connect to game server. Please refresh the page.');
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket error connecting to Render:', error);
      console.error('🌐 Attempted URL:', backendUrl);
      setError(`Cannot connect to game server at ${backendUrl}`);
    };
  }, [
    gameId, 
    userId, 
    getNumberLetter, 
    reconnectAttempts, 
    initializeAvailableCards, 
    updateAvailableCards,
    onCardsAvailabilityUpdate
  ]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setTakenCards([]);
    setAvailableCards([]);
    setGameStatus(null);
    setCalledNumbers([]);
    setCurrentNumber(null);
    setRecentCalledNumbers([]);
    setError('');
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('⚠️ WebSocket not connected, cannot send message');
    return false;
  }, []);

  // Register custom message handler
  const onMessage = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
    
    // Return cleanup function
    return () => {
      messageHandlers.current.delete(type);
    };
  }, []);

  // Request current card availability
  const requestCardAvailability = useCallback(() => {
    if (gameId) {
      return sendMessage({
        type: 'GET_CARD_AVAILABILITY',
        gameId
      });
    }
    return false;
  }, [gameId, sendMessage]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!isConnected || !wsRef.current) return;
    
    const interval = setInterval(() => {
      sendMessage({ type: 'PING' });
    }, 30000); // Send ping every 30 seconds
    
    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (gameId && userId) {
      console.log('🚀 useWebSocket: Attempting connection', { gameId, userId });
      connect();
    } else {
      console.log('⏸️ useWebSocket: Missing gameId or userId', { gameId, userId });
    }
    
    return () => {
      console.log('🧹 useWebSocket: Cleaning up');
      disconnect();
    };
  }, [gameId, userId, connect, disconnect]);

  return {
    isConnected,
    takenCards,
    availableCards,
    gameStatus,
    calledNumbers,
    currentNumber,
    recentCalledNumbers,
    error,
    sendMessage,
    onMessage,
    requestCardAvailability,
    reconnect: connect,
    disconnect
  };
};
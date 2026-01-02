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
  const isConnectingRef = useRef(false);
  
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

  // Update available cards based on taken cards
  const updateAvailableCards = useCallback((newTakenCards: TakenCard[]) => {
    const takenCardNumbers = newTakenCards.map(card => card.cardNumber);
    const allCards = Array.from({ length: 400 }, (_, i) => i + 1);
    const newAvailableCards = allCards.filter(card => !takenCardNumbers.includes(card));
    setAvailableCards(newAvailableCards);
    return { availableCards: newAvailableCards, takenCardNumbers };
  }, []);

  const connect = useCallback(() => {
    if (!gameId || !userId || wsRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    console.log('🚀 Starting WebSocket connection...', { gameId, userId });

    // Clean up existing connection
    if (wsRef.current) {
      console.log('🧹 Closing existing WebSocket connection');
      wsRef.current.close();
      wsRef.current = null;
    }

    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://telegram-bingo-bot-opj9.onrender.com'
      : 'ws://localhost:3000';
    
    const wsUrl = `${backendUrl}/ws?gameId=${gameId}&userId=${userId}`;
    
    console.log('🔗 Connecting to WebSocket:', wsUrl);
    
    try {
      wsRef.current = new WebSocket(wsUrl);
    } catch (err) {
      console.error('❌ Failed to create WebSocket:', err);
      isConnectingRef.current = false;
      return;
    }
    
    wsRef.current.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      setIsConnected(true);
      setError('');
      setReconnectAttempts(0);
      isConnectingRef.current = false;
      
      // Request initial card availability
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          sendMessage({
            type: 'GET_CARD_AVAILABILITY',
            gameId,
            userId
          });
          console.log('📤 Sent GET_CARD_AVAILABILITY request');
        }
      }, 500);
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', data.type, data);
        
        // Handle different message types
        switch (data.type) {
          case 'CONNECTED':
            console.log('✅ WebSocket connection confirmed');
            break;
            
          case 'TAKEN_CARDS_UPDATE':
            console.log('🔄 TAKEN_CARDS_UPDATE:', data.takenCards?.length, 'taken cards');
            setTakenCards(data.takenCards || []);
            const { availableCards: updatedCards } = updateAvailableCards(data.takenCards || []);
            
            // Notify parent component
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
            console.log('🎴 CARD_AVAILABILITY_UPDATE:', {
              taken: data.takenCards?.length,
              available: data.availableCards?.length
            });
            setTakenCards(data.takenCards || []);
            setAvailableCards(data.availableCards || []);
            
            if (onCardsAvailabilityUpdate) {
              onCardsAvailabilityUpdate({
                type: 'CARD_AVAILABILITY_UPDATE',
                takenCards: data.takenCards || [],
                availableCards: data.availableCards || [],
                totalTakenCards: data.takenCards?.length || 0,
                totalAvailableCards: data.availableCards?.length || 0
              });
            }
            break;
            
          case 'CARD_SELECTED':
          case 'CARD_SELECTED_WITH_NUMBER':
            console.log(`🎯 ${data.type}: User ${data.userId} selected card ${data.cardNumber}`);
            
            // Add to taken cards if not already there
            if (data.cardNumber) {
              setTakenCards(prev => {
                // Check if card is already in the list
                const alreadyTaken = prev.some(card => card.cardNumber === data.cardNumber);
                if (alreadyTaken) {
                  return prev;
                }
                
                const newTakenCard = {
                  cardNumber: data.cardNumber,
                  userId: data.userId
                };
                
                const updatedTakenCards = [...prev, newTakenCard];
                
                // Update available cards
                const { availableCards: newAvailableCards } = updateAvailableCards(updatedTakenCards);
                
                // Notify parent component
                if (onCardsAvailabilityUpdate) {
                  onCardsAvailabilityUpdate({
                    type: 'CARD_AVAILABILITY_UPDATE',
                    takenCards: updatedTakenCards,
                    availableCards: newAvailableCards,
                    totalTakenCards: updatedTakenCards.length,
                    totalAvailableCards: newAvailableCards.length
                  });
                }
                
                return updatedTakenCards;
              });
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
            console.log('👥 User event:', data.type, data.userId);
            break;
            
          case 'GAME_STARTED':
          case 'BINGO_CLAIMED':
          case 'WINNER_DECLARED':
          case 'NO_WINNER':
            console.log('🎮 Game event:', data.type);
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
        console.error('❌ Error parsing WebSocket message:', error, event.data);
      }
    };
    
    wsRef.current.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      isConnectingRef.current = false;
      
      // Don't reconnect for normal closure
      if (event.code === 1000) {
        console.log('WebSocket closed normally');
        return;
      }
      
      // Don't reconnect for error 1006 (abnormal closure)
      if (event.code === 1006) {
        setError('Cannot connect to game server. Please check your internet connection.');
        return;
      }
      
      // Attempt reconnection with exponential backoff
      if (reconnectAttempts < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1}/5)`);
        
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      } else {
        setError('Failed to connect to game server. Please refresh the page.');
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setError(`WebSocket connection error`);
      isConnectingRef.current = false;
    };
  }, [
    gameId, 
    userId, 
    getNumberLetter, 
    reconnectAttempts, 
    updateAvailableCards,
    onCardsAvailabilityUpdate
  ]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting WebSocket');
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
    setReconnectAttempts(0);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log('📤 WebSocket message sent:', message.type);
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
      console.log('📤 Requesting card availability for game:', gameId);
      return sendMessage({
        type: 'GET_CARD_AVAILABILITY',
        gameId,
        userId
      });
    }
    return false;
  }, [gameId, userId, sendMessage]);

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
      console.log('🚀 useWebSocket: Connecting...', { gameId, userId });
      connect();
    } else {
      console.log('⏸️ useWebSocket: Missing gameId or userId', { gameId, userId });
    }
    
    return () => {
      console.log('🧹 useWebSocket: Cleaning up on unmount');
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
    disconnect,
    connectionStatus: wsRef.current?.readyState || 3 // 3 = CLOSED
  };
};
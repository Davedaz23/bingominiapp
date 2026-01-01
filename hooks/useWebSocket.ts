import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export const useWebSocket = (gameId?: string, userId?: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [takenCards, setTakenCards] = useState<{cardNumber: number, userId: string}[]>([]);
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

  const connect = useCallback(() => {
    if (!gameId || !userId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // FIXED: Use your Render backend URL directly
    // For development: ws://localhost:3000
    // For production: wss://telegram-bingo-bot-opj9.onrender.com
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
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data.type, data);
        
        // Handle different message types
        switch (data.type) {
          case 'TAKEN_CARDS_UPDATE':
            setTakenCards(data.takenCards || []);
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
            
          case 'CARD_SELECTED':
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
  }, [gameId, userId, getNumberLetter, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setTakenCards([]);
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
    gameStatus,
    calledNumbers,
    currentNumber,
    recentCalledNumbers,
    error,
    sendMessage,
    onMessage,
    reconnect: connect,
    disconnect
  };
};
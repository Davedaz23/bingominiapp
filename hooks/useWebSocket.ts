import { useEffect, useRef, useCallback, useState } from 'react';
import { gameAPI } from '../services/api'; // Add this import

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

// Add this interface for sync state
interface SyncState {
    isSyncing: boolean;
    lastSequence: number;
    lastSyncTime: number;
    needsResync: boolean;
}

export const useWebSocket = (
    gameId?: string,
    userId?: string,
    onCardsAvailabilityUpdate?: (data: CardAvailabilityUpdate) => void
) => {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

    // Track if we're intentionally disconnecting
    const intentionalDisconnectRef = useRef(false);
    // Track last gameId and userId to prevent unnecessary reconnections
    const lastGameIdRef = useRef<string | undefined>(gameId);
    const lastUserIdRef = useRef<string | undefined>(userId);

    // Message handlers
    const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

    // Add sync state
    const [syncState, setSyncState] = useState<SyncState>({
        isSyncing: false,
        lastSequence: 0,
        lastSyncTime: 0,
        needsResync: false
    });

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

    // Add sync function - FIXED VERSION
    const performSync = useCallback(async () => {
        if (!gameId || syncState.isSyncing || !isConnected) return;
        
        try {
            setSyncState(prev => ({ ...prev, isSyncing: true }));
            console.log('🔄 Performing sync check...');
            
            // First, check if sync endpoint exists
            try {
                // This endpoint should be added to your backend
                const response = await gameAPI.getSyncState?.(gameId, syncState.lastSequence);
                
                if (response?.data?.success) {
                    const { syncState: serverState, needsFullSync } = response.data;
                    
                    if (needsFullSync && serverState) {
                        console.log('🔄 Full sync required, updating state...');
                        
                        // Update called numbers from server
                        if (serverState.calledNumbers) {
                            setCalledNumbers(serverState.calledNumbers);
                        }
                        
                        // Update current number
                        if (serverState.currentNumber) {
                            setCurrentNumber({
                                number: serverState.currentNumber,
                                letter: getNumberLetter(serverState.currentNumber)
                            });
                        }
                        
                        // Update game status
                        if (serverState.status) {
                            setGameStatus((prev: any) => prev ? {
                                ...prev,
                                status: serverState.status,
                                numbersCalled: serverState.calledNumbers,
                                totalCalled: serverState.totalCalled
                            } : prev);
                        }
                    }
                    
                    setSyncState({
                        isSyncing: false,
                        lastSequence: serverState?.sequence || syncState.lastSequence,
                        lastSyncTime: Date.now(),
                        needsResync: false
                    });
                } else {
                    // If sync endpoint not available, just update timestamp
                    setSyncState(prev => ({
                        ...prev,
                        isSyncing: false,
                        lastSyncTime: Date.now()
                    }));
                }
            } catch (syncError) {
                console.warn('⚠️ Sync endpoint not available or failed:', syncError);
                // If sync fails, just update timestamp and continue
                setSyncState(prev => ({
                    ...prev,
                    isSyncing: false,
                    lastSyncTime: Date.now()
                }));
            }
        } catch (error) {
            console.error('❌ Sync failed:', error);
            setSyncState(prev => ({ ...prev, isSyncing: false, needsResync: true }));
        }
    }, [gameId, syncState.isSyncing, syncState.lastSequence, isConnected, getNumberLetter]);

    const connect = useCallback(() => {
        // Check if we should reconnect
        if (intentionalDisconnectRef.current) {
            console.log('⏸️ Intentional disconnect in progress, skipping reconnect');
            return;
        }

        // Check if already connected
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('✅ Already connected to WebSocket');
            return;
        }

        // Check if connecting
        if (wsRef.current?.readyState === WebSocket.CONNECTING) {
            console.log('⏳ WebSocket connection in progress');
            return;
        }

        if (!gameId || !userId) {
            console.log('⏸️ Missing gameId or userId');
            return;
        }

        console.log('🚀 Starting WebSocket connection...', { gameId, userId });

        // Clean up any existing timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
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
            setError('Failed to create WebSocket connection');
            return;
        }

        wsRef.current.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            setIsConnected(true);
            setError('');
            setReconnectAttempts(0);
            intentionalDisconnectRef.current = false;

            // Store current gameId and userId
            lastGameIdRef.current = gameId;
            lastUserIdRef.current = userId;

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

            // Perform initial sync after connection
            setTimeout(() => {
                performSync();
            }, 1000);
        };

        wsRef.current.onmessage = (event) => {
            try {
                const data: WebSocketMessage = JSON.parse(event.data);
                console.log('📨 WebSocket message received:', data.type, 'seq:', data.sequence);

                // Check sequence for NUMBER_CALLED messages
                if (data.type === 'NUMBER_CALLED' && data.sequence) {
                    const expectedSequence = syncState.lastSequence + 1;
                    
                    // If we're out of sync, mark for resync
                    if (data.sequence !== expectedSequence) {
                        console.warn(`⚠️ Sequence mismatch: expected ${expectedSequence}, got ${data.sequence}`);
                        setSyncState(prev => ({ ...prev, needsResync: true }));
                    } else {
                        // Update sequence
                        setSyncState(prev => ({ 
                            ...prev, 
                            lastSequence: data.sequence,
                            lastSyncTime: Date.now()
                        }));
                    }
                }

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
                        console.log('🎴 CARD_AVAILABILITY_UPDATE');
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
                        console.log(`🎯 ${data.type}: User ${data.userId} selected card`);

                        if (data.cardNumber) {
                            setTakenCards(prev => {
                                const alreadyTaken = prev.some(card => card.cardNumber === data.cardNumber);
                                if (alreadyTaken) {
                                    return prev;
                                }

                                const newTakenCard = {
                                    cardNumber: data.cardNumber,
                                    userId: data.userId
                                };

                                const updatedTakenCards = [...prev, newTakenCard];
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
                        // Only update if it's a new number
                        setCalledNumbers(prev => {
                            if (prev.includes(data.number)) {
                                return prev;
                            }
                            return [...prev, data.number];
                        });

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

                        // Update sequence if provided
                        if (data.sequence) {
                            setSyncState(prev => ({
                                ...prev,
                                lastSequence: data.sequence,
                                lastSyncTime: Date.now()
                            }));
                        }
                        break;

                    case 'USER_JOINED':
                    case 'USER_LEFT':
                        console.log('👥 User event:', data.type);
                        break;

                    case 'GAME_STARTED':
                    case 'BINGO_CLAIMED':
                    case 'WINNER_DECLARED':
                    case 'NO_WINNER':
                        console.log('🎮 Game event:', data.type);
                        setGameStatus((prev: any) => ({
                            ...prev,
                            status: data.type === 'NO_WINNER' ? 'NO_WINNER' : prev?.status,
                            noWinner: data.type === 'NO_WINNER'
                        }));
                        break;

                    case 'PONG':
                        // Keep alive response
                        break;

                    case 'SYNC_REQUEST':
                        // Handle sync request from server
                        if (data.forceSync) {
                            console.log('🔄 Server requested forced sync');
                            setSyncState(prev => ({ ...prev, needsResync: true }));
                        }
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
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            setIsConnected(false);

            // Don't reconnect for normal closure or intentional disconnect
            if (event.code === 1000 || intentionalDisconnectRef.current) {
                console.log('WebSocket closed normally');
                return;
            }

            // Don't reconnect for error 1006 (abnormal closure) after max attempts
            if (event.code === 1006 && reconnectAttempts >= 5) {
                setError('Cannot connect to game server. Please check your internet connection.');
                return;
            }

            // Attempt reconnection with exponential backoff
            if (reconnectAttempts < 5) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1}/5)`);

                reconnectTimeoutRef.current = setTimeout(() => {
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
        };
    }, [
        gameId,
        userId,
        getNumberLetter,
        reconnectAttempts,
        updateAvailableCards,
        onCardsAvailabilityUpdate,
        syncState.lastSequence,
        performSync
    ]);

    const disconnect = useCallback(() => {
        console.log('🔌 Disconnecting WebSocket intentionally');
        intentionalDisconnectRef.current = true;

        // Clear timeouts
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }

        // Close WebSocket
        if (wsRef.current) {
            wsRef.current.close(1000, 'Intentional disconnect');
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
        setSyncState({
            isSyncing: false,
            lastSequence: 0,
            lastSyncTime: 0,
            needsResync: false
        });
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

    // Periodically check sync status
    useEffect(() => {
        if (!isConnected || !gameId) return;
        
        const syncInterval = setInterval(() => {
            // Check if we need resync
            const timeSinceLastSync = Date.now() - syncState.lastSyncTime;
            const needsSync = syncState.needsResync || timeSinceLastSync > 30000;
            
            if (needsSync && !syncState.isSyncing) {
                console.log('🔄 Periodic sync check: needs sync');
                performSync();
            }
        }, 15000);
        
        return () => clearInterval(syncInterval);
    }, [isConnected, gameId, syncState, performSync]);

    // Setup heartbeat
    useEffect(() => {
        if (!isConnected || !wsRef.current) return;

        // Clear any existing interval
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
        }

        heartbeatIntervalRef.current = setInterval(() => {
            sendMessage({ 
                type: 'PING',
                clientTime: Date.now(),
                sequence: syncState.lastSequence 
            });
        }, 30000); // Send ping every 30 seconds

        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        };
    }, [isConnected, sendMessage, syncState.lastSequence]);

    // Connect on mount - only once
    useEffect(() => {
        if (!gameId || !userId) return;

        // Check if we need to reconnect (gameId or userId changed)
        const shouldReconnect =
            lastGameIdRef.current !== gameId ||
            lastUserIdRef.current !== userId;

        if (shouldReconnect) {
            console.log('🔄 GameId or UserId changed, reconnecting...');
            disconnect(); // Clean up old connection
            intentionalDisconnectRef.current = false; // Reset flag
            setReconnectAttempts(0); // Reset reconnect attempts
        }

        // Connect if not already connected
        if (!isConnected && !intentionalDisconnectRef.current) {
            connect();
        }

        return () => {
            // Only cleanup on unmount if component is actually unmounting
            // Don't cleanup when dependencies change
        };
    }, [gameId, userId, isConnected, connect, disconnect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log('🧹 useWebSocket: Cleaning up on unmount');
            disconnect();
        };
    }, [disconnect]);

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
        reconnect: () => {
            setReconnectAttempts(0);
            intentionalDisconnectRef.current = false;
            connect();
        },
        disconnect,
        syncState,
        performSync,
        connectionStatus: wsRef.current?.readyState || 3 // 3 = CLOSED
    };
};
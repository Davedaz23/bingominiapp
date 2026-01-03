/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useState } from 'react';
import { gameAPI } from '../services/api';

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

interface GameStatusUpdate {
    type: 'GAME_STATUS_UPDATE';
    gameId: string;
    status: string;
    currentNumber?: number;
    calledNumbers?: number[];
    totalCalled?: number;
    currentPlayers?: number;
}

interface GameStarted {
    type: 'GAME_STARTED';
    gameId: string;
    gameCode: string;
    startedAt: string;
    playerCount: number;
}

interface CardSelectionStarted {
    type: 'CARD_SELECTION_STARTED';
    gameId: string;
    endTime: string;
    duration: number;
}

interface SyncState {
    isSyncing: boolean;
    lastSequence: number;
    lastSyncTime: number;
    needsResync: boolean;
}

export const useWebSocket = (
    gameId?: string,
    userId?: string,
    onMessage?: (data: any) => void
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
    const intentionalDisconnectRef = useRef(false);
    const lastGameIdRef = useRef<string | undefined>(gameId);
    const lastUserIdRef = useRef<string | undefined>(userId);
    const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());
    const [syncState, setSyncState] = useState<SyncState>({
        isSyncing: false,
        lastSequence: 0,
        lastSyncTime: 0,
        needsResync: false
    });

    const getNumberLetter = useCallback((num: number): string => {
        if (num <= 15) return 'B';
        if (num <= 30) return 'I';
        if (num <= 45) return 'N';
        if (num <= 60) return 'G';
        return 'O';
    }, []);

    const updateAvailableCards = useCallback((newTakenCards: TakenCard[]) => {
        const takenCardNumbers = newTakenCards.map(card => card.cardNumber);
        const allCards = Array.from({ length: 400 }, (_, i) => i + 1);
        const newAvailableCards = allCards.filter(card => !takenCardNumbers.includes(card));
        setAvailableCards(newAvailableCards);
        return { availableCards: newAvailableCards, takenCardNumbers };
    }, []);

    const connect = useCallback(() => {
        if (intentionalDisconnectRef.current) {
            console.log('⏸️ Intentional disconnect in progress, skipping reconnect');
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('✅ Already connected to WebSocket');
            return;
        }

        if (wsRef.current?.readyState === WebSocket.CONNECTING) {
            console.log('⏳ WebSocket connection in progress');
            return;
        }

        if (!gameId || !userId) {
            console.log('⏸️ Missing gameId or userId');
            return;
        }

        console.log('🚀 Starting WebSocket connection...', { gameId, userId });

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

            lastGameIdRef.current = gameId;
            lastUserIdRef.current = userId;

            // Request initial game status and card availability
            setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    // Request game status
                    sendMessage({
                        type: 'GET_GAME_STATUS',
                        gameId,
                        userId
                    });
                    
                    // Request card availability
                    sendMessage({
                        type: 'GET_CARD_AVAILABILITY',
                        gameId,
                        userId
                    });
                    
                    console.log('📤 Sent initial requests');
                }
            }, 500);
        };

        wsRef.current.onmessage = (event) => {
            try {
                const data: WebSocketMessage = JSON.parse(event.data);
                console.log('📨 WebSocket message:', data.type);

                // Call the external message handler
                if (onMessage) {
                    onMessage(data);
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
                        break;

                    case 'CARD_AVAILABILITY_UPDATE':
                        console.log('🎴 CARD_AVAILABILITY_UPDATE');
                        setTakenCards(data.takenCards || []);
                        setAvailableCards(data.availableCards || []);
                        break;

                    case 'CARD_SELECTED':
                    case 'CARD_SELECTED_WITH_NUMBER':
                        console.log(`🎯 ${data.type}: User ${data.userId} selected card`);
                        break;

                    case 'GAME_STATUS_UPDATE':
                        console.log('📊 GAME_STATUS_UPDATE:', data.status);
                        setGameStatus(data);
                        
                        // Update called numbers
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

                    case 'GAME_STARTED':
                        console.log('🚀 GAME_STARTED:', data.gameCode);
                        setGameStatus((prev: any) => ({
                            ...prev,
                            status: 'ACTIVE',
                            startedAt: data.startedAt,
                            currentPlayers: data.playerCount
                        }));
                        break;

                    case 'CARD_SELECTION_STARTED':
                        console.log('🎲 CARD_SELECTION_STARTED');
                        setGameStatus((prev: any) => ({
                            ...prev,
                            status: 'CARD_SELECTION'
                        }));
                        break;

                    case 'NUMBER_CALLED':
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
                            if (newRecent.length > 1) {
                                newRecent[newRecent.length - 2].isCurrent = false;
                            }
                            return newRecent;
                        });

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
                        break;

                    default:
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

            if (event.code === 1000 || intentionalDisconnectRef.current) {
                console.log('WebSocket closed normally');
                return;
            }

            if (event.code === 1006 && reconnectAttempts >= 5) {
                setError('Cannot connect to game server. Please check your internet connection.');
                return;
            }

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
        onMessage
    ]);

    const disconnect = useCallback(() => {
        console.log('🔌 Disconnecting WebSocket intentionally');
        intentionalDisconnectRef.current = true;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }

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

    const onMessageHandler = useCallback((type: string, handler: (data: any) => void) => {
        messageHandlers.current.set(type, handler);

        return () => {
            messageHandlers.current.delete(type);
        };
    }, []);

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

    const requestGameStatus = useCallback(() => {
        if (gameId) {
            console.log('📤 Requesting game status for game:', gameId);
            return sendMessage({
                type: 'GET_GAME_STATUS',
                gameId,
                userId
            });
        }
        return false;
    }, [gameId, userId, sendMessage]);

    useEffect(() => {
        if (!isConnected || !wsRef.current) return;

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
        }

        heartbeatIntervalRef.current = setInterval(() => {
            sendMessage({ 
                type: 'PING',
                clientTime: Date.now(),
                sequence: syncState.lastSequence 
            });
        }, 30000);

        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        };
    }, [isConnected, sendMessage, syncState.lastSequence]);

    useEffect(() => {
        if (!gameId || !userId) return;

        const shouldReconnect =
            lastGameIdRef.current !== gameId ||
            lastUserIdRef.current !== userId;

        if (shouldReconnect) {
            console.log('🔄 GameId or UserId changed, reconnecting...');
            disconnect();
            intentionalDisconnectRef.current = false;
            setReconnectAttempts(0);
        }

        if (!isConnected && !intentionalDisconnectRef.current) {
            connect();
        }

        return () => {
            // Only cleanup on unmount
        };
    }, [gameId, userId, isConnected, connect, disconnect]);

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
        onMessage: onMessageHandler,
        requestCardAvailability,
        requestGameStatus,
        reconnect: () => {
            setReconnectAttempts(0);
            intentionalDisconnectRef.current = false;
            connect();
        },
        disconnect,
        syncState,
        connectionStatus: wsRef.current?.readyState || 3
    };
};
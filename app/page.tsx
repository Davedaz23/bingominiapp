// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { BingoCard, GameState, WalletInfo as WalletInfoType } from '../types';
import { gameService } from '../services/GameService';
import { apiService } from '../services/api';
import WalletInfo from '../components/WalletInfo';
import NumberSelection from '../components/NumberSelection';
import GameBoard from '../components/GameBoard';
import BingoCardDisplay from '../components/BingoCardDisplay';

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [gameState, setGameState] = useState<GameState>({
    isStarted: false,
    calledNumbers: [],
    currentNumber: null,
    players: 0,
    potAmount: 0,
    timeRemaining: 0,
    gameEnded: false
  });
  
  const [allCards, setAllCards] = useState<BingoCard[]>([]);
  const [userCard, setUserCard] = useState<BingoCard | null>(null);
  const [gameTimer, setGameTimer] = useState<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState<number>(10);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isJoiningGame, setIsJoiningGame] = useState<boolean>(false);

  const walletInfo: WalletInfoType = {
    balance: walletBalance,
    betAmount: 10,
    potentialWin: gameState.potAmount,
  };

  // Load wallet balance
  useEffect(() => {
    const loadWallet = async () => {
      try {
        const response = await apiService.getWallet();
        if (response.success) {
          setWalletBalance(response.balance);
        }
      } catch (error) {
        console.error('Failed to load wallet:', error);
        setWalletBalance(100);
      }
    };

    if (isAuthenticated) {
      loadWallet();
    }
  }, [isAuthenticated]);

  // Poll for game state updates
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollGameState = async () => {
      const gameId = gameService.getCurrentGameId();
      if (gameId && gameState.isStarted && !gameState.gameEnded) {
        try {
          const updatedState = await gameService.getGameState();
          setGameState(updatedState);
        } catch (error) {
          console.error('Failed to poll game state:', error);
        }
      }
    };

    if (gameState.isStarted && !gameState.gameEnded) {
      interval = setInterval(pollGameState, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState.isStarted, gameState.gameEnded]);

  const handleCardSelect = async (cardId: string) => {
    if (!user) {
      alert('Please wait for authentication to complete.');
      return;
    }

    if (walletBalance < walletInfo.betAmount) {
      alert(`Insufficient balance. You need ${walletInfo.betAmount} ብር to play.`);
      return;
    }

    setIsJoiningGame(true);
    
    try {
      const gameResult = await gameService.findGameToJoin(walletInfo.betAmount);
      setAllCards(gameResult.cards);
      
      const joinResult = await gameService.joinGame(gameResult.gameId, user.id);
      
      if (joinResult.success) {
        setUserCard(joinResult.card);
        
        const initialState = await gameService.getGameState();
        setGameState(initialState);
        
        setCountdown(10);
        
        if (!initialState.isStarted) {
          const timer = setTimeout(() => {
            checkGameStart();
          }, 10000);
          
          setGameTimer(timer);
        } else {
          setGameState(prev => ({ ...prev, isStarted: true }));
        }
      }
    } catch (error: any) {
      console.error('Failed to join game:', error);
      alert(error.message || 'Failed to join game. Please try again.');
    } finally {
      setIsJoiningGame(false);
    }
  };

  const checkGameStart = async () => {
    try {
      const updatedState = await gameService.getGameState();
      setGameState(updatedState);
    } catch (error) {
      console.error('Failed to check game start:', error);
    }
  };

  const handleBingo = async () => {
    if (!user || !userCard) return;

    try {
      const result = await gameService.claimBingo(user.id);
      
      if (result.success && result.isWinner) {
        console.log('🎉 BINGO! You won! Prize:', result.prize);
        const walletResponse = await apiService.getWallet();
        if (walletResponse.success) {
          setWalletBalance(walletResponse.balance);
        }
      }
      
      setGameState(prev => ({
        ...prev,
        gameEnded: true,
        isStarted: false
      }));
      
      setTimeout(() => {
        handleReturnToSelection();
      }, 5000);
      
    } catch (error) {
      console.error('Failed to claim bingo:', error);
    }
  };

  const handleCallNumber = async () => {
    try {
      const result = await gameService.callNumber();
      setGameState(prev => ({
        ...prev,
        calledNumbers: result.calledNumbers,
        currentNumber: result.number
      }));
    } catch (error) {
      console.error('Failed to call number:', error);
    }
  };

  const handleReturnToSelection = () => {
    setGameState({
      isStarted: false,
      calledNumbers: [],
      currentNumber: null,
      players: 0,
      potAmount: 0,
      timeRemaining: 0,
      gameEnded: false
    });
    
    setUserCard(null);
    setCountdown(10);
    
    if (gameTimer) {
      clearTimeout(gameTimer);
      setGameTimer(null);
    }
    
    gameService.clearCurrentGame();
  };

  const handleChangeCard = () => {
    if (!gameState.isStarted && !gameState.gameEnded) {
      setUserCard(null);
      setCountdown(10);
      
      if (gameTimer) {
        clearTimeout(gameTimer);
        setGameTimer(null);
      }
      
      gameService.clearCurrentGame();
    }
  };

  const showSelection = !gameState.isStarted || gameState.gameEnded;
  const showGameBoard = gameState.isStarted && !gameState.gameEnded;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">Loading Bingo Game...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">Bingo Game</h1>
          <p className="text-white text-lg">Telegram Mini App</p>
          {user && (
            <p className="text-white text-sm mt-2">
              Welcome, {user.firstName}! | Balance: {walletBalance} ብር
            </p>
          )}
        </header>

        <WalletInfo wallet={walletInfo} players={gameState.players} />

        {isJoiningGame && (
          <div className="mb-4 text-center">
            <div className="bg-blue-500 text-white px-6 py-3 rounded-lg inline-block">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                Joining game...
              </div>
            </div>
          </div>
        )}

        {userCard && !gameState.isStarted && !gameState.gameEnded && (
          <div className="mb-4 text-center">
            <div className="bg-orange-500 text-white px-6 py-3 rounded-lg inline-block animate-pulse">
              <h3 className="text-xl font-bold">Game Starting In...</h3>
              <div className="text-4xl font-bold mt-2">{countdown}</div>
              <p className="text-sm mt-1">seconds</p>
            </div>
          </div>
        )}

        {gameState.gameEnded && (
          <div className="mb-4 text-center">
            <div className="bg-purple-500 text-white px-6 py-3 rounded-lg inline-block">
              <h3 className="text-xl font-bold">Game Over!</h3>
              <p className="text-lg mt-1">Select a new card to play again</p>
            </div>
          </div>
        )}

        {showSelection ? (
          <div className="space-y-6">
            <NumberSelection
              cards={allCards}
              userBalance={walletBalance}
              betAmount={walletInfo.betAmount}
              onCardSelect={handleCardSelect}
              selectedCardId={userCard?.id || null}
              isLoading={isJoiningGame}
            />
            
            {userCard && !gameState.isStarted && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Your Selected Card</h3>
                  {!gameState.gameEnded && (
                    <button
                      onClick={handleChangeCard}
                      disabled={isJoiningGame}
                      className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Change Card
                    </button>
                  )}
                </div>
                <BingoCardDisplay 
                  card={userCard} 
                  calledNumbers={[]} 
                />
                <div className="mt-4 text-center">
                  <p className="text-blue-600 font-semibold">
                    {gameState.gameEnded 
                      ? "Select a new card to play again!" 
                      : `Game will start automatically in ${countdown} seconds...`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <GameBoard
            gameState={gameState}
            userCard={userCard}
            onBingo={handleBingo}
            onCallNumber={handleCallNumber}
          />
        )}
      </div>
    </div>
  );
}
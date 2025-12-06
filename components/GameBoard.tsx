// app/components/GameBoard.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { BingoCard as BingoCardType, GameState } from '../types';
import BingoCardDisplay from './BingoCardDisplay';
import NumberGrid from './NumberGrid';

interface GameBoardProps {
  gameState: GameState;
  userCard: BingoCardType | null;
  onBingo: () => void;
  onCallNumber: () => void;
}

export default function GameBoard({ gameState, userCard, onBingo, onCallNumber }: GameBoardProps) {
  const [hasBingo, setHasBingo] = useState(false);
  const [lastCallTime, setLastCallTime] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-call numbers every 5 seconds - FIXED VERSION
  useEffect(() => {
    console.log('GameBoard useEffect - Game started:', gameState.isStarted, 'Has bingo:', hasBingo);
    
    if (gameState.isStarted && !hasBingo) {
      console.log('Setting up auto-call interval');
      
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Call first number immediately if no numbers called yet
      if (gameState.calledNumbers.length === 0) {
        console.log('Calling first number immediately');
        onCallNumber();
        setLastCallTime(Date.now());
      }

      // Set up new interval
      intervalRef.current = setInterval(() => {
        console.log('Auto-call interval triggered');
        onCallNumber();
        setLastCallTime(Date.now());
      }, 5000);

      // Cleanup function
      return () => {
        console.log('Cleaning up interval');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Clean up interval if game is not started or has bingo
      if (intervalRef.current) {
        console.log('Clearing interval - game not active');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [gameState.isStarted, hasBingo, onCallNumber]);

  // Check for bingo
  useEffect(() => {
    if (userCard && gameState.calledNumbers.length > 0 && !hasBingo) {
      console.log('Checking for bingo with numbers:', gameState.calledNumbers);
      if (checkBingo(userCard, gameState.calledNumbers)) {
        console.log('BINGO DETECTED!');
        setHasBingo(true);
        onBingo();
      }
    }
  }, [gameState.calledNumbers, userCard, hasBingo, onBingo]);

  const checkBingo = (card: BingoCardType, calledNumbers: number[]): boolean => {
    const selected = card.numbers.map(row => 
      row.map(number => calledNumbers.includes(number) || number === 0)
    );
    
    return checkLines(selected);
  };

  const checkLines = (selected: boolean[][]): boolean => {
    // Check rows
    for (let i = 0; i < 5; i++) {
      if (selected[i].every(cell => cell)) return true;
    }
    
    // Check columns
    for (let j = 0; j < 5; j++) {
      if (selected.every(row => row[j])) return true;
    }
    
    // Check diagonals
    if (selected[0][0] && selected[1][1] && selected[2][2] && selected[3][3] && selected[4][4]) return true;
    if (selected[0][4] && selected[1][3] && selected[2][2] && selected[3][1] && selected[4][0]) return true;
    
    return false;
  };

  const getCurrentNumberDisplay = () => {
    if (gameState.currentNumber) {
      return gameState.currentNumber;
    }
    if (gameState.calledNumbers.length > 0) {
      return gameState.calledNumbers[gameState.calledNumbers.length - 1];
    }
    return "Waiting...";
  };

  const getNextCallTime = () => {
    if (!lastCallTime) return 5;
    const timeSinceLastCall = Date.now() - lastCallTime;
    const timeUntilNextCall = Math.max(0, 5000 - timeSinceLastCall);
    return Math.ceil(timeUntilNextCall / 1000);
  };

  // Manual call button for testing
  const handleManualCall = () => {
    console.log('Manual call button clicked');
    onCallNumber();
    setLastCallTime(Date.now());
  };

  return (
    <div className="space-y-6">
      {/* Current Number Display - Large and Prominent */}
      <div className="text-center">
        <div className="bg-red-500 text-white px-8 py-6 rounded-lg inline-block shadow-lg">
          <h3 className="text-xl font-semibold mb-3">Current Number</h3>
          <div className="text-6xl font-bold animate-pulse">{getCurrentNumberDisplay()}</div>
          <p className="text-sm mt-3 opacity-90">
            Next number in {getNextCallTime()} seconds
          </p>
        </div>
      </div>



      <div className="text-center">
        <div className="bg-yellow-500 text-white px-4 py-2 rounded-full inline-block">
          {hasBingo ? "BINGO! Game Complete 🎉" : "Game in Progress - Waiting for Winner"}
        </div>
        
        {/* Debug info */}
        <div className="mt-2 text-white text-xs">
          Called Numbers: {gameState.calledNumbers.length} | 
          Game Started: {gameState.isStarted ? 'Yes' : 'No'} | 
          Has Bingo: {hasBingo ? 'Yes' : 'No'} |
          Interval: {intervalRef.current ? 'Active' : 'Inactive'}
        </div>
      </div>
      
      {hasBingo && (
        <div className="bg-green-500 text-white p-6 rounded-lg text-center animate-bounce">
          <h2 className="text-3xl font-bold mb-2">BINGO! 🎉</h2>
          <p className="text-xl">Congratulations! You won!</p>
          <p className="text-lg font-semibold mt-2">
            Prize: {gameState.potAmount} ብር
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NumberGrid 
            calledNumbers={gameState.calledNumbers} 
            currentNumber={gameState.currentNumber} 
          />
          
          {/* Game Info */}
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Numbers Called</p>
                <p className="text-lg font-bold text-blue-600">
                  {gameState.calledNumbers.length}/75
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Players</p>
                <p className="text-lg font-bold text-purple-600">
                  {gameState.players}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prize Pool</p>
                <p className="text-lg font-bold text-green-600">
                  {gameState.potAmount} ብር
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          {userCard && (
            <BingoCardDisplay 
              card={userCard} 
              calledNumbers={gameState.calledNumbers} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
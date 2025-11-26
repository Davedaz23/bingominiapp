// app/components/GameBoard.tsx
'use client';

import { useState, useEffect } from 'react';
import { BingoCard as BingoCardType, GameState } from '../types';
import BingoCardDisplay from './BingoCardDisplay';
import NumberGrid from './NumberGrid';

interface GameBoardProps {
  gameState: GameState;
  userCard: BingoCardType | null;
  onBingo: () => void;
}

export default function GameBoard({ gameState, userCard, onBingo }: GameBoardProps) {
  const [hasBingo, setHasBingo] = useState(false);

  useEffect(() => {
    if (userCard && checkBingo(userCard, gameState.calledNumbers)) {
      setHasBingo(true);
      onBingo();
    }
  }, [gameState.calledNumbers, userCard, onBingo]);

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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="bg-yellow-500 text-white px-4 py-2 rounded-full inline-block animate-pulse">
          Game in Progress - {gameState.timeRemaining}s remaining
        </div>
      </div>
      
      {hasBingo && (
        <div className="bg-green-500 text-white p-4 rounded-lg text-center animate-bounce">
          <h2 className="text-2xl font-bold">BINGO! 🎉</h2>
          <p>Congratulations! You won!</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NumberGrid 
            calledNumbers={gameState.calledNumbers} 
            currentNumber={gameState.currentNumber} 
          />
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
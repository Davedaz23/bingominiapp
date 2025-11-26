// app/utils/bingo.ts
export const generateBingoCard = (id: string): BingoCard => {
  const numbers: number[][] = [];
  
  for (let i = 0; i < 5; i++) {
    const column: number[] = [];
    const start = i * 15 + 1;
    const end = start + 14;
    
    // Generate 5 unique numbers for each column
    const columnNumbers = Array.from({ length: 15 }, (_, index) => start + index)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    
    numbers.push(columnNumbers);
  }
  
  // Transpose to get rows
  const rows: number[][] = [];
  for (let i = 0; i < 5; i++) {
    rows.push(numbers.map(col => col[i]));
  }
  
  // Free space in the middle
  rows[2][2] = 0;
  
  return {
    id,
    numbers: rows,
    selected: rows.map(row => row.map(() => false)),
    owner: ''
  };
};

export const generateAllCards = (): BingoCard[] => {
  const cards: BingoCard[] = [];
  for (let i = 1; i <= 400; i++) {
    cards.push(generateBingoCard(i.toString()));
  }
  return cards;
};

export const checkBingo = (card: BingoCard): boolean => {
  const { selected } = card;
  
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
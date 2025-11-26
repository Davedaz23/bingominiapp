// services/gameService.ts
import { apiService } from './api';
import { BingoCard, GameState } from '../types';

export class GameService {
  private currentGameId: string | null = null;
  private currentGameCode: string | null = null;

  // Find or create a game
  async findOrCreateGame(userId: string): Promise<{ gameId: string; gameCode: string; cards: BingoCard[] }> {
    try {
      // First, try to find waiting games
      const waitingResponse = await apiService.getWaitingGames();
      
      if (waitingResponse.success && waitingResponse.games.length > 0) {
        const game = waitingResponse.games[0];
        const joinResponse = await apiService.joinGame(game.code, userId);
        
        if (joinResponse.success) {
          this.currentGameId = joinResponse.game._id;
          this.currentGameCode = joinResponse.game.code;
          
          const cards = this.generateCardsForSelection();
          return {
            gameId: joinResponse.game._id,
            gameCode: joinResponse.game.code,
            cards
          };
        }
      }
      
      // If no waiting games, create a new one
      const createResponse = await apiService.createGame(userId, 10, false);
      
      if (createResponse.success) {
        this.currentGameId = createResponse.game._id;
        this.currentGameCode = createResponse.game.code;
        
        const cards = this.generateCardsForSelection();
        return {
          gameId: createResponse.game._id,
          gameCode: createResponse.game.code,
          cards
        };
      } else {
        throw new Error('Failed to create or join a game');
      }
    } catch (error) {
      console.error('Failed to find/create game:', error);
      throw error;
    }
  }

  // Join game with selected card
  async joinGameWithCard(gameCode: string, userId: string, cardId: string): Promise<{ success: boolean; card: BingoCard }> {
    try {
      const joinResponse = await apiService.joinGame(gameCode, userId);
      
      if (joinResponse.success) {
        this.currentGameId = joinResponse.game._id;
        this.currentGameCode = joinResponse.game.code;
        
        // Generate a card for the user (your backend might do this)
        const userCard = apiService.generateBingoCard(cardId, userId);
        
        return {
          success: true,
          card: userCard
        };
      } else {
        throw new Error(joinResponse.error || 'Failed to join game');
      }
    } catch (error) {
      console.error('Failed to join game:', error);
      throw error;
    }
  }

  // Start the game
  async startGame(userId: string): Promise<boolean> {
    if (!this.currentGameId) {
      throw new Error('No active game');
    }

    try {
      const response = await apiService.startGame(this.currentGameId, userId);
      return response.success;
    } catch (error) {
      console.error('Failed to start game:', error);
      throw error;
    }
  }

  // Get current game state
  async getGameState(gameId?: string): Promise<GameState> {
    const targetGameId = gameId || this.currentGameId;
    
    if (!targetGameId) {
      throw new Error('No game ID provided');
    }

    try {
      const response = await apiService.getGame(targetGameId);
      
      if (response.success) {
        return this.mapBackendGameToState(response.game);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to get game state:', error);
      throw error;
    }
  }

  // Call a number in the current game
  async callNumber(): Promise<{ number: number; calledNumbers: number[] }> {
    if (!this.currentGameId) {
      throw new Error('No active game');
    }

    try {
      const response = await apiService.callNumber(this.currentGameId);
      
      if (response.success) {
        return {
          number: response.number,
          calledNumbers: response.calledNumbers
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to call number:', error);
      throw error;
    }
  }

  // Mark a number on user's card
  async markNumber(userId: string, number: number): Promise<{ success: boolean; isWinner: boolean; card: BingoCard }> {
    if (!this.currentGameId) {
      throw new Error('No active game');
    }

    try {
      const response = await apiService.markNumber(this.currentGameId, userId, number);
      
      if (response.success) {
        return {
          success: true,
          isWinner: response.isWinner,
          card: response.bingoCard
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to mark number:', error);
      throw error;
    }
  }

  // Generate cards for selection UI
  private generateCardsForSelection(): BingoCard[] {
    const cards: BingoCard[] = [];
    
    for (let i = 1; i <= 400; i++) {
      cards.push(apiService.generateBingoCard(i.toString(), ''));
    }
    
    return cards;
  }

  // Map backend game state to frontend format
  private mapBackendGameToState(backendGame: any): GameState {
    return {
      isStarted: backendGame.status === 'ACTIVE',
      calledNumbers: backendGame.calledNumbers || [],
      currentNumber: backendGame.currentNumber || null,
      players: backendGame.players?.length || backendGame.currentPlayers || 0,
      potAmount: backendGame.potAmount || (backendGame.entryFee || 10) * (backendGame.players?.length || 0),
      timeRemaining: backendGame.timeRemaining || 0,
      gameEnded: backendGame.status === 'FINISHED',
    };
  }

  getCurrentGameId(): string | null {
    return this.currentGameId;
  }

  getCurrentGameCode(): string | null {
    return this.currentGameCode;
  }

  clearCurrentGame(): void {
    this.currentGameId = null;
    this.currentGameCode = null;
  }
}

export const gameService = new GameService();
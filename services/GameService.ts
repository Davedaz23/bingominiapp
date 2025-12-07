      /* eslint-disable @typescript-eslint/no-explicit-any */
      // services/gameService.ts
      import { gameAPI, walletAPI } from './api';
      import { BingoCard, GameState, Game, User } from '../types';

      export class GameService {
        private currentGameId: string | null = null;
        private currentGameCode: string | null = null;

        // Find or create a game
        async findOrCreateGame(userId: string): Promise<{ gameId: string; gameCode: string; cards: BingoCard[] }> {
          try {
            // First, try to find waiting games
            const waitingResponse = await gameAPI.getWaitingGames();
            
            if (waitingResponse.data.success && waitingResponse.data.games.length > 0) {
              const game = waitingResponse.data.games[0];
              const joinResponse = await gameAPI.joinGame(game.code, userId);
              
              if (joinResponse.data.success) {
                this.currentGameId = joinResponse.data.game._id;
                this.currentGameCode = joinResponse.data.game.code;
                
                const cards = this.generateCardsForSelection();
                return {
                  gameId: joinResponse.data.game._id,
                  gameCode: joinResponse.data.game.code,
                  cards
                };
              }
            }
            
            // If no waiting games, create a new one using gameAPI
            // Note: You'll need to add createGame to gameAPI or use a different approach
            const createResponse = await this.createGameWithAPI(userId, 10, false);
            
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

        // Helper method to create game since createGame isn't in gameAPI
        private async createGameWithAPI(hostId: string, maxPlayers?: number, isPrivate?: boolean): Promise<{ success: boolean; game: Game }> {
          try {
            // You can either:
            // 1. Add createGame to your gameAPI in api.ts
            // 2. Use a direct API call
            // 3. Implement game creation logic here
            
            // For now, let's simulate creating a game by joining an existing one or creating via backend
            // This is a temporary implementation - you should add createGame to gameAPI
            const response = await gameAPI.getWaitingGames();
            if (response.data.success && response.data.games.length > 0) {
              const joinResponse = await gameAPI.joinGame(response.data.games[0].code, hostId);
              return {
                success: joinResponse.data.success,
                game: joinResponse.data.game
              };
            }
            
            throw new Error('No games available to join');
          } catch (error) {
            console.error('Failed to create game:', error);
            throw error;
          }
        }

        // Join game with selected card
        async joinGameWithCard(gameCode: string, userId: string, cardId: string): Promise<{ success: boolean; card: BingoCard }> {
          try {
            const joinResponse = await gameAPI.joinGame(gameCode, userId);
            
            if (joinResponse.data.success) {
              this.currentGameId = joinResponse.data.game._id;
              this.currentGameCode = joinResponse.data.game.code;
              
              // Generate a card for the user using the helper method
              const userCard = this.generateBingoCard(cardId, userId);
              
              return {
                success: true,
                card: userCard
              };
            } else {
              throw new Error('Failed to join game');
            }
          } catch (error) {
            console.error('Failed to join game:', error);
            throw error;
          }
        }

        // Join game with wallet (paid entry)
        async joinGameWithWallet(gameCode: string, userId: string, entryFee: number = 10): Promise<{ success: boolean; game: Game }> {
          try {
            const joinResponse = await gameAPI.joinGameWithWallet(gameCode, userId, entryFee);
            
            if (joinResponse.data.success) {
              this.currentGameId = joinResponse.data.game._id;
              this.currentGameCode = joinResponse.data.game.code;
              
              return {
                success: true,
                game: joinResponse.data.game
              };
            } else {
              throw new Error('Failed to join game with wallet');
            }
          } catch (error) {
            console.error('Failed to join game with wallet:', error);
            throw error;
          }
        }

        // Start the game
        async startGame(gameId?: string): Promise<boolean> {
          const targetGameId = gameId || this.currentGameId;
          
          if (!targetGameId) {
            throw new Error('No active game');
          }

          try {
            const response = await gameAPI.startGame(targetGameId);
            return response.data.success;
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
            const response = await gameAPI.getGame(targetGameId);
            
            if (response.data.success) {
              return this.mapBackendGameToState(response.data.game);
            } else {
              throw new Error('Failed to get game state');
            }
          } catch (error) {
            console.error('Failed to get game state:', error);
            throw error;
          }
        }

        // Call a number in the current game
        async callNumber(gameId?: string): Promise<{ number: number; calledNumbers: number[]; totalCalled: number }> {
          const targetGameId = gameId || this.currentGameId;
          
          if (!targetGameId) {
            throw new Error('No active game');
          }

          try {
            const response = await gameAPI.callNumber(targetGameId);
            
            if (response.data.success) {
              return {
                number: response.data.number,
                calledNumbers: response.data.calledNumbers,
                totalCalled: response.data.totalCalled || response.data.calledNumbers.length
              };
            } else {
              throw new Error('Failed to call number');
            }
          } catch (error) {
            console.error('Failed to call number:', error);
            throw error;
          }
        }

        // Mark a number on user's card
        async markNumber(userId: string, number: number, gameId?: string): Promise<{ success: boolean; isWinner: boolean; card: BingoCard }> {
          const targetGameId = gameId || this.currentGameId;
          
          if (!targetGameId) {
            throw new Error('No active game');
          }

          try {
            const response = await gameAPI.markNumber(targetGameId, userId, number);
            
            if (response.data.success) {
              return {
                success: true,
                isWinner: response.data.isWinner,
                card: response.data.bingoCard
              };
            } else {
              throw new Error('Failed to mark number');
            }
          } catch (error) {
            console.error('Failed to mark number:', error);
            throw error;
          }
        }

        // Check for win
        async checkForWin(userId: string, gameId?: string): Promise<{ success: boolean; isWinner: boolean; card: BingoCard; winningPattern?: string }> {
          const targetGameId = gameId || this.currentGameId;
          
          if (!targetGameId) {
            throw new Error('No active game');
          }

          try {
            const response = await gameAPI.checkForWin(targetGameId, userId);
            
            if (response.data.success) {
              return {
                success: true,
                isWinner: response.data.isWinner,
                card: response.data.bingoCard,
                winningPattern: response.data.winningPattern
              };
            } else {
              throw new Error('Failed to check for win');
            }
          } catch (error) {
            console.error('Failed to check for win:', error);
            throw error;
          }
        }

        // Get user's bingo card for a game
        async getUserBingoCard(userId: string, gameId?: string): Promise<BingoCard> {
          const targetGameId = gameId || this.currentGameId;
          
          if (!targetGameId) {
            throw new Error('No active game');
          }

          try {
            const response = await gameAPI.getUserBingoCard(targetGameId, userId);
            
            if (response.data.success) {
              return response.data.bingoCard;
            } else {
              throw new Error('Failed to get bingo card');
            }
          } catch (error) {
            console.error('Failed to get bingo card:', error);
            throw error;
          }
        }

        // Leave game
        async leaveGame(userId: string, gameId?: string): Promise<boolean> {
          const targetGameId = gameId || this.currentGameId;
          
          if (!targetGameId) {
            throw new Error('No active game');
          }

          try {
            const response = await gameAPI.leaveGame(targetGameId, userId);
            
            if (response.data.success) {
              this.clearCurrentGame();
              return true;
            } else {
              throw new Error('Failed to leave game');
            }
          } catch (error) {
            console.error('Failed to leave game:', error);
            throw error;
          }
        }

        // Get winner info
        async getWinnerInfo(gameId?: string): Promise<any> {
          const targetGameId = gameId || this.currentGameId;
          
          if (!targetGameId) {
            throw new Error('No active game');
          }

          try {
            const response = await gameAPI.getWinnerInfo(targetGameId);
            
            if (response.data.success) {
              return response.data.winnerInfo;
            } else {
              throw new Error('Failed to get winner info');
            }
          } catch (error) {
            console.error('Failed to get winner info:', error);
            throw error;
          }
        }

        // Generate cards for selection UI
        private generateCardsForSelection(): BingoCard[] {
          const cards: BingoCard[] = [];
          
          for (let i = 1; i <= 400; i++) {
            cards.push(this.generateBingoCard(i.toString(), ''));
          }
          
          return cards;
        }

        // Generate bingo card locally (moved from apiService)
        private generateBingoCard(id: string, owner: string): BingoCard {
          const numbers: number[][] = [];
          
          for (let i = 0; i < 5; i++) {
            const column: number[] = [];
            const start = i * 15 + 1;
            
            const columnNumbers = Array.from({ length: 15 }, (_, index) => start + index)
              .sort(() => Math.random() - 0.5)
              .slice(0, 5);
            
            numbers.push(columnNumbers);
          }
          
          const rows: number[][] = [];
          for (let i = 0; i < 5; i++) {
            rows.push(numbers.map(col => col[i]));
          }
          
          rows[2][2] = 0; // Free space
          
          return {
            id,
            numbers: rows,
            selected: rows.map(row => row.map(() => false)),
            owner
          };
        }

        // Map backend game state to frontend format
        private mapBackendGameToState(backendGame: Game): GameState {
          return {
            isStarted: backendGame.status === 'ACTIVE',
            calledNumbers: backendGame.calledNumbers || [],
            currentNumber: backendGame.currentNumber || null,
            players: backendGame.players?.length || backendGame.currentPlayers || 0,
            potAmount: backendGame.potAmount || (backendGame.entryFee || 10) * (backendGame.players?.length || 0),
            timeRemaining: backendGame.timeRemaining || 0,
            gameEnded: backendGame.status === 'FINISHED',
          //   status: backendGame.status
          };
        }

        // Get user's active games
        async getUserActiveGames(userId: string): Promise<Game[]> {
          try {
            const response = await gameAPI.getUserActiveGames(userId);
            
            if (response.data.success) {
              return response.data.games;
            } else {
              throw new Error('Failed to get user active games');
            }
          } catch (error) {
            console.error('Failed to get user active games:', error);
            throw error;
          }
        }

        // Get user game history
        async getUserGameHistory(userId: string, limit?: number, page?: number): Promise<{ games: Game[]; pagination: any }> {
          try {
            const response = await gameAPI.getUserGameHistory(userId, limit, page);
            
            if (response.data.success) {
              return {
                games: response.data.games,
                pagination: response.data.pagination
              };
            } else {
              throw new Error('Failed to get user game history');
            }
          } catch (error) {
            console.error('Failed to get user game history:', error);
            throw error;
          }
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

        // Set current game explicitly
        setCurrentGame(gameId: string, gameCode: string): void {
          this.currentGameId = gameId;
          this.currentGameCode = gameCode;
        }
      }

      export const gameService = new GameService();
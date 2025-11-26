// services/api.ts
import axios from 'axios';
import { Game, User, BingoCard } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('bingo_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
// services/api.ts - Replace your response interceptor with this:
apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    // 🛠️ Handle empty error objects gracefully
    if (!error || Object.keys(error).length === 0) {
      console.error('❌ Network Error: Request failed completely (CORS, network down, or invalid URL)');
      
      // Create a proper error object with essential info
      const networkError = new Error('Network request failed');
      (networkError as any).isNetworkError = true;
      (networkError as any).code = 'NETWORK_ERROR';
      return Promise.reject(networkError);
    }
    
    // Existing error handling for non-empty errors
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bingo_token');
        localStorage.removeItem('user_id');
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to get user ID
// services/api.ts - Update getUserId function
const getUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Try multiple ways to get user ID
  const userId = localStorage.getItem('user_id');
  if (userId) return userId;
  
  // If no user_id in localStorage, try to extract from token
  const token = localStorage.getItem('bingo_token');
  if (token) {
    try {
      // Simple extraction - you might want to decode JWT properly
      const parts = token.split('.');
      if (parts.length > 1) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.userId || payload.sub || 'default-user';
      }
    } catch (error) {
      console.warn('Failed to parse token for user ID:', error);
    }
  }
  
  return 'default-user'; // Fallback for development
};

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bingo_token', token);
      localStorage.setItem('user_id', token.split('.')[1] || 'default'); // Simple user ID extraction
    }
  }

  // Auth endpoints
  async telegramAuth(initData: string) {
    const response = await apiClient.post<{ success: boolean; token: string; user: User }>('/auth/telegram', { initData });
    
    if (response.data.success && response.data.user) {
      this.setToken(response.data.token);
    }
    
    return response.data;
  }

  // Game endpoints - USING YOUR EXACT ENDPOINTS
  async createGame(hostId: string, maxPlayers?: number, isPrivate?: boolean) {
    const response = await apiClient.post<{ success: boolean; game: Game }>('/games', { hostId, maxPlayers, isPrivate });
    return response.data;
  }

  async joinGame(code: string, userId: string) {
    const response = await apiClient.post<{ success: boolean; game: Game }>(`/games/${code}/join`, { userId });
    return response.data;
  }

  async startGame(gameId: string, hostId: string) {
    const response = await apiClient.post<{ success: boolean; game: Game }>(`/games/${gameId}/start`, { hostId });
    return response.data;
  }

  async callNumber(gameId: string) {
    const response = await apiClient.post<{ success: boolean; number: number; calledNumbers: number[] }>(`/games/${gameId}/call-number`);
    return response.data;
  }

  async markNumber(gameId: string, userId: string, number: number) {
    const response = await apiClient.post<{ success: boolean; bingoCard: BingoCard; isWinner: boolean }>(`/games/${gameId}/mark-number`, { userId, number });
    return response.data;
  }

  async getActiveGames() {
    const response = await apiClient.get<{ success: boolean; games: Game[] }>('/games/active');
    return response.data;
  }

  async getGame(gameId: string) {
    const response = await apiClient.get<{ success: boolean; game: Game }>(`/games/${gameId}`);
    return response.data;
  }

  // Helper methods for additional functionality
  async getWaitingGames() {
    try {
      // Try to get waiting games specifically
      const response = await apiClient.get<{ success: boolean; games: Game[] }>('/games/waiting');
      return response.data;
    } catch (error) {
      // Fallback: filter active games for waiting status
      const activeGames = await this.getActiveGames();
      if (activeGames.success) {
        const waitingGames = activeGames.games.filter(game => game.status === 'WAITING');
        return {
          success: true,
          games: waitingGames
        };
      }
      throw error;
    }
  }

  // Wallet endpoints
// services/api.ts - Update getWallet method
async getWallet() {
  try {
    const userId = getUserId();
    if (!userId) {
      console.warn('No user ID found, using fallback balance');
      return {
        success: true,
        balance: 100
      };
    }
    
    console.log(`Fetching wallet for user: ${userId}`);
    
    // Try the wallet endpoint
    const response = await apiClient.get<{ success: boolean; balance: number }>(`/wallet/balance/${userId}`);
    
    return response.data;
  } catch (error: any) {
    console.error('Wallet API error:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url
    });
    
    // Development fallback - check if API is reachable
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      console.warn('API server not reachable, using development fallback');
    }
    
    // Fallback for development
    return {
      success: true,
      balance: 100
    };
  }
}

// services/api.ts - Add to ApiService class
async healthCheck(): Promise<boolean> {
  try {
    const response = await apiClient.get('/health');
    return response.status === 200;
  } catch (error) {
    console.warn('API health check failed:', error);
    return false;
  }
}
  // Helper to generate bingo cards locally
  generateBingoCard(id: string, owner: string): BingoCard {
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
}

export const apiService = new ApiService();
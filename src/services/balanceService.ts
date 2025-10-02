// Balance service for Telnyx API integration
export interface BalanceData {
  balance: number;
  currency: string;
  lastUpdated: Date;
}

export interface TelnyxBalanceResponse {
  data: {
    balance: string;
    currency: string;
  };
}

class BalanceService {
  private apiKey: string;
  private baseUrl: string = 'http://35.88.71.8:5000'; // Use your backend server as proxy

  constructor() {
    // Get API key from environment variables or localStorage
    this.apiKey = 'aaaa';
    // Log if using environment variable
    if (this.apiKey) {
      console.log('Using Telnyx API key from environment variables');
    } else if (localStorage.getItem('telnyx_api_key')) {
      console.log('Using Telnyx API key from localStorage');
    } else {
      console.log('No Telnyx API key configured - will use mock data');
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    localStorage.setItem('telnyx_api_key', apiKey);
  }

  async getBalance(): Promise<BalanceData> {
    if (!this.apiKey) {
      throw new Error('Telnyx API key not configured');
    }

    try {
      // Use your backend server to proxy the request to Telnyx API
      const response = await fetch(`${this.baseUrl}/api/telnyx-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: this.apiKey
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status} ${response.statusText}`);
      }

      const data: TelnyxBalanceResponse = await response.json();
      
      return {
        balance: parseFloat(data.data.balance),
        currency: data.data.currency,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  // Mock balance for development/testing
  getMockBalance(): BalanceData {
    // Add some randomness to mock data for testing
    const baseBalance = 125.50;
    const randomVariation = (Math.random() - 0.5) * 20; // ±10 variation
    const mockBalance = Math.max(0, baseBalance + randomVariation);
    
    return {
      balance: Math.round(mockBalance * 100) / 100, // Round to 2 decimal places
      currency: 'USD',
      lastUpdated: new Date(),
    };
  }

  // Check if API key is configured
  hasApiKey(): boolean {
    return !!this.apiKey;
  }
}

export const balanceService = new BalanceService();

export interface MarketData {
  price: number;
  currency: string;
  lastUpdated: Date;
  source: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  expiresAt: Date;
}

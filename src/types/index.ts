export enum InvestmentType {
  STOCK = "STOCK",
  CRYPTO = "CRYPTO",
  PENSION = "PENSION",
  EDUCATION_FUND = "EDUCATION_FUND",
  INVESTMENT_FUND = "INVESTMENT_FUND",
  MONEY_MARKET = "MONEY_MARKET",
  FOREIGN_CURRENCY = "FOREIGN_CURRENCY",
}

export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  settings?: UserSettings;
  investments: Investment[];
}

export interface UserSettings {
  id: string;
  userId: string;
  baseCurrency: string;
  darkMode: boolean;
}

export interface Investment {
  id: string;
  userId: string;
  type: InvestmentType;
  assetName: string;
  ticker?: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  snapshots: InvestmentSnapshot[];
}

export interface InvestmentSnapshot {
  id: string;
  investmentId: string;
  date: Date;
  valueInNIS: number;
}

export interface MarketData {
  price: number;
  currency: string;
  lastUpdated: Date;
  source: string;
}

export interface PortfolioSummary {
  totalValue: number;
  categoryTotals: Record<string, number>;
  assetCount: number;
  lastUpdated: Date;
}

export interface AuthSession {
  userId: string;
  email: string;
  expiresAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface VerificationRequest {
  email: string;
  code: string;
}

export interface InvestmentFormData {
  type: InvestmentType;
  assetName: string;
  ticker?: string;
  quantity: number;
}

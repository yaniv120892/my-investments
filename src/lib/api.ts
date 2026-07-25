import type { AssetClass, Holding, Liquidity, Platform } from "@prisma/client";

const API_BASE = "/api";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
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

export interface UserSettings {
  email: string;
  darkMode: boolean;
  baseCurrency: string;
}

export interface PricingFailure {
  holdingId: string;
  assetName: string;
  sourceSymbol: string | null;
  reason: string;
}

export interface AllocationSlice {
  key: string;
  valueInNis: number;
  actualPercent: number;
  targetPercent: number | null;
  driftPercent: number | null;
  rebalanceAmountNis: number | null;
}

export interface PlatformDrift {
  platformName: string;
  targetTotalPercent: number;
  slices: AllocationSlice[];
}

export type PricedHolding = Holding & {
  platform: Platform;
  valueInNis: number | null;
  unitPrice: number | null;
};

export interface HoldingsResponse {
  holdings: PricedHolding[];
  summary: {
    totalValueNis: number | null;
    pricedValueNis: number;
    isComplete: boolean;
    holdingCount: number;
    pricedCount: number;
    usdToNisRate: number;
    lastUpdated: string;
  };
  allocation: {
    byAssetClass: Record<AssetClass, number>;
    byLiquidity: Record<Liquidity, number>;
    byPlatform: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  drift: PlatformDrift[];
  failures: PricingFailure[];
}

export interface HistoryPoint {
  date: string;
  totalValue: number;
  changeAmount: number;
  changePercent: number;
}

export interface HistoryResponse {
  data: HistoryPoint[];
  period: string;
}

export const api = {
  auth: {
    login: async (
      data: LoginRequest
    ): Promise<
      ApiResponse<{ message: string; verificationRequired?: boolean }>
    > => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    signup: async (
      data: SignupRequest
    ): Promise<
      ApiResponse<{ message: string; verificationRequired?: boolean }>
    > => {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    verify: async (
      data: VerificationRequest
    ): Promise<ApiResponse<{ message: string }>> => {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    logout: async (): Promise<ApiResponse<{ message: string }>> => {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
      });
      return response.json();
    },
  },

  holdings: {
    list: async (): Promise<HoldingsResponse> => {
      const response = await fetch(`${API_BASE}/holdings`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      return response.json();
    },

    history: async (period?: string): Promise<HistoryResponse> => {
      const params = new URLSearchParams();
      if (period) {
        params.append("period", period);
      }
      const response = await fetch(`${API_BASE}/holdings/history?${params}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      return response.json();
    },
  },

  settings: {
    get: async (): Promise<ApiResponse<UserSettings>> => {
      const response = await fetch(`${API_BASE}/user/settings`);
      return response.json();
    },

    update: async (
      data: Partial<UserSettings>
    ): Promise<ApiResponse<UserSettings>> => {
      const response = await fetch(`${API_BASE}/user/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
  },

  snapshot: {
    trigger: async (): Promise<
      ApiResponse<{ message: string; usersProcessed: number }>
    > => {
      const response = await fetch(`${API_BASE}/snapshot`, {
        method: "POST",
      });
      return response.json();
    },
  },

};

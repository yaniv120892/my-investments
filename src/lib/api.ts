import type { Investment } from "@prisma/client";
import type { InvestmentFormData } from "@/types";

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

export interface PortfolioData {
  investments: Investment[];
  summary: {
    totalValue: number;
    categoryTotals: Record<string, number>;
    assetCount: number;
    lastUpdated: Date;
  };
}

export interface InvestmentHistoryData {
  date: string;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface InvestmentHistoryResponse {
  data: InvestmentHistoryData[];
  period: string;
  groupBy: string;
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

  investments: {
    getAll: async (): Promise<ApiResponse<PortfolioData>> => {
      const response = await fetch(`${API_BASE}/investments`);
      return response.json();
    },

    create: async (
      data: InvestmentFormData
    ): Promise<ApiResponse<Investment>> => {
      const response = await fetch(`${API_BASE}/investments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    update: async (
      id: string,
      data: InvestmentFormData
    ): Promise<ApiResponse<Investment>> => {
      const response = await fetch(`${API_BASE}/investments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
      const response = await fetch(`${API_BASE}/investments/${id}`, {
        method: "DELETE",
      });
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

  history: {
    get: async (
      period?: string,
      groupBy?: string
    ): Promise<ApiResponse<InvestmentHistoryResponse>> => {
      const params = new URLSearchParams();
      if (period) params.append("period", period);
      if (groupBy) params.append("groupBy", groupBy);

      const response = await fetch(
        `${API_BASE}/investments/history?${params.toString()}`
      );
      return response.json();
    },
  },
};

export type { InvestmentFormData };

import type { AssetClass, Holding, Liquidity, Platform } from "@prisma/client";
import { ApiError } from "@/lib/apiError";
import type {
  CreateHoldingInput,
  CreatePlatformInput,
  UpdateHoldingInput,
} from "@/lib/holdings/holdingWrite.types";

const API_BASE = "/api";

export type {
  CreateHoldingInput,
  CreatePlatformInput,
  UpdateHoldingInput,
} from "@/lib/holdings/holdingWrite.types";

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

/** The PATCH route echoes the settings row back, which carries no email. */
export interface StoredUserSettings {
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

export interface HoldingMutationResponse {
  holding: Holding & { platform: Platform };
}

export interface ManualValuesResponse {
  confirmedAt: string;
  confirmedCount: number;
}

export interface PlatformsResponse {
  platforms: Platform[];
}

export interface PlatformMutationResponse {
  platform: Platform;
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

    create: async (
      data: CreateHoldingInput
    ): Promise<HoldingMutationResponse> => {
      return sendJson("/holdings", "POST", data);
    },

    update: async (
      holdingId: string,
      data: UpdateHoldingInput
    ): Promise<HoldingMutationResponse> => {
      return sendJson(`/holdings/${holdingId}`, "PATCH", data);
    },

    recordManualValues: async (
      values: Record<string, number>
    ): Promise<ManualValuesResponse> => {
      return sendJson("/holdings/manual-values", "PATCH", { values });
    },

    remove: async (holdingId: string): Promise<{ id: string }> => {
      return sendJson(`/holdings/${holdingId}`, "DELETE");
    },
  },

  platforms: {
    list: async (): Promise<PlatformsResponse> => {
      const response = await fetch(`${API_BASE}/platforms`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      return response.json();
    },

    create: async (
      data: CreatePlatformInput
    ): Promise<PlatformMutationResponse> => {
      return sendJson("/platforms", "POST", data);
    },
  },

  settings: {
    get: async (): Promise<UserSettings> => {
      const response = await fetch(`${API_BASE}/user/settings`);
      return response.json();
    },

    update: async (
      data: Partial<UserSettings>
    ): Promise<StoredUserSettings> => {
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

async function sendJson<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  data?: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.json();
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await readJsonSafely(response);
  return new ApiError(
    readErrorMessage(body) ?? `Request failed (${response.status})`,
    response.status,
    readFieldErrors(body)
  );
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readErrorMessage(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return null;
}

function readFieldErrors(body: unknown): Record<string, string> {
  if (typeof body !== "object" || body === null || !("fieldErrors" in body)) {
    return {};
  }

  const { fieldErrors } = body;
  if (typeof fieldErrors !== "object" || fieldErrors === null) {
    return {};
  }

  const messagesByField: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (typeof message === "string") {
      messagesByField[field] = message;
    }
  }
  return messagesByField;
}

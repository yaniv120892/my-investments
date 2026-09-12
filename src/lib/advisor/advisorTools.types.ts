import type { InvestablePortfolio } from "@/lib/pricing/investablePortfolio.types";

export const USER_ID_CONTEXT_KEY = "userId";
export const TURN_RECORDER_CONTEXT_KEY = "turnRecorder";
export const PORTFOLIO_LOADER_CONTEXT_KEY = "portfolioLoader";

export type PortfolioLoader = () => Promise<InvestablePortfolio>;

import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";
import type { InvestablePortfolio } from "@/lib/pricing/investablePortfolio.types";

export const USER_ID_CONTEXT_KEY = "userId";
export const PLAN_SINK_CONTEXT_KEY = "planSink";
export const PORTFOLIO_LOADER_CONTEXT_KEY = "portfolioLoader";

/**
 * Pricing the portfolio is ~20 serial cache round trips, and a single turn
 * routinely reads it two or three times. Memoised per request so it happens once.
 */
export type PortfolioLoader = () => Promise<InvestablePortfolio>;

/**
 * The rendered table must not be reconstructed from the model's prose, so the
 * planning tool drops its structured result here for the route to stream on.
 */
export type PlanSink = ContributionPlanAccepted[];

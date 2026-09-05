import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";
import type { InvestablePortfolio } from "@/lib/pricing/investablePortfolio.types";

export const USER_ID_CONTEXT_KEY = "userId";
export const PLAN_SINK_CONTEXT_KEY = "planSink";
export const PORTFOLIO_LOADER_CONTEXT_KEY = "portfolioLoader";

export type PortfolioLoader = () => Promise<InvestablePortfolio>;

/**
 * The rendered table must not be reconstructed from the model's prose, so the
 * planning tool drops its structured result here for the route to stream on.
 */
export type PlanSink = ContributionPlanAccepted[];

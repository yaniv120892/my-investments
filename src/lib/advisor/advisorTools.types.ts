import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

export const USER_ID_CONTEXT_KEY = "userId";
export const PLAN_SINK_CONTEXT_KEY = "planSink";

/**
 * The rendered table must not be reconstructed from the model's prose, so the
 * planning tool drops its structured result here for the route to stream on.
 */
export type PlanSink = ContributionPlanAccepted[];

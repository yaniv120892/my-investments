import type {
  AdvisorTurnSummary,
  RecordedToolCall,
} from "@/lib/advisor/advisorTurnRecorder.types";
import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

export type {
  AdvisorTurnSummary,
  RecordedToolCall,
} from "@/lib/advisor/advisorTurnRecorder.types";

/**
 * One turn's tool activity, carried on the request context.
 *
 * It exists because two things downstream need what the tools returned and
 * neither can get it from the model's prose: the route renders the plan table
 * from the structured result, and the grounding check needs every figure a tool
 * produced in order to tell a quoted number from an invented one.
 */
export class AdvisorTurnRecorder {
  private readonly toolCalls: RecordedToolCall[] = [];
  private readonly acceptedPlans: ContributionPlanAccepted[] = [];
  private readonly refusals: string[] = [];

  public recordToolCall(toolId: string, result: unknown): void {
    this.toolCalls.push({ toolId, result });
  }

  public recordPlan(plan: ContributionPlanAccepted): void {
    this.acceptedPlans.push(plan);
  }

  public recordRefusal(reason: string): void {
    this.refusals.push(reason);
  }

  public get plans(): ContributionPlanAccepted[] {
    return [...this.acceptedPlans];
  }

  public get toolResults(): unknown[] {
    return this.toolCalls.map((call) => call.result);
  }

  public get summary(): AdvisorTurnSummary {
    return {
      toolIds: this.toolCalls.map((call) => call.toolId),
      plannedCount: this.acceptedPlans.length,
      refusalReasons: [...this.refusals],
    };
  }
}

export function isAdvisorTurnRecorder(
  value: unknown
): value is AdvisorTurnRecorder {
  return value instanceof AdvisorTurnRecorder;
}

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

  /**
   * `isGrounding` is false for a tool whose result is derived from what the
   * model passed in. Recording those would let it ground any figure it liked by
   * feeding the number through a tool first.
   */
  public recordToolCall(
    toolId: string,
    result: unknown,
    isGrounding = true
  ): void {
    this.toolCalls.push({ toolId, result, isGrounding });
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

  /** Only results the model could not have dictated. */
  public get groundingResults(): unknown[] {
    return this.toolCalls
      .filter((call) => call.isGrounding)
      .map((call) => call.result);
  }

  public get hasGroundingResults(): boolean {
    return this.toolCalls.some((call) => call.isGrounding);
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

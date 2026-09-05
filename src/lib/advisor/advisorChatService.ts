import { RequestContext } from "@mastra/core/request-context";
import type { Agent } from "@mastra/core/agent";
import { getInvestmentAdvisor } from "@/lib/advisor/investmentAdvisor";
import { getThreadId, hasAdvisorMemory } from "@/lib/advisor/advisorMemory";
import { createInvestablePortfolioLoader } from "@/lib/pricing/investablePortfolio";
import {
  PLAN_SINK_CONTEXT_KEY,
  PORTFOLIO_LOADER_CONTEXT_KEY,
  USER_ID_CONTEXT_KEY,
} from "@/lib/advisor/advisorTools.types";
import type { PlanSink } from "@/lib/advisor/advisorTools.types";
import type { AdvisorChatMessage } from "@/lib/advisor/advisorMessages.types";

type OutgoingMessage =
  { role: "user"; content: string } | { role: "assistant"; content: string };

/**
 * Without memory the thread holds nothing, so the transcript is the only
 * context — but the request caps (100 messages of 4000 chars) were sized for a
 * request body, not a model window, and would overflow it.
 */
const MAX_STATELESS_TURNS = 12;

export type AdvisorRun = Awaited<ReturnType<Agent["stream"]>>;

export class AdvisorChatService {
  public async streamAdvisorResponse(
    messages: AdvisorChatMessage[],
    userId: string,
    planSink: PlanSink,
    abortSignal?: AbortSignal
  ): Promise<AdvisorRun> {
    const requestContext = new RequestContext();
    requestContext.set(USER_ID_CONTEXT_KEY, userId);
    requestContext.set(PLAN_SINK_CONTEXT_KEY, planSink);
    requestContext.set(
      PORTFOLIO_LOADER_CONTEXT_KEY,
      createInvestablePortfolioLoader(userId)
    );

    const result = await getInvestmentAdvisor().stream(
      this.toModelMessages(messages),
      {
        memory: { thread: getThreadId(userId), resource: userId },
        requestContext,
        ...(abortSignal ? { abortSignal } : {}),
      }
    );

    // Returned whole, not as `.textStream`: a failed run does not reject the
    // stream, it closes normally and reports on `result.error`. Handing back
    // only the deltas makes a bad API key indistinguishable from a short answer.
    return result;
  }

  /**
   * With memory on the thread already holds the earlier turns, so resending the
   * whole history would append every one of them a second time.
   */
  private toModelMessages(messages: AdvisorChatMessage[]): OutgoingMessage[] {
    const selected = hasAdvisorMemory()
      ? messages.slice(-1)
      : messages.slice(-MAX_STATELESS_TURNS);

    return selected.map((message) =>
      message.sender === "user"
        ? { role: "user" as const, content: message.text }
        : { role: "assistant" as const, content: message.text }
    );
  }
}

export const advisorChatService = new AdvisorChatService();

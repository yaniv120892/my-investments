import { RequestContext } from "@mastra/core/request-context";
import { getInvestmentAdvisor } from "@/lib/advisor/investmentAdvisor";
import { getThreadId, isMemoryEnabled } from "@/lib/advisor/advisorMemory";
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

export class AdvisorChatService {
  public async streamAdvisorResponse(
    messages: AdvisorChatMessage[],
    userId: string,
    planSink: PlanSink,
    abortSignal?: AbortSignal
  ): Promise<AsyncIterable<string>> {
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

    return result.textStream;
  }

  /**
   * With memory on the thread already holds the earlier turns, so resending the
   * whole history would append every one of them a second time.
   */
  private toModelMessages(messages: AdvisorChatMessage[]): OutgoingMessage[] {
    const selected = isMemoryEnabled() ? messages.slice(-1) : messages;

    return selected.map((message) =>
      message.sender === "user"
        ? { role: "user" as const, content: message.text }
        : { role: "assistant" as const, content: message.text }
    );
  }
}

export const advisorChatService = new AdvisorChatService();

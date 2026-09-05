"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { streamAdvisorMessage } from "@/lib/advisorStream";
import { fitChatHistory } from "@/lib/advisor/advisorMessages";
import type { AdvisorChatMessage } from "@/lib/advisor/advisorMessages.types";
import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

export interface AdvisorChat {
  messages: AdvisorChatMessage[];
  plan: ContributionPlanAccepted | null;
  isLoading: boolean;
  isAwaitingFirstToken: boolean;
  sendMessage: (text: string) => Promise<void>;
  cancel: () => void;
}

export function useAdvisorChat(): AdvisorChat {
  const [messages, setMessages] = useState<AdvisorChatMessage[]>([]);
  const [plan, setPlan] = useState<ContributionPlanAccepted | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Teardown belongs to the `finally` in `sendMessage`, which the abort reaches.
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const transcript: AdvisorChatMessage[] = [
        ...messages,
        { sender: "user", text: trimmed },
      ];
      setMessages([...transcript, { sender: "advisor", text: "" }]);
      // A refused follow-up produces no plan frame, and leaving the previous
      // table up would present the old split as the answer to a new question.
      setPlan(null);
      setIsLoading(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await streamAdvisorMessage(
          // Fitted for the wire only. Writing the fitted copy back into state
          // would truncate a long reply the user has already read.
          fitChatHistory(transcript),
          {
            onDelta: (delta) => {
              setMessages((current) => appendToLastMessage(current, delta));
            },
            onPlan: setPlan,
            onError: (message) => {
              setMessages((current) => appendToLastMessage(current, message));
            },
            onSessionExpired: () => {
              router.push("/login?reason=session-expired");
            },
          },
          abortController.signal
        );
      } catch {
        if (!abortController.signal.aborted) {
          setMessages((current) =>
            appendToLastMessage(
              current,
              "The advisor could not be reached. Please try again."
            )
          );
        }
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
        // An answer stopped before its first token leaves an empty bubble. It
        // would go back out as history and fail the request schema's min(1),
        // failing every later send until the page is reloaded.
        setMessages(dropTrailingEmptyReply);
      }
    },
    [isLoading, messages, router]
  );

  const lastMessage = messages[messages.length - 1];
  const isAwaitingFirstToken =
    isLoading &&
    lastMessage?.sender === "advisor" &&
    lastMessage.text.trim() === "";

  return {
    messages,
    plan,
    isLoading,
    isAwaitingFirstToken,
    sendMessage,
    cancel,
  };
}

function appendToLastMessage(
  messages: AdvisorChatMessage[],
  delta: string
): AdvisorChatMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  const last = messages[messages.length - 1];
  return [
    ...messages.slice(0, -1),
    { sender: last.sender, text: last.text + delta },
  ];
}

function dropTrailingEmptyReply(
  messages: AdvisorChatMessage[]
): AdvisorChatMessage[] {
  const last = messages[messages.length - 1];
  const isEmptyReply = last?.sender === "advisor" && last.text.trim() === "";
  return isEmptyReply ? messages.slice(0, -1) : messages;
}

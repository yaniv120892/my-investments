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

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const history = fitChatHistory([
        ...messages,
        { sender: "user", text: trimmed },
      ]);
      setMessages([...history, { sender: "advisor", text: "" }]);
      setIsLoading(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await streamAdvisorMessage(
          history,
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
      }
    },
    [isLoading, messages, router]
  );

  const lastMessage = messages[messages.length - 1];
  const isAwaitingFirstToken =
    isLoading && lastMessage?.sender === "advisor" && lastMessage.text === "";

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

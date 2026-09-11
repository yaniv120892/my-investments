import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiError";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const UNAUTHORIZED = 401;

/**
 * Every read goes through this cache, so an expired session is handled once
 * here rather than by each page discovering it and rendering the word
 * "Unauthorized" where data should be.
 */
function isExpiredSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === UNAUTHORIZED;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isExpiredSession(error) && typeof window !== "undefined") {
        window.location.assign("/login?reason=session-expired");
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      gcTime: TEN_MINUTES_MS,
      // Retrying an expired session just delays the redirect.
      retry: (failureCount, error) =>
        !isExpiredSession(error) && failureCount < 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

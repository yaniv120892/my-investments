import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateHoldingInput,
  CreatePlatformInput,
  LoginRequest,
  ReplaceTargetsRequest,
  SignupRequest,
  UpdateHoldingInput,
  VerificationRequest,
  UserSettings,
} from "./api";
import { api } from "./api";

export const useLogin = () => {
  return useMutation({
    mutationFn: (data: LoginRequest) => api.auth.login(data),
  });
};

export const useSignup = () => {
  return useMutation({
    mutationFn: (data: SignupRequest) => api.auth.signup(data),
  });
};

export const useVerify = () => {
  return useMutation({
    mutationFn: (data: VerificationRequest) => api.auth.verify(data),
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

export const useHoldings = () => {
  return useQuery({
    queryKey: ["holdings"],
    queryFn: () => api.holdings.list(),
    staleTime: 2 * 60 * 1000,
  });
};

export const useHoldingHistory = (period?: string) => {
  return useQuery({
    queryKey: ["holdingHistory", period],
    queryFn: () => api.holdings.history(period),
    staleTime: 5 * 60 * 1000,
  });
};

export const usePlatforms = () => {
  return useQuery({
    queryKey: ["platforms"],
    queryFn: () => api.platforms.list(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreatePlatform = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlatformInput) => api.platforms.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
    },
  });
};

export const useCreateHolding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHoldingInput) => api.holdings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
};

export const useUpdateHolding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      holdingId,
      data,
    }: {
      holdingId: string;
      data: UpdateHoldingInput;
    }) => api.holdings.update(holdingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
};

export const useRecordManualValues = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Record<string, number>) =>
      api.holdings.recordManualValues(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
};

export const useDeleteHolding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holdingId: string) => api.holdings.remove(holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
};

export const useUserSettings = () => {
  return useQuery({
    queryKey: ["userSettings"],
    queryFn: () => api.settings.get(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<UserSettings>) => api.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] });
    },
  });
};

export const useTriggerSnapshot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.snapshot.trigger(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdingHistory"] });
    },
  });
};

export const useTargets = () => {
  return useQuery({
    queryKey: ["targets"],
    queryFn: () => api.targets.get(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useReplaceTargets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReplaceTargetsRequest) => api.targets.replace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      // Within-class weights live on Holding, so the holdings query is stale too.
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
};

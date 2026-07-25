import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  LoginRequest,
  SignupRequest,
  VerificationRequest,
  UserSettings,
} from "./api";

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

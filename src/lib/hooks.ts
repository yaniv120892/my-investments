import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  LoginRequest,
  SignupRequest,
  VerificationRequest,
  UserSettings,
  InvestmentFormData,
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

export const usePortfolio = () => {
  return useQuery({
    queryKey: ["portfolio"],
    queryFn: () => api.investments.getAll(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCreateInvestment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InvestmentFormData) => api.investments.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};

export const useUpdateInvestment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvestmentFormData }) =>
      api.investments.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};

export const useDeleteInvestment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.investments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};

export const useUserSettings = () => {
  return useQuery({
    queryKey: ["userSettings"],
    queryFn: () => api.settings.get(),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
  return useMutation({
    mutationFn: () => api.snapshot.trigger(),
  });
};

export const useInvestmentHistory = (period?: string, groupBy?: string) => {
  return useQuery({
    queryKey: ["investmentHistory", period, groupBy],
    queryFn: () => api.history.get(period, groupBy),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

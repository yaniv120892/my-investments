"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Button,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSignup, useVerify } from "@/lib/hooks";
import { describeError } from "@/utils/describeError";

const MINIMUM_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const [step, setStep] = useState<"signup" | "verification">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const signupMutation = useSignup();
  const verifyMutation = useVerify();
  const isLoading = signupMutation.isPending || verifyMutation.isPending;

  const handleSignup = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters long`
      );
      return;
    }

    try {
      const result = await signupMutation.mutateAsync({ email, password });

      if (result.error) {
        setError(result.error);
      } else if (result.data?.verificationRequired) {
        setStep("verification");
      } else {
        router.push("/dashboard");
      }
    } catch (signupFailure) {
      setError(describeError(signupFailure));
    }
  };

  const handleVerification = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError("");

    try {
      const result = await verifyMutation.mutateAsync({
        email,
        code: verificationCode,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    } catch (verificationFailure) {
      setError(describeError(verificationFailure));
    }
  };

  return (
    <Stack
      component="form"
      spacing={2.5}
      onSubmit={step === "signup" ? handleSignup : handleVerification}
    >
      <Stack spacing={0.5}>
        <Typography variant="h3" component="h2">
          {step === "signup" ? "Create account" : "Verify code"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {step === "signup"
            ? "Track every platform and asset class in one place."
            : "We sent a verification code to your email."}
        </Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {step === "signup" ? (
        <>
          <TextField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            autoFocus
            fullWidth
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
            helperText={`At least ${MINIMUM_PASSWORD_LENGTH} characters`}
            fullWidth
          />
          <TextField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
            fullWidth
          />
        </>
      ) : (
        <TextField
          id="code"
          label="Verification code"
          value={verificationCode}
          onChange={(event) => setVerificationCode(event.target.value)}
          required
          autoComplete="one-time-code"
          placeholder="000000"
          slotProps={{
            htmlInput: {
              maxLength: 6,
              style: {
                textAlign: "center",
                fontSize: "1.5rem",
                letterSpacing: "0.4em",
              },
            },
          }}
          fullWidth
        />
      )}

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={isLoading}
        fullWidth
      >
        {isLoading
          ? "Loading…"
          : step === "signup"
            ? "Create account"
            : "Verify"}
      </Button>

      {step === "signup" && (
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Already have an account?{" "}
          <MuiLink component={Link} href="/login">
            Sign in
          </MuiLink>
        </Typography>
      )}
    </Stack>
  );
}

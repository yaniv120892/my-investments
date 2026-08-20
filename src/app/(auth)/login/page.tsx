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
import { useLogin, useVerify } from "@/lib/hooks";
import { describeError } from "@/utils/describeError";

export default function LoginPage() {
  const [step, setStep] = useState<"login" | "verification">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [lockEmail, setLockEmail] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const loginMutation = useLogin();
  const verifyMutation = useVerify();
  const isLoading = loginMutation.isPending || verifyMutation.isPending;

  const handleLogin = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError("");

    try {
      const result = await loginMutation.mutateAsync({ email, password });

      if (result.error) {
        setError(result.error);
      } else if (result.data?.verificationRequired) {
        setLockEmail(true);
        setStep("verification");
      } else {
        router.push("/dashboard");
      }
    } catch (loginFailure) {
      setError(describeError(loginFailure));
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
      onSubmit={step === "login" ? handleLogin : handleVerification}
    >
      <Stack spacing={0.5}>
        <Typography variant="h3" component="h2">
          {step === "login" ? "Sign in" : "Verify code"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {step === "login"
            ? "Welcome back — pick up where your portfolio left off."
            : "We sent a verification code to your email."}
        </Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {step === "login" ? (
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
            autoComplete="current-password"
            fullWidth
          />
          <Button
            type="button"
            size="small"
            onClick={() => {
              setLockEmail(false);
              setStep("verification");
            }}
            sx={{ alignSelf: "flex-end" }}
          >
            I already have a code
          </Button>
        </>
      ) : (
        <>
          <TextField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            disabled={lockEmail}
            fullWidth
          />
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
        </>
      )}

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={isLoading}
        fullWidth
      >
        {isLoading ? "Loading…" : step === "login" ? "Sign in" : "Verify"}
      </Button>

      {step === "verification" ? (
        <Button
          type="button"
          size="small"
          color="inherit"
          onClick={() => setStep("login")}
        >
          Back to login
        </Button>
      ) : (
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Don&apos;t have an account?{" "}
          <MuiLink component={Link} href="/signup">
            Create one
          </MuiLink>
        </Typography>
      )}
    </Stack>
  );
}

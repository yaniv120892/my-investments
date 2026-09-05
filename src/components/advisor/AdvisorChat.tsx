"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import type { AdvisorChat as AdvisorChatState } from "@/lib/useAdvisorChat";

interface AdvisorChatProps {
  chat: AdvisorChatState;
}

const SUGGESTIONS = [
  "I have ₪50,000 to invest, where should it go?",
  "Same but skip crypto and nothing under ₪500",
  "Why did you pick that split?",
];

export default function AdvisorChat({ chat }: AdvisorChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Keyed on the count, not the array: streaming replaces the array on every
  // token, and a smooth scroll restarted per token cancels itself.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.length]);

  const submit = async () => {
    const text = input;
    setInput("");
    await chat.sendMessage(text);
  };

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2}>
          <Box
            sx={{
              maxHeight: 420,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {chat.messages.length === 0 && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Tell the advisor how much you have to invest. It reads your
                  liquid holdings and targets, and every figure it gives comes
                  from the planner rather than from the model.
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      size="small"
                      variant="outlined"
                      onClick={() => chat.sendMessage(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            )}

            {chat.messages.map((message, index) => (
              <Paper
                key={`${message.sender}-${index}`}
                variant="outlined"
                data-testid="advisor-message"
                data-sender={message.sender}
                sx={{
                  p: 1.5,
                  alignSelf:
                    message.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  bgcolor:
                    message.sender === "user"
                      ? "action.hover"
                      : "background.paper",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "pre-wrap" }}
                  dir="auto"
                >
                  {message.text}
                </Typography>
              </Paper>
            ))}

            {chat.isAwaitingFirstToken && <CircularProgress size={20} />}
            <div ref={bottomRef} />
          </Box>

          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={4}
              placeholder="I have ₪20,000 to invest…"
              value={input}
              disabled={chat.isLoading}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            {chat.isLoading ? (
              <Button variant="outlined" onClick={chat.cancel}>
                Stop
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<SendOutlinedIcon />}
                disabled={!input.trim()}
                onClick={() => void submit()}
              >
                Ask
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

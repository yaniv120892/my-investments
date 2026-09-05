import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface ScriptedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type ScriptedTurn = { toolCalls: ScriptedToolCall[] } | { text: string };

export interface RecordedRequest {
  messages: { role: string; content?: unknown }[];
  toolNames: string[];
}

export interface MockModelServer {
  url: string;
  requests: RecordedRequest[];
  toolResultTexts: () => string[];
  close: () => Promise<void>;
}

/**
 * An OpenAI-compatible /chat/completions endpoint that replays a script.
 *
 * It exists so the agent's routing can be asserted without a real model: what
 * matters is which tool it called with which arguments, and that is a property
 * of the harness, not of the model's mood. Every request is recorded, so a test
 * can also read back exactly what the tools returned.
 */
export async function startMockModelServer(
  script: ScriptedTurn[]
): Promise<MockModelServer> {
  const requests: RecordedRequest[] = [];
  let turnIndex = 0;

  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = safeParse(body);
      requests.push({
        messages: readMessages(parsed),
        toolNames: readToolNames(parsed),
      });

      const turn = script[turnIndex] ?? { text: "No script left." };
      turnIndex += 1;

      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      for (const chunk of streamChunks(turn)) {
        response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      response.write("data: [DONE]\n\n");
      response.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/v1`,
    requests,
    toolResultTexts: () => collectToolResultTexts(requests),
    close: () => closeServer(server),
  };
}

function streamChunks(turn: ScriptedTurn): unknown[] {
  const base = {
    id: "chatcmpl-mock",
    object: "chat.completion.chunk",
    created: 0,
    model: "gpt-4o",
  };

  if ("text" in turn) {
    return [
      { ...base, choices: [delta({ role: "assistant", content: turn.text })] },
      { ...base, choices: [finish("stop")] },
    ];
  }

  const calls = turn.toolCalls.map((call, index) => ({
    index,
    id: `call_${index}`,
    type: "function",
    function: { name: call.name, arguments: JSON.stringify(call.arguments) },
  }));

  return [
    { ...base, choices: [delta({ role: "assistant", tool_calls: calls })] },
    { ...base, choices: [finish("tool_calls")] },
  ];
}

function delta(content: Record<string, unknown>) {
  return { index: 0, delta: content, finish_reason: null };
}

function finish(reason: string) {
  return { index: 0, delta: {}, finish_reason: reason };
}

function readMessages(parsed: unknown): { role: string; content?: unknown }[] {
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("messages" in parsed)
  ) {
    return [];
  }
  const { messages } = parsed;
  return Array.isArray(messages) ? messages : [];
}

function readToolNames(parsed: unknown): string[] {
  if (typeof parsed !== "object" || parsed === null || !("tools" in parsed)) {
    return [];
  }
  const { tools } = parsed;
  if (!Array.isArray(tools)) {
    return [];
  }
  return tools.flatMap((tool) => {
    const name = readFunctionName(tool);
    return name ? [name] : [];
  });
}

function readFunctionName(tool: unknown): string | null {
  if (typeof tool !== "object" || tool === null || !("function" in tool)) {
    return null;
  }
  const definition = tool.function;
  if (
    typeof definition === "object" &&
    definition !== null &&
    "name" in definition &&
    typeof definition.name === "string"
  ) {
    return definition.name;
  }
  return null;
}

/**
 * A tool result reaches the model as a `tool` message, so the last recorded
 * request holds everything the tools produced this turn.
 */
function collectToolResultTexts(requests: RecordedRequest[]): string[] {
  const texts: string[] = [];
  for (const request of requests) {
    for (const message of request.messages) {
      if (message.role === "tool" && typeof message.content === "string") {
        texts.push(message.content);
      }
    }
  }
  return texts;
}

function safeParse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

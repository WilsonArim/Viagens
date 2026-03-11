"use client";

import { getToolDefinitions } from "@/lib/webmcp/tools";

export type WebMCPInvocationStatus = "processing" | "complete" | "error";

export interface WebMCPInvocationEvent {
  toolName: string;
  input: unknown;
  status: WebMCPInvocationStatus;
  result?: unknown;
  error?: string;
}

export type WebMCPEventListener = (event: WebMCPInvocationEvent) => void;
type ToolPayload = {
  error?: string;
};

async function invokeTool(toolName: string, input?: unknown): Promise<unknown> {
  const response = await fetch("/api/webmcp/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ toolName, input }),
  });

  const payload = await response.json().catch(() => ({ error: "invalid_response" }));

  if (!response.ok) {
    const payloadError = (payload as ToolPayload).error;
    const message =
      typeof payloadError === "string"
        ? payloadError
        : `tool_execution_failed_${response.status}`;

    throw new Error(message);
  }

  return payload;
}

function emitInvocation(event: WebMCPInvocationEvent, listener?: WebMCPEventListener) {
  listener?.(event);

  const maybeContext = navigator.modelContext;
  if (maybeContext?.dispatchEvent) {
    maybeContext.dispatchEvent(new CustomEvent("toolinvocation", { detail: event }));
  }
}

async function toolHandler(
  toolName: string,
  input: unknown,
  listener?: WebMCPEventListener,
): Promise<unknown> {
  emitInvocation({ toolName, input, status: "processing" }, listener);

  try {
    const result = await invokeTool(toolName, input);
    emitInvocation({ toolName, input, status: "complete", result }, listener);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_tool_error";
    emitInvocation({ toolName, input, status: "error", error: message }, listener);
    throw error;
  }
}

export async function registerWebMCPTools(listener?: WebMCPEventListener) {
  if (typeof window === "undefined") {
    return {
      supported: false,
      registered: 0,
    };
  }

  const tools = getToolDefinitions();
  const fallbackExecutor = (toolName: string, input?: unknown) =>
    toolHandler(toolName, input, listener);

  (window as Window & { detetiveTools?: unknown }).detetiveTools = {
    executeTool: fallbackExecutor,
  };

  const modelContext = navigator.modelContext;
  if (!modelContext) {
    return {
      supported: false,
      registered: 0,
    };
  }

  let registered = 0;

  for (const tool of tools) {
    try {
      await Promise.resolve(
        modelContext.registerTool(tool, (input: unknown) =>
          toolHandler(tool.name, input, listener),
        ),
      );
      registered += 1;
      continue;
    } catch {
      // Fallback to descriptor-only registration for environments with stricter API signatures.
    }

    try {
      await Promise.resolve(modelContext.registerTool(tool));
      registered += 1;
    } catch {
      // Ignore per-tool registration failures to keep graceful degradation.
    }
  }

  return {
    supported: true,
    registered,
  };
}

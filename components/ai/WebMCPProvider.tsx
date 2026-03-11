"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  registerWebMCPTools,
  type WebMCPInvocationEvent,
  type WebMCPInvocationStatus,
} from "@/lib/webmcp/register";
import type { ModelContextToolInvocationEvent } from "@/types/webmcp";

type ProviderStatus = "idle" | WebMCPInvocationStatus;

interface WebMCPState {
  supported: boolean;
  status: ProviderStatus;
  activeTool: string | null;
  lastResult: unknown;
  error: string | null;
}

interface WebMCPContextValue extends WebMCPState {
  setIdle: () => void;
}

const WebMCPContext = createContext<WebMCPContextValue | null>(null);

const initialState: WebMCPState = {
  supported: false,
  status: "idle",
  activeTool: null,
  lastResult: null,
  error: null,
};

function deriveStateFromEvent(event: WebMCPInvocationEvent): Partial<WebMCPState> {
  if (event.status === "processing") {
    return {
      status: "processing",
      activeTool: event.toolName,
      error: null,
    };
  }

  if (event.status === "complete") {
    return {
      status: "complete",
      activeTool: event.toolName,
      lastResult: event.result,
      error: null,
    };
  }

  return {
    status: "error",
    activeTool: event.toolName,
    error: event.error ?? "Erro desconhecido na invocação de tool",
  };
}

export function WebMCPProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WebMCPState>(initialState);

  useEffect(() => {
    let mounted = true;

    const applyEvent = (event: WebMCPInvocationEvent) => {
      if (!mounted) {
        return;
      }

      setState((previous) => ({
        ...previous,
        ...deriveStateFromEvent(event),
      }));
    };

    void registerWebMCPTools(applyEvent).then((registration) => {
      if (!mounted) {
        return;
      }

      setState((previous) => ({
        ...previous,
        supported: registration.supported,
      }));
    });

    const listener = (event: ModelContextToolInvocationEvent) => {
      const detail = event.detail as WebMCPInvocationEvent;
      if (!detail) {
        return;
      }

      applyEvent(detail);
    };

    navigator.modelContext?.addEventListener?.("toolinvocation", listener);

    return () => {
      mounted = false;
      navigator.modelContext?.removeEventListener?.("toolinvocation", listener);
    };
  }, []);

  const value = useMemo<WebMCPContextValue>(
    () => ({
      ...state,
      setIdle: () => {
        setState((previous) => ({
          ...previous,
          status: "idle",
          activeTool: null,
          error: null,
        }));
      },
    }),
    [state],
  );

  return <WebMCPContext.Provider value={value}>{children}</WebMCPContext.Provider>;
}

export function useWebMCP() {
  const context = useContext(WebMCPContext);
  if (!context) {
    throw new Error("useWebMCP must be used inside WebMCPProvider");
  }

  return context;
}

export interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ModelContextToolInvocationDetail {
  toolName: string;
  input: unknown;
  status: "processing" | "complete" | "error";
  result?: unknown;
  error?: string;
}

export interface ModelContextToolInvocationEvent extends Event {
  detail: ModelContextToolInvocationDetail;
}

export interface ModelContext {
  registerTool(
    tool: ModelContextTool,
    handler?: (input: unknown) => Promise<unknown> | unknown,
  ): void | Promise<void>;
  executeTool?: (toolName: string, input?: unknown) => Promise<unknown>;
  addEventListener?: (
    type: "toolinvocation",
    listener: (event: ModelContextToolInvocationEvent) => void,
  ) => void;
  removeEventListener?: (
    type: "toolinvocation",
    listener: (event: ModelContextToolInvocationEvent) => void,
  ) => void;
  dispatchEvent?: (event: Event) => boolean;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

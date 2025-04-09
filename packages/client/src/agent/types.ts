import { Message, RunAgentInput, State } from "@agentwire/core";

export interface AgentConfig {
  agentId?: string;
  description?: string;
  threadId?: string;
  initialMessages?: Message[];
  initialState?: State;
}

export interface HttpAgentConfig extends AgentConfig {
  url: string;
  headers?: Record<string, string>;
}

export type RunAgentParameters = Partial<
  Pick<RunAgentInput, "runId" | "tools" | "context" | "forwardedProps">
>;

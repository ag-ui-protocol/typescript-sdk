import { withDefaultApplyEvents } from "@/apply/default";
import { Message, State, RunAgentInput, RunAgent, ApplyEvents } from "@agentwire/core";

import { AgentConfig, RunAgentParameters } from "./types";
import { v4 as uuidv4 } from "uuid";
import { structuredClone_ } from "@/utils";
import { catchError } from "rxjs/operators";
import { finalize } from "rxjs/operators";
import { throwError, pipe, Observable } from "rxjs";
import { verifyEvents } from "@/verify";
import { convertToLegacyEvents } from "@/legacy/convert";
import { LegacyRuntimeProtocolEvent } from "@/legacy/types";

export abstract class AbstractAgent {
  public runAgent(parameters?: RunAgentParameters) {
    this.agentId = this.agentId ?? uuidv4();
    const input = this.prepareRunAgentInput(parameters);

    const run = this.run(input);
    const apply = this.apply(input);

    return pipe(
      run,
      verifyEvents,
      apply,
      catchError((error) => {
        this.onError(error);
        return throwError(() => error);
      }),
      finalize(() => {
        this.onFinalize();
      }),
    );
  }

  public legacy_to_be_removed_runAgentBridged(
    config?: RunAgentParameters,
  ): Observable<LegacyRuntimeProtocolEvent> {
    this.agentId = this.agentId ?? uuidv4();
    const input = this.prepareRunAgentInput(config);

    const run = this.run(input);
    const convert = convertToLegacyEvents(this.threadId, input.runId, this.agentId);

    return new Observable<LegacyRuntimeProtocolEvent>((subscriber) => {
      const source$ = run();
      return source$.pipe(verifyEvents, convert).subscribe(subscriber);
    });
  }

  public abortRun() {}

  public agentId?: string;
  public description: string;
  public threadId: string;
  public messages: Message[];
  public state: State;

  constructor({ agentId, description, threadId, initialMessages, initialState }: AgentConfig = {}) {
    this.agentId = agentId;
    this.description = description ?? "";
    this.threadId = threadId ?? uuidv4();
    this.messages = structuredClone_(initialMessages ?? []);
    this.state = structuredClone_(initialState ?? {});
  }

  protected abstract run(input: RunAgentInput): RunAgent;

  protected apply(input: RunAgentInput): ApplyEvents {
    return withDefaultApplyEvents({
      messages: input.messages,
      state: input.state,
    });
  }

  protected prepareRunAgentInput(parameters?: RunAgentParameters): RunAgentInput {
    return {
      threadId: this.threadId,
      runId: parameters?.runId || uuidv4(),
      tools: structuredClone_(parameters?.tools ?? []),
      context: structuredClone_(parameters?.context ?? []),
      forwardedProps: structuredClone_(parameters?.forwardedProps ?? {}),
      state: structuredClone_(this.state),
      messages: structuredClone_(this.messages),
    };
  }

  protected onError(error: Error) {
    console.error("Agent execution failed:", error);
  }

  protected onFinalize() {}

  public clone() {
    const cloned = Object.create(Object.getPrototypeOf(this));

    for (const key of Object.getOwnPropertyNames(this)) {
      const value = (this as any)[key];
      if (typeof value !== "function") {
        cloned[key] = structuredClone_(value);
      }
    }

    return cloned;
  }
}

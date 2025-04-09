import { Observable } from "rxjs";
import { Message, State } from "./types";
import { BaseEvent } from "./events";

/**
 * Function type for agent runners that process input and return a stream of results.
 */
export type RunAgent = () => Observable<BaseEvent>;

/**
 * The transformed state of an agent.
 */
export interface AgentState {
  messages?: Message[];
  state?: State;
}

/**
 * Maps a stream of BaseEvent objects to a stream of AgentState objects.
 * @returns A function that transforms an Observable<BaseEvent> into an Observable<TransformedState>
 */
export type ApplyEvents = (events$: Observable<BaseEvent>) => Observable<AgentState>;

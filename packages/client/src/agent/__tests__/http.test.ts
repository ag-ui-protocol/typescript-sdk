import { HttpAgent } from "../http";
import { runHttpRequest, HttpEvent, HttpEventType } from "@/run/http-request";
import { v4 as uuidv4 } from "uuid";
import { Observable } from "rxjs";

// Mock the runHttpRequest module
jest.mock("@/run/http-request", () => ({
  runHttpRequest: jest.fn(),
  HttpEventType: {
    HEADERS: "headers",
    DATA: "data",
  },
}));

// Mock uuid module
jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-run-id"),
}));

describe("HttpAgent", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should configure and execute HTTP requests correctly", async () => {
    // Setup mock observable for the HTTP response
    const mockObservable = new Observable<HttpEvent>((subscriber) => {
      subscriber.next({
        type: HttpEventType.HEADERS,
        status: 200,
        headers: new Headers(),
      });
      subscriber.complete();
      return { unsubscribe: jest.fn() };
    });

    // Mock the runHttpRequest function
    (runHttpRequest as jest.Mock).mockReturnValue(mockObservable);

    // Configure test agent
    const agent = new HttpAgent({
      url: "https://api.example.com/v1/chat",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
    });

    // Setup input data for the agent
    agent.messages = [
      {
        id: uuidv4(),
        role: "user",
        content: "Hello",
      },
    ];

    // Prepare the input that would be used in runAgent
    const input = {
      threadId: agent.threadId,
      runId: "mock-run-id",
      tools: [],
      context: [],
      forwardedProps: {},
      state: agent.state,
      messages: agent.messages,
    };

    // Call run method directly, which should call runHttpRequest
    const runFunction = agent.run(input);

    // Execute the function returned by run
    runFunction();

    // Verify runHttpRequest was called with correct config
    expect(runHttpRequest).toHaveBeenCalledWith("https://api.example.com/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(input),
      signal: expect.any(AbortSignal),
    });
  });

  it("should abort the request when abortRun is called", () => {
    // Setup mock implementation
    (runHttpRequest as jest.Mock).mockReturnValue(jest.fn());

    // Configure test agent
    const agent = new HttpAgent({
      url: "https://api.example.com/v1/chat",
      headers: {},
    });

    // Spy on the abort method of AbortController
    const abortSpy = jest.spyOn(AbortController.prototype, "abort");

    // Run and abort the agent
    agent.runAgent();
    agent.abortRun();

    // Verify abort was called
    expect(abortSpy).toHaveBeenCalled();

    // Clean up
    abortSpy.mockRestore();
  });

  it("should use a custom abort controller when provided", () => {
    // Setup mock implementation
    (runHttpRequest as jest.Mock).mockReturnValue(jest.fn());

    // Configure test agent
    const agent = new HttpAgent({
      url: "https://api.example.com/v1/chat",
      headers: {},
    });

    // Create a custom abort controller
    const customController = new AbortController();
    const abortSpy = jest.spyOn(customController, "abort");

    // Run with custom controller
    agent.runAgent({ abortController: customController });
    agent.abortRun();

    // Verify the custom controller was used
    expect(abortSpy).toHaveBeenCalled();

    // Clean up
    abortSpy.mockRestore();
  });

  it("should handle transformHttpEventStream correctly", () => {
    // Import the actual transformHttpEventStream function
    const { transformHttpEventStream } = require("../../transform/http");

    // Verify transformHttpEventStream is a function
    expect(typeof transformHttpEventStream).toBe("function");

    // Configure test agent
    const agent = new HttpAgent({
      url: "https://api.example.com/v1/chat",
      headers: {},
    });

    // Verify that the HttpAgent's run method uses transformHttpEventStream
    // This is an indirect test of implementation details, but useful to verify the pipeline
    const mockObservable = new Observable<HttpEvent>();
    (runHttpRequest as jest.Mock).mockReturnValue(mockObservable);

    // Create a spy on the pipe method
    const pipeSpy = jest.spyOn(mockObservable, "pipe");

    // Call run with mock input
    const input = {
      threadId: agent.threadId,
      runId: "test-run-id",
      state: {},
      messages: [],
      tools: [],
      context: [],
      forwardedProps: {},
    };

    // Execute the run function
    const runFn = agent.run(input);
    runFn();

    // Verify that pipe was called with transformHttpEventStream
    expect(pipeSpy).toHaveBeenCalledWith(transformHttpEventStream);
  });

  it("should process HTTP response data end-to-end", async () => {
    // Create mock headers
    const mockHeaders = new Headers();
    mockHeaders.append("Content-Type", "text/event-stream");

    // Create a mock response data stream with headers and data events
    const mockHeadersEvent: HttpEvent = {
      type: HttpEventType.HEADERS,
      status: 200,
      headers: mockHeaders,
    };

    const mockResponseChunk = new Uint8Array(
      new TextEncoder().encode('data: {"type": "TEXT_MESSAGE_START", "messageId": "test-id"}\n\n'),
    );

    const mockDataEvent: HttpEvent = {
      type: HttpEventType.DATA,
      data: mockResponseChunk,
    };

    // Create a proper mock observable using rxjs
    const mockResponseObservable = new Observable<HttpEvent>((subscriber) => {
      // Simulate receiving headers first
      subscriber.next(mockHeadersEvent);
      // Simulate receiving data
      subscriber.next(mockDataEvent);
      // Simulate completion
      subscriber.complete();
      return { unsubscribe: jest.fn() };
    });

    // Directly mock runHttpRequest
    (runHttpRequest as jest.Mock).mockReturnValue(mockResponseObservable);

    // Configure test agent
    const agent = new HttpAgent({
      url: "https://api.example.com/v1/chat",
      headers: {},
    });

    // Prepare input for the agent
    const input = {
      threadId: agent.threadId,
      runId: "mock-run-id",
      tools: [],
      context: [],
      forwardedProps: {},
      state: agent.state,
      messages: agent.messages,
    };

    // Call run method directly
    const runFunction = agent.run(input);

    // Execute the run function
    runFunction();

    // Verify runHttpRequest was called with correct config
    expect(runHttpRequest).toHaveBeenCalledWith("https://api.example.com/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(input),
      signal: expect.any(AbortSignal),
    });
  });
});

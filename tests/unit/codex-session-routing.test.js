import { describe, it, expect, afterEach, vi } from "vitest";
import { CodexExecutor } from "../../open-sse/executors/codex.js";
import * as proxyFetchModule from "../../open-sse/utils/proxyFetch.js";

function makeInput(text = "hello") {
  return [{ type: "message", role: "user", content: [{ type: "input_text", text }] }];
}

describe("CodexExecutor session routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes the first compact request to the Codex compact endpoint", async () => {
    const urls = [];
    vi.spyOn(proxyFetchModule, "proxyAwareFetch").mockImplementation(async (url) => {
      urls.push(url);
      return new Response("{}", { status: 200 });
    });

    const executor = new CodexExecutor();
    await executor.execute({
      model: "gpt-5.3-codex",
      body: { _compact: true, input: makeInput("compact me") },
      stream: true,
      credentials: { accessToken: "test" },
    });

    expect(urls[0]).toBe("https://chatgpt.com/backend-api/codex/responses/compact");
  });

  it("does not leak compact routing into the next normal request", async () => {
    const urls = [];
    vi.spyOn(proxyFetchModule, "proxyAwareFetch").mockImplementation(async (url) => {
      urls.push(url);
      return new Response("{}", { status: 200 });
    });

    const executor = new CodexExecutor();
    await executor.execute({
      model: "gpt-5.3-codex",
      body: { _compact: true, input: makeInput("compact me") },
      stream: true,
      credentials: { accessToken: "test" },
    });
    await executor.execute({
      model: "gpt-5.3-codex",
      body: { input: makeInput("continue normally") },
      stream: true,
      credentials: { accessToken: "test" },
    });

    expect(urls).toEqual([
      "https://chatgpt.com/backend-api/codex/responses/compact",
      "https://chatgpt.com/backend-api/codex/responses",
    ]);
  });
});

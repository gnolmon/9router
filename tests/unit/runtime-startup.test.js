import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  ensureScheduler: vi.fn(),
  ensureBot: vi.fn(),
}));

vi.mock("@/shared/services/initializeApp.js", () => ({
  default: mocks.initializeApp,
}));

vi.mock("@/lib/apiKeys/telegramScheduler.js", () => ({
  ensureTelegramApiKeySchedulerStarted: mocks.ensureScheduler,
}));

vi.mock("@/lib/telegram/bot.js", () => ({
  ensureTelegramBotStarted: mocks.ensureBot,
}));

describe("server runtime startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete global.__serverRuntimeStartup;
    vi.resetModules();
    mocks.initializeApp.mockResolvedValue(undefined);
    mocks.ensureScheduler.mockResolvedValue(undefined);
    mocks.ensureBot.mockResolvedValue(undefined);
  });

  it("runs startup only once per process", async () => {
    const { ensureServerRuntimeStarted } = await import("../../src/lib/runtime/startup.js");

    await Promise.all([
      ensureServerRuntimeStarted(),
      ensureServerRuntimeStarted(),
      ensureServerRuntimeStarted(),
    ]);

    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(mocks.ensureScheduler).toHaveBeenCalledTimes(1);
    expect(mocks.ensureBot).toHaveBeenCalledTimes(1);
  });
});


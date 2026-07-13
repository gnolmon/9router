import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  ensureScheduler: vi.fn(),
  ensureBot: vi.fn(),
  isTelegramDisabled: vi.fn(),
  isTelegramBotDisabled: vi.fn(),
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

vi.mock("@/lib/telegram/config.js", () => ({
  isTelegramDisabled: mocks.isTelegramDisabled,
  isTelegramBotDisabled: mocks.isTelegramBotDisabled,
}));

describe("server runtime startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete global.__serverRuntimeStartup;
    vi.resetModules();
    mocks.initializeApp.mockResolvedValue(undefined);
    mocks.ensureScheduler.mockResolvedValue(undefined);
    mocks.ensureBot.mockResolvedValue(undefined);
    mocks.isTelegramDisabled.mockReturnValue(false);
    mocks.isTelegramBotDisabled.mockReturnValue(false);
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

  it("skips all Telegram runtime behavior when fully disabled", async () => {
    mocks.isTelegramDisabled.mockReturnValue(true);
    const { ensureServerRuntimeStarted } = await import("../../src/lib/runtime/startup.js");

    await ensureServerRuntimeStarted();

    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(mocks.ensureScheduler).not.toHaveBeenCalled();
    expect(mocks.ensureBot).not.toHaveBeenCalled();
  });

  it("keeps the scheduler active when only bot polling is disabled", async () => {
    mocks.isTelegramBotDisabled.mockReturnValue(true);
    const { ensureServerRuntimeStarted } = await import("../../src/lib/runtime/startup.js");

    await ensureServerRuntimeStarted();

    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(mocks.ensureScheduler).toHaveBeenCalledTimes(1);
    expect(mocks.ensureBot).not.toHaveBeenCalled();
  });
});

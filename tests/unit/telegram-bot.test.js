import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsertTelegramApiKey: vi.fn(),
  getConsistentMachineId: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  upsertTelegramApiKey: mocks.upsertTelegramApiKey,
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.getConsistentMachineId,
}));

const { __test__ } = await import("../../src/lib/telegram/bot.js");

describe("telegram bot helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConsistentMachineId.mockResolvedValue("machine-abc");
    mocks.upsertTelegramApiKey.mockResolvedValue({
      key: "sk-test",
      isActive: true,
    });
  });

  it("recognizes /key commands in private or group syntax", () => {
    expect(__test__.extractCommand("/key")).toBe("key");
    expect(__test__.extractCommand("/key@NineRouterBot")).toBe("key");
    expect(__test__.extractCommand("/start")).toBeNull();
  });

  it("asks user to set a username before key creation", async () => {
    const reply = await __test__.processKeyCommand({
      from: { id: 42, username: "" },
    });

    expect(reply).toContain("set a Telegram username");
    expect(mocks.upsertTelegramApiKey).not.toHaveBeenCalled();
  });

  it("creates or reuses a Telegram key for a user with username", async () => {
    const reply = await __test__.processKeyCommand({
      from: { id: 42, username: "alice" },
    });

    expect(mocks.getConsistentMachineId).toHaveBeenCalled();
    expect(mocks.upsertTelegramApiKey).toHaveBeenCalledWith({
      telegramUserId: "42",
      username: "alice",
      machineId: "machine-abc",
    });
    expect(reply).toContain("@alice");
    expect(reply).toContain("sk-test");
    expect(reply).toContain("ACTIVE");
  });
});


import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildTelegramReport: vi.fn(),
  getConsistentMachineId: vi.fn(),
  upsertTelegramApiKey: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  upsertTelegramApiKey: mocks.upsertTelegramApiKey,
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.getConsistentMachineId,
}));

vi.mock("@/lib/telegram/report.js", () => ({
  buildTelegramReport: mocks.buildTelegramReport,
}));

async function loadBotModule() {
  return import("../../src/lib/telegram/bot.js");
}

describe("telegram bot helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
    delete global.__telegramBotRuntime;
    mocks.getConsistentMachineId.mockResolvedValue("machine-abc");
    mocks.upsertTelegramApiKey.mockResolvedValue({
      key: "sk-test",
      isActive: true,
    });
    mocks.buildTelegramReport.mockResolvedValue("report body");
  });

  it("recognizes /key, /report, and /report7 commands", async () => {
    const { __test__ } = await loadBotModule();

    expect(__test__.extractCommand("/key")).toBe("key");
    expect(__test__.extractCommand("/key@NineRouterBot")).toBe("key");
    expect(__test__.extractCommand("/report")).toBe("report");
    expect(__test__.extractCommand("/report@NineRouterBot")).toBe("report");
    expect(__test__.extractCommand("/report7")).toBe("report7");
    expect(__test__.extractCommand("/start")).toBeNull();
  });

  it("asks user to set a username before key creation", async () => {
    const { __test__ } = await loadBotModule();
    const reply = await __test__.processKeyCommand({
      from: { id: 42, username: "" },
    });

    expect(reply).toContain("set a Telegram username");
    expect(mocks.upsertTelegramApiKey).not.toHaveBeenCalled();
  });

  it("creates or reuses a Telegram key for a user with username", async () => {
    const { __test__ } = await loadBotModule();
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

  it("builds report commands without requiring username", async () => {
    const { __test__ } = await loadBotModule();

    await expect(__test__.processReportCommand("today", {
      from: { id: 42, username: "" },
    })).resolves.toBe("report body");
    await expect(__test__.processReportCommand("7d", {
      from: { id: 42 },
    })).resolves.toBe("report body");

    expect(mocks.buildTelegramReport).toHaveBeenNthCalledWith(1, "today");
    expect(mocks.buildTelegramReport).toHaveBeenNthCalledWith(2, "7d");
  });

  it("syncs Telegram command metadata only once per process", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { __test__ } = await loadBotModule();
    await __test__.syncTelegramCommands();
    await __test__.syncTelegramCommands();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/setMyCommands");
    expect(fetchMock.mock.calls[1][0]).toContain("/setChatMenuButton");
  });

  it("does not fail bot startup when Telegram command sync fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, description: "boom" }),
    }));

    const { __test__ } = await loadBotModule();
    await expect(__test__.syncTelegramCommands()).resolves.toBeUndefined();
  });

  it("sends report replies using HTML parse mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { __test__ } = await loadBotModule();
    await __test__.sendHtmlMessage(123, "<b>Quota Remaining Today</b>: 56%", 456);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.parse_mode).toBe("HTML");
    expect(body.text).toContain("<b>Quota Remaining Today</b>");
  });
});

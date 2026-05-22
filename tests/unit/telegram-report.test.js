import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchUsageForConnection: vi.fn(),
  getProviderConnections: vi.fn(),
  getTelegramUsageShareSummary: vi.fn(),
  isUsageEligibleConnection: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getTelegramUsageShareSummary: mocks.getTelegramUsageShareSummary,
}));

vi.mock("@/lib/usage/connectionUsage.js", () => ({
  fetchUsageForConnection: mocks.fetchUsageForConnection,
  isUsageEligibleConnection: mocks.isUsageEligibleConnection,
}));

async function loadReportModule() {
  return import("../../src/lib/telegram/report.js");
}

describe("telegram report builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete global.__telegramReportRuntime;

    mocks.isUsageEligibleConnection.mockReturnValue(true);
    mocks.getProviderConnections.mockResolvedValue([
      { id: "c1", provider: "github", name: "alice@example.com", authType: "oauth", isActive: true },
      { id: "c2", provider: "codex", name: "Workspace A", authType: "oauth", isActive: true },
      { id: "c3", provider: "claude", name: "Workspace B", authType: "oauth", isActive: true },
    ]);
    mocks.fetchUsageForConnection
      .mockResolvedValueOnce({
        quotas: {
          chat: { used: 95, total: 100, resetAt: "2026-05-23T00:00:00.000Z" },
        },
      })
      .mockResolvedValueOnce({
        quotas: {
          chat: { used: 50, total: 100, resetAt: "2026-05-24T00:00:00.000Z" },
        },
      })
      .mockRejectedValueOnce(new Error("provider down"));

    mocks.getTelegramUsageShareSummary.mockResolvedValue({
      period: "Today",
      windowStartLabel: "2026-05-22 00:00:00 Asia/Ho_Chi_Minh",
      windowEndLabel: "2026-05-22 09:30:00 Asia/Ho_Chi_Minh",
      totalTelegramKeys: 12,
      keysWithUsage: 11,
      totalRequests: 42,
      totalTokens: 1000,
      items: Array.from({ length: 11 }, (_, index) => ({
        name: `user${index + 1}`,
        telegramUserId: String(index + 1),
        totalTokens: index === 0 ? 300 : 70,
        share: index === 0 ? 0.3 : 0.07,
      })),
    });
  });

  it("builds a plain-text report with quota and usage sections", async () => {
    const { buildTelegramReport } = await loadReportModule();
    const report = await buildTelegramReport("today", new Date("2026-05-22T02:30:00.000Z"));

    expect(report).toContain("9Router report Today");
    expect(report).toContain("Quota now");
    expect(report).toContain("Tracked: 3 active connections");
    expect(report).toContain("Status: 1 ok | 0 low | 1 depleted | 1 unavailable");
    expect(report).toContain("- github / alice@example.com: 5%");
    expect(report).toContain("Telegram key usage (Today)");
    expect(report).toContain("- @user1: 30.0% (300 tokens)");
    expect(report).toContain("- Others: 7.0% (70 tokens)");
  });

  it("coalesces concurrent quota snapshot fetches", async () => {
    let resolveFetch;
    mocks.fetchUsageForConnection.mockReset();
    mocks.getProviderConnections.mockResolvedValue([
      { id: "c1", provider: "github", name: "alice@example.com", authType: "oauth", isActive: true },
    ]);
    mocks.fetchUsageForConnection.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const { buildTelegramReport } = await loadReportModule();
    const promiseA = buildTelegramReport("today", new Date("2026-05-22T02:30:00.000Z"));
    const promiseB = buildTelegramReport("7d", new Date("2026-05-22T02:30:00.000Z"));

    await Promise.resolve();
    await Promise.resolve();

    resolveFetch({
      quotas: {
        chat: { used: 25, total: 100, resetAt: "2026-05-23T00:00:00.000Z" },
      },
    });

    await Promise.all([promiseA, promiseB]);

    expect(mocks.fetchUsageForConnection).toHaveBeenCalledTimes(1);
    expect(mocks.getTelegramUsageShareSummary).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from "vitest";
import { __test__ } from "@/lib/telegram/usageLimits.js";

describe("Telegram usage limits", () => {
  it("raises today's hard limit after manual clear so the next request is not disabled immediately", () => {
    const totals = { totalCost: 710, totalTokens: 310_000_000 };
    expect(__test__.isHardLimitReached(totals, __test__.getEffectiveHardLimits())).toBe(true);

    const hardLimits = __test__.getEffectiveHardLimits({
      hardCostUsd: totals.totalCost + __test__.MANUAL_CLEAR_EXTRA_COST_USD,
      hardTokens: totals.totalTokens + __test__.MANUAL_CLEAR_EXTRA_TOKENS,
    });

    expect(__test__.isHardLimitReached(totals, hardLimits)).toBe(false);
    expect(__test__.isHardLimitReached({
      totalCost: hardLimits.hardCostUsd,
      totalTokens: totals.totalTokens,
    }, hardLimits)).toBe(true);
  });
});

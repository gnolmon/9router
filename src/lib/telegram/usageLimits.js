import { getAdapter } from "@/lib/db/driver.js";
import { stringifyJson } from "@/lib/db/helpers/jsonCol.js";
import { getApiKeyByKey, updateApiKey } from "@/lib/db/repos/apiKeysRepo.js";
import {
  API_KEY_SOURCES,
  VIETNAM_TIMEZONE,
  formatVietnamDateTime,
  getNextVietnamBusinessStartAfter,
  getVietnamDateKey,
  getVietnamStartOfDay,
} from "@/lib/apiKeys/schedule.js";
import { TELEGRAM_API_BASE_URL } from "./config.js";

const WARNING_COST_USD = 400;
const WARNING_TOKENS = 180_000_000;
const HARD_COST_USD = 700;
const HARD_TOKENS = 300_000_000;
const KV_SCOPE = "telegramUsageLimits";

function formatUsd(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatTokens(value) {
  return `${Number(value || 0).toLocaleString("en-US")} token`;
}

async function sendTelegramMessage(chatId, text) {
  const response = await fetch(`${TELEGRAM_API_BASE_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`sendMessage HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.description || "sendMessage failed");
}

function claimOnce(db, key, value) {
  const result = db.run(
    `INSERT OR IGNORE INTO kv(scope, key, value) VALUES(?, ?, ?)`,
    [KV_SCOPE, key, stringifyJson(value)]
  );
  return (result?.changes ?? 0) > 0;
}

function buildWarningMessage(apiKey, totals) {
  return [
    "Cảnh báo sử dụng nhanh.",
    `API key: ${apiKey.name || apiKey.telegramUserId || "unknown"}`,
    `Hôm nay bạn đã dùng ${formatTokens(totals.totalTokens)} (${formatUsd(totals.totalCost)}).`,
    "Bạn đang burn quá nhanh, hãy kiểm soát lượng token sử dụng.",
    `Soft limit tạm ngắt: ${formatUsd(HARD_COST_USD)} hoặc ${formatTokens(HARD_TOKENS)} trong ngày.`,
  ].join("\n");
}

function buildHardLimitMessage(apiKey, totals, disabledUntil) {
  return [
    "API key của bạn đã tạm bị vô hiệu hóa.",
    `API key: ${apiKey.name || apiKey.telegramUserId || "unknown"}`,
    `Lý do: hôm nay đã đạt ${formatTokens(totals.totalTokens)} (${formatUsd(totals.totalCost)}).`,
    "Hệ thống đã tạm chuyển key sang inactive để bảo vệ quota.",
    `Key sẽ tự mở lại lúc 08:00 ngày làm việc tiếp theo (${VIETNAM_TIMEZONE}).`,
    `Mốc mở lại: ${formatVietnamDateTime(disabledUntil)}`,
  ].join("\n");
}

function getDailyTotals(db, apiKey, now) {
  const start = getVietnamStartOfDay(now, 0);
  const row = db.get(
    `SELECT
       COALESCE(SUM(promptTokens + completionTokens), 0) AS totalTokens,
       COALESCE(SUM(cost), 0) AS totalCost
     FROM usageHistory
     WHERE apiKey = ? AND timestamp >= ? AND timestamp <= ?`,
    [apiKey, start.toISOString(), now.toISOString()]
  ) || {};
  return {
    totalTokens: Number(row.totalTokens || 0),
    totalCost: Number(row.totalCost || 0),
  };
}

export async function enforceTelegramDailyUsageLimits(entry) {
  const rawApiKey = typeof entry?.apiKey === "string" ? entry.apiKey : "";
  if (!rawApiKey) return null;

  const apiKey = await getApiKeyByKey(rawApiKey);
  if (
    !apiKey ||
    apiKey.source !== API_KEY_SOURCES.TELEGRAM ||
    !apiKey.telegramUserId
  ) {
    return null;
  }

  const now = entry?.timestamp ? new Date(entry.timestamp) : new Date();
  const db = await getAdapter();
  const totals = getDailyTotals(db, rawApiKey, now);
  const dateKey = getVietnamDateKey(now);

  const hardLimitReached =
    totals.totalCost >= HARD_COST_USD ||
    totals.totalTokens >= HARD_TOKENS;
  const warningReached =
    totals.totalCost >= WARNING_COST_USD ||
    totals.totalTokens >= WARNING_TOKENS;

  if (hardLimitReached) {
    const disabledUntil = getNextVietnamBusinessStartAfter(now);
    await updateApiKey(apiKey.id, {
      temporaryDisabledUntil: disabledUntil.toISOString(),
      now,
    });

    const markerKey = `${dateKey}|${apiKey.id}|hard`;
    if (claimOnce(db, markerKey, { at: now.toISOString(), totals })) {
      await sendTelegramMessage(
        apiKey.telegramUserId,
        buildHardLimitMessage(apiKey, totals, disabledUntil)
      );
    }
    return { action: "hard", apiKeyId: apiKey.id, totals };
  }

  if (warningReached) {
    const markerKey = `${dateKey}|${apiKey.id}|warning`;
    if (claimOnce(db, markerKey, { at: now.toISOString(), totals })) {
      await sendTelegramMessage(
        apiKey.telegramUserId,
        buildWarningMessage(apiKey, totals)
      );
    }
    return { action: "warning", apiKeyId: apiKey.id, totals };
  }

  return { action: "none", apiKeyId: apiKey.id, totals };
}

export const __test__ = {
  WARNING_COST_USD,
  WARNING_TOKENS,
  HARD_COST_USD,
  HARD_TOKENS,
  buildWarningMessage,
  buildHardLimitMessage,
};

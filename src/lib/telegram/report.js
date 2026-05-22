import { getProviderConnections, getTelegramUsageShareSummary } from "@/lib/localDb";
import { fetchUsageForConnection, isUsageEligibleConnection } from "@/lib/usage/connectionUsage.js";
import {
  formatResetTime,
  getRemainingPercentage,
  parseQuotaData,
} from "@/lib/usage/quotaUtils.js";

const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;
const QUOTA_LOW_THRESHOLD = 30;
const QUOTA_DEPLETED_THRESHOLD = 5;
const TOP_LOW_QUOTAS_LIMIT = 5;

const g = global.__telegramReportRuntime ??= {
  quotaSnapshot: null,
  quotaSnapshotExpiresAt: 0,
  quotaSnapshotPromise: null,
};

function formatInteger(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatSharePercentage(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "0$";

  const precision = amount >= 100 ? 0 : amount >= 1 ? 2 : 4;
  const formatted = amount.toFixed(precision).replace(/\.?0+$/, "");
  return `${formatted}$`;
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getConnectionLabel(connection) {
  if (isEmail(connection.email)) return connection.email;
  if (isEmail(connection.name)) return connection.name;
  if (typeof connection.name === "string" && connection.name.trim()) return connection.name.trim();
  return connection.id?.slice(0, 8) || "unknown";
}

function getQuotaStatus(remaining) {
  if (remaining <= QUOTA_DEPLETED_THRESHOLD) return "depleted";
  if (remaining < QUOTA_LOW_THRESHOLD) return "low";
  return "ok";
}

function summarizeQuotaConnection(connection, data, error = null) {
  if (error) {
    return {
      connectionId: connection.id,
      provider: connection.provider,
      label: `${connection.provider} / ${getConnectionLabel(connection)}`,
      status: "unavailable",
      remaining: null,
      quotaName: null,
      resetAt: null,
      resetIn: "-",
      message: error.message || "Failed to fetch quota",
    };
  }

  const quotas = parseQuotaData(connection.provider, data)
    .map((quota) => ({
      ...quota,
      remaining: getRemainingPercentage(quota),
    }))
    .filter((quota) => Number.isFinite(quota.remaining));

  if (!quotas.length) {
    return {
      connectionId: connection.id,
      provider: connection.provider,
      label: `${connection.provider} / ${getConnectionLabel(connection)}`,
      status: "unavailable",
      remaining: null,
      quotaName: null,
      resetAt: null,
      resetIn: "-",
      message: data?.message || "No quota data",
    };
  }

  const lowestQuota = [...quotas].sort((a, b) => (
    a.remaining - b.remaining ||
    String(a.name || "").localeCompare(String(b.name || ""))
  ))[0];

  return {
    connectionId: connection.id,
    provider: connection.provider,
    label: `${connection.provider} / ${getConnectionLabel(connection)}`,
    status: getQuotaStatus(lowestQuota.remaining),
    remaining: lowestQuota.remaining,
    quotaName: lowestQuota.name || "quota",
    resetAt: lowestQuota.resetAt || null,
    resetIn: formatResetTime(lowestQuota.resetAt),
    message: data?.message || null,
  };
}

async function loadQuotaSnapshot(now = new Date()) {
  const connections = (await getProviderConnections())
    .filter((connection) => (connection.isActive ?? true) && isUsageEligibleConnection(connection));

  const results = await Promise.all(connections.map(async (connection) => {
    try {
      const usage = await fetchUsageForConnection(connection);
      return summarizeQuotaConnection(connection, usage);
    } catch (error) {
      return summarizeQuotaConnection(connection, null, error);
    }
  }));

  const counts = { ok: 0, low: 0, depleted: 0, unavailable: 0 };
  for (const result of results) {
    counts[result.status] += 1;
  }

  const lowest = results
    .filter((result) => Number.isFinite(result.remaining))
    .sort((a, b) => (
      a.remaining - b.remaining ||
      String(a.label).localeCompare(String(b.label))
    ))
    .slice(0, TOP_LOW_QUOTAS_LIMIT);

  return {
    totalTracked: connections.length,
    counts,
    lowest,
  };
}

async function getQuotaSnapshot(now = new Date()) {
  const currentTs = Date.now();
  if (g.quotaSnapshot && currentTs < g.quotaSnapshotExpiresAt) {
    return g.quotaSnapshot;
  }

  if (g.quotaSnapshotPromise) {
    return g.quotaSnapshotPromise;
  }

  g.quotaSnapshotPromise = loadQuotaSnapshot(now)
    .then((snapshot) => {
      g.quotaSnapshot = snapshot;
      g.quotaSnapshotExpiresAt = Date.now() + QUOTA_CACHE_TTL_MS;
      return snapshot;
    })
    .finally(() => {
      g.quotaSnapshotPromise = null;
    });

  return g.quotaSnapshotPromise;
}

function buildQuotaLine(snapshot) {
  if (!snapshot.lowest.length) {
    return "<b>Quota now</b>: unavailable";
  }

  if (snapshot.lowest.length === 1) {
    const item = snapshot.lowest[0];
    return `<b>Quota now</b>: ${item.remaining}% (${escapeHtml(item.quotaName)}, reset ${escapeHtml(item.resetIn)})`;
  }

  return [
    "<b>Quota now</b>:",
    ...snapshot.lowest.map((item) => `- ${escapeHtml(item.label)}: ${item.remaining}% (${escapeHtml(item.quotaName)}, reset ${escapeHtml(item.resetIn)})`),
  ].join("\n");
}

function buildUsageLines(summary) {
  const lines = [`<b>Key usage (${escapeHtml(summary.period)})</b>:`];

  if (!summary.items.length) {
    lines.push("No Telegram-key usage.");
    return lines;
  }

  for (const item of summary.items) {
    const name = escapeHtml(item.name || item.telegramUserId || "unknown");
    lines.push(`${name}: ${formatInteger(item.totalTokens)} tokens - ${formatSharePercentage(item.share)} - ${formatUsd(item.cost)}`);
  }

  return lines;
}

export async function buildTelegramReport(period = "today", now = new Date()) {
  const [quotaSnapshot, usageSummary] = await Promise.all([
    getQuotaSnapshot(now),
    getTelegramUsageShareSummary(period, now),
  ]);

  return [
    buildQuotaLine(quotaSnapshot),
    "",
    ...buildUsageLines(usageSummary),
  ].join("\n");
}

export const __test__ = {
  QUOTA_CACHE_TTL_MS,
  TOP_LOW_QUOTAS_LIMIT,
  buildQuotaLine,
  buildUsageLines,
  escapeHtml,
  formatSharePercentage,
  formatUsd,
  getQuotaStatus,
  getQuotaSnapshot,
  resetQuotaCache() {
    g.quotaSnapshot = null;
    g.quotaSnapshotExpiresAt = 0;
    g.quotaSnapshotPromise = null;
  },
  summarizeQuotaConnection,
};

import { makeKv } from "@/lib/db/helpers/kvStore.js";
import { upsertTelegramApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { VIETNAM_TIMEZONE } from "@/lib/apiKeys/schedule.js";
import { TELEGRAM_API_BASE_URL, getTelegramPollTimeoutSeconds } from "./config.js";
import { buildTelegramReport } from "./report.js";

const TELEGRAM_COMMANDS = [
  { command: "key", description: "Get or reuse your 9Router API key" },
  { command: "report", description: "Current quota + Telegram usage today" },
  { command: "report7", description: "Current quota + Telegram usage 7D" },
];
const COMMAND_PATTERNS = [
  ["key", /^\/key(?:@\w+)?(?:\s|$)/i],
  ["report7", /^\/report7(?:@\w+)?(?:\s|$)/i],
  ["report", /^\/report(?:@\w+)?(?:\s|$)/i],
];
const botKv = makeKv("telegramBot");

const g = global.__telegramBotRuntime ??= {
  commandsSynced: false,
  commandsSyncPromise: null,
  started: false,
  startPromise: null,
  pollTimer: null,
  polling: false,
};

function scheduleNextPoll(delayMs = 0) {
  if (g.pollTimer) clearTimeout(g.pollTimer);
  g.pollTimer = setTimeout(() => {
    pollUpdates().catch((error) => {
      console.log(`[Telegram] Poll crash: ${error.message}`);
      scheduleNextPoll(5000);
    });
  }, delayMs);
  if (g.pollTimer.unref) g.pollTimer.unref();
}

async function callTelegram(method, body, timeoutMs) {
  const response = await fetch(`${TELEGRAM_API_BASE_URL}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${method} HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.description || `${method} failed`);
  }
  return payload;
}

async function syncTelegramCommands() {
  if (g.commandsSynced) return;
  if (g.commandsSyncPromise) return g.commandsSyncPromise;

  g.commandsSyncPromise = (async () => {
    try {
      await callTelegram("setMyCommands", {
        commands: TELEGRAM_COMMANDS,
      }, 15000);
      await callTelegram("setChatMenuButton", {
        menu_button: { type: "commands" },
      }, 15000);
      g.commandsSynced = true;
      console.log("[Telegram] Command menu synced");
    } catch (error) {
      console.log(`[Telegram] Command sync failed: ${error.message}`);
    }
  })();

  return g.commandsSyncPromise;
}

function buildKeyReply(apiKey, username) {
  const lines = [
    `9Router API key for @${username}:`,
    apiKey.key,
    "",
    `Status: ${apiKey.isActive ? "ACTIVE" : "DISABLED"}`,
    `Hours: 08:00-18:30 ${VIETNAM_TIMEZONE}`,
  ];
  if (!apiKey.isActive) {
    lines.push(`This key will activate again at 08:00 ${VIETNAM_TIMEZONE}.`);
  }
  lines.push("You can pause or delete this key later from the dashboard.");
  return lines.join("\n");
}

async function sendMessage(chatId, text, replyToMessageId) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_to_message_id: replyToMessageId,
    allow_sending_without_reply: true,
  }, 15000);
}

function extractCommand(text) {
  if (typeof text !== "string") return null;
  const normalized = text.trim();
  for (const [command, pattern] of COMMAND_PATTERNS) {
    if (pattern.test(normalized)) return command;
  }
  return null;
}

async function processKeyCommand(message) {
  const user = message?.from;
  if (!user?.id) return null;

  const username = String(user.username || "").trim();
  if (!username) {
    return "Please set a Telegram username first, then send /key again.";
  }

  const machineId = await getConsistentMachineId();
  const apiKey = await upsertTelegramApiKey({
    telegramUserId: String(user.id),
    username,
    machineId,
  });
  return buildKeyReply(apiKey, username);
}

async function processReportCommand(period, message) {
  if (!message?.from?.id) return null;
  return buildTelegramReport(period);
}

async function processCommand(command, message) {
  switch (command) {
    case "key":
      return processKeyCommand(message);
    case "report":
      return processReportCommand("today", message);
    case "report7":
      return processReportCommand("7d", message);
    default:
      return null;
  }
}

async function handleUpdate(update) {
  const message = update?.message;
  const chatId = message?.chat?.id;
  if (!message || !chatId) return;

  const command = extractCommand(message.text);
  if (!command) return;

  const reply = await processCommand(command, message);
  if (!reply) return;

  try {
    await sendMessage(chatId, reply, message.message_id);
  } catch (error) {
    console.log(`[Telegram] sendMessage failed: ${error.message}`);
  }
}

async function pollUpdates() {
  if (g.polling) return;
  g.polling = true;
  let nextDelayMs = 0;

  try {
    const timeoutSeconds = getTelegramPollTimeoutSeconds();
    const offset = Number(await botKv.get("lastUpdateId", 0)) || 0;
    const payload = await callTelegram("getUpdates", {
      offset,
      timeout: timeoutSeconds,
      allowed_updates: ["message"],
    }, (timeoutSeconds + 10) * 1000);

    const updates = Array.isArray(payload?.result) ? payload.result : [];
    let nextOffset = offset;

    for (const update of updates) {
      const updateId = Number(update?.update_id) || 0;
      if (updateId > 0) nextOffset = Math.max(nextOffset, updateId + 1);
      try {
        await handleUpdate(update);
      } catch (error) {
        console.log(`[Telegram] update ${updateId || "unknown"} failed: ${error.message}`);
      }
    }

    if (nextOffset !== offset) {
      await botKv.set("lastUpdateId", nextOffset);
    }
  } catch (error) {
    nextDelayMs = 5000;
    console.log(`[Telegram] Poll failed: ${error.message}`);
  } finally {
    g.polling = false;
    scheduleNextPoll(nextDelayMs);
  }
}

export async function ensureTelegramBotStarted() {
  if (g.startPromise) return g.startPromise;
  g.startPromise = (async () => {
    if (g.started) return;
    g.started = true;
    await syncTelegramCommands();
    console.log("[Telegram] Bot polling started");
    scheduleNextPoll(0);
  })().catch((error) => {
    g.started = false;
    g.startPromise = null;
    throw error;
  });
  return g.startPromise;
}

export const __test__ = {
  buildKeyReply,
  extractCommand,
  processCommand,
  processKeyCommand,
  processReportCommand,
  syncTelegramCommands,
};

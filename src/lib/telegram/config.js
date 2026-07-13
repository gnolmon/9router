const DEFAULT_TELEGRAM_BOT_TOKEN = "8451289220:AAF-eK9yvHg3GCJjGnzSwREPPl2iTUermyc";

export const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN_OVERRIDE ||
  DEFAULT_TELEGRAM_BOT_TOKEN;
export const TELEGRAM_API_BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export function isTelegramBotDisabled() {
  return process.env.TELEGRAM_BOT_DISABLED === "1" || isTelegramDisabled();
}

export function isTelegramDisabled() {
  return process.env.TELEGRAM_DISABLED === "1";
}

export function getTelegramPollTimeoutSeconds() {
  const parsed = Number.parseInt(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS || "25", 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 50);
}

const g = global.__serverRuntimeStartup ??= {
  promise: null,
};

export async function ensureServerRuntimeStarted() {
  if (g.promise) return g.promise;
  g.promise = (async () => {
    const [
      { default: initializeApp },
      { ensureTelegramApiKeySchedulerStarted },
      { ensureTelegramBotStarted },
      { isTelegramDisabled, isTelegramBotDisabled },
    ] = await Promise.all([
      import("@/shared/services/initializeApp.js"),
      import("@/lib/apiKeys/telegramScheduler.js"),
      import("@/lib/telegram/bot.js"),
      import("@/lib/telegram/config.js"),
    ]);
    await initializeApp();
    if (isTelegramDisabled()) {
      console.log("[Telegram] Disabled by TELEGRAM_DISABLED");
      return;
    }
    await ensureTelegramApiKeySchedulerStarted();
    if (isTelegramBotDisabled()) {
      console.log("[Telegram] Bot polling disabled by TELEGRAM_BOT_DISABLED");
    } else {
      await ensureTelegramBotStarted();
    }
  })().catch((error) => {
    console.log(`[Runtime] Startup failed: ${error.message}`);
    g.promise = null;
    throw error;
  });
  return g.promise;
}

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
    ] = await Promise.all([
      import("@/shared/services/initializeApp.js"),
      import("@/lib/apiKeys/telegramScheduler.js"),
      import("@/lib/telegram/bot.js"),
    ]);
    await initializeApp();
    await ensureTelegramApiKeySchedulerStarted();
    await ensureTelegramBotStarted();
  })().catch((error) => {
    console.log(`[Runtime] Startup failed: ${error.message}`);
    g.promise = null;
    throw error;
  });
  return g.promise;
}

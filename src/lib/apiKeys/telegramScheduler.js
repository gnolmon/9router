import { reconcileTelegramApiKeySchedule } from "@/lib/localDb";
import { getNextVietnamScheduleTransition } from "./schedule.js";

const g = global.__telegramApiKeyScheduler ??= {
  started: false,
  startPromise: null,
  timer: null,
};

async function reconcile(reason) {
  try {
    const result = await reconcileTelegramApiKeySchedule();
    if (reason === "startup" || result.total > 0 || result.updated > 0) {
      console.log(`[TelegramKeys] Reconcile (${reason}): ${result.updated}/${result.total} changed`);
    }
  } catch (error) {
    console.log(`[TelegramKeys] Reconcile failed (${reason}): ${error.message}`);
  }
}

function scheduleNextRun() {
  const nextRunAt = getNextVietnamScheduleTransition(new Date());
  const delayMs = Math.max(nextRunAt.getTime() - Date.now(), 1000);
  if (g.timer) clearTimeout(g.timer);
  g.timer = setTimeout(async () => {
    await reconcile("timer");
    scheduleNextRun();
  }, delayMs);
  if (g.timer.unref) g.timer.unref();
}

export async function ensureTelegramApiKeySchedulerStarted() {
  if (g.startPromise) return g.startPromise;
  g.startPromise = (async () => {
    if (g.started) return;
    g.started = true;
    console.log("[TelegramKeys] Scheduler started");
    await reconcile("startup");
    scheduleNextRun();
  })().catch((error) => {
    g.started = false;
    g.startPromise = null;
    throw error;
  });
  return g.startPromise;
}


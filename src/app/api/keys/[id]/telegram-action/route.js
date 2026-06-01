import { NextResponse } from "next/server";
import { getApiKeyById } from "@/lib/localDb";
import {
  clearTemporaryDisableTelegramApiKey,
  sendManualTelegramUsageWarning,
  temporaryDisableTelegramApiKey,
} from "@/lib/telegram/usageLimits.js";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const key = await getApiKeyById(id);

    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    if (key.source !== "telegram" || !key.telegramUserId) {
      return NextResponse.json({ error: "Telegram API key required" }, { status: 400 });
    }

    if (action === "warning") {
      await sendManualTelegramUsageWarning(key);
      return NextResponse.json({ ok: true, action, key });
    }
    if (action === "temporary-disable") {
      const result = await temporaryDisableTelegramApiKey(key);
      return NextResponse.json({
        ok: true,
        action,
        disabledUntil: result.disabledUntil,
        key: result.key,
      });
    }
    if (action === "clear-temporary-disable") {
      const result = await clearTemporaryDisableTelegramApiKey(key);
      return NextResponse.json({
        ok: true,
        action,
        limitOverride: result.limitOverride,
        key: result.key,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.log("[TelegramAction] Failed:", error.message);
    return NextResponse.json({ error: "Failed to run Telegram action" }, { status: 500 });
  }
}

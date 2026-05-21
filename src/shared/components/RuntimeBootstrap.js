"use client";

import { useEffect } from "react";

export function RuntimeBootstrap() {
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch("/api/init", {
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {
      // Best effort only. Runtime startup failures are logged server-side.
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return null;
}

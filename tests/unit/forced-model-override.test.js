import { describe, expect, it } from "vitest";
import { API_KEY_SOURCES } from "@/lib/apiKeys/schedule.js";
import { getForcedModelOverride } from "@/sse/services/auth.js";

describe("getForcedModelOverride", () => {
  it("ignores per-key forced models for image generation requests", () => {
    const apiKeyRecord = {
      source: API_KEY_SOURCES.MANUAL,
      forcedModel: "cx/gpt-5.6-sol",
    };

    expect(
      getForcedModelOverride(apiKeyRecord, null, { serviceKind: "image" }),
    ).toBeNull();
    expect(getForcedModelOverride(apiKeyRecord)).toBe("cx/gpt-5.6-sol");
  });

  it("upgrades telegram spark keys to cx/gpt-5.4 when the request contains images", () => {
    const override = getForcedModelOverride(
      {
        source: API_KEY_SOURCES.TELEGRAM,
        forcedModel: "cx/gpt-5.3-codex-spark",
      },
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "describe this" },
              { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
            ],
          },
        ],
      },
    );

    expect(override).toBe("cx/gpt-5.4");
  });

  it("keeps telegram spark keys on cx/gpt-5.3-codex-spark when there is no image", () => {
    const override = getForcedModelOverride(
      {
        source: API_KEY_SOURCES.TELEGRAM,
        forcedModel: "cx/gpt-5.3-codex-spark",
      },
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "hello" }],
          },
        ],
      },
    );

    expect(override).toBe("cx/gpt-5.3-codex-spark");
  });

  it("does not auto-upgrade manual spark keys even if the request contains images", () => {
    const override = getForcedModelOverride(
      {
        source: API_KEY_SOURCES.MANUAL,
        forcedModel: "cx/gpt-5.3-codex-spark",
      },
      {
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "describe this" },
              { type: "input_image", image_url: "https://example.com/image.png" },
            ],
          },
        ],
      },
    );

    expect(override).toBe("cx/gpt-5.3-codex-spark");
  });
});

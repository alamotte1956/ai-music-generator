import { describe, expect, it } from "vitest";
import { extractAssistantText } from "./_core/llm";

describe("extractAssistantText", () => {
  it("returns trimmed string content", () => {
    expect(extractAssistantText("  [Verse 1]\nHello  ")).toBe("[Verse 1]\nHello");
  });

  it("joins text blocks and skips non-text parts", () => {
    expect(
      extractAssistantText([
        { type: "thinking", text: "hidden" },
        { type: "text", text: "[Chorus]" },
        { type: "text", text: "We stay" },
      ])
    ).toBe("[Chorus]\nWe stay");
  });

  it("returns an empty string for missing content", () => {
    expect(extractAssistantText(null)).toBe("");
    expect(extractAssistantText(undefined)).toBe("");
    expect(extractAssistantText([])).toBe("");
  });
});

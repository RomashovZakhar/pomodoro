import { describe, expect, it } from "vitest";
import { derive, initialState } from "./timer";

describe("timer idle", () => {
  it("derives the default idle panel", () => {
    const derived = derive(initialState(), 0);
    expect(derived.phase).toBe("idle");
    expect(derived.clockLabel).toBe("25:00");
    expect(derived.menuBarLabel).toBeNull();
    expect(derived.tagName).toBe("Работа");
    expect(derived.showAdd).toBe(false);
    expect(derived.ringMode).toBe("idle");
  });
});
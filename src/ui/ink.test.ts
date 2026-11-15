import { describe, expect, it } from "vitest";
import { inkFor } from "./ink";

describe("inkFor", () => {
  it("puts dark text on a light tag and light text on a dark tag", () => {
    expect(inkFor("#D4C06A")).toBe("#14161c");
    expect(inkFor("#E07A4C")).toBe("#14161c");
    expect(inkFor("#2f6fed")).toBe("#f7f6f3");
  });
});

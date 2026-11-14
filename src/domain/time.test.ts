import { describe, expect, it } from "vitest";
import {
  addButtonLabel,
  formatBigClock,
  formatMenuBar,
  overtimeAddMinutes,
} from "./time";

describe("time labels", () => {
  it("counts overtime add minutes with a floor step and a cap", () => {
    expect(overtimeAddMinutes(0)).toBe(1);
    expect(overtimeAddMinutes(59_999)).toBe(1);
    expect(overtimeAddMinutes(60_000)).toBe(2);
    expect(overtimeAddMinutes(3 * 60 * 60 * 1000)).toBe(180);
    expect(overtimeAddMinutes(181 * 60 * 1000)).toBe(180);
  });

  it("formats big panel and menu-bar clocks", () => {
    expect(formatBigClock(192, "overtime")).toBe("+03:12");
    expect(formatMenuBar(192, "overtime")).toBe("+3:12");
    expect(formatBigClock(3 * 3600, "overtime")).toBe("+3:00:00");
    expect(formatMenuBar(24 * 60 + 12, "remaining")).toBe("24:12");
    expect(formatMenuBar(5 * 60, "break")).toBe("перерыв 5:00");
    expect(addButtonLabel(4)).toBe("Добавить 4 мин");
  });
});
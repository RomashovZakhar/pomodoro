import { describe, expect, it } from "vitest";
import type { Derived } from "../domain/types";
import { toTrayStatus } from "./status";

function derived(overrides: Partial<Derived>): Derived {
  return {
    phase: "idle",
    clockLabel: "25:00",
    menuBarLabel: null,
    tooltip: "25:00 · Работа",
    tagName: "Работа",
    plannedLabel: null,
    addLabel: null,
    addMinutes: 0,
    showSurrender: false,
    showAdd: false,
    showBreak: false,
    showSkip: false,
    ringMode: "idle",
    ringProgress: 0,
    paused: false,
    ...overrides,
  };
}

describe("toTrayStatus", () => {
  it("maps focus 24:12 with tag Работа", () => {
    const status = toTrayStatus(
      derived({
        phase: "focus",
        clockLabel: "24:12",
        menuBarLabel: "24:12",
        tooltip: "24:12 · Работа",
        ringMode: "focus",
        ringProgress: 0.032,
      }),
    );
    expect(status.menuBarLabel).toBe("24:12");
    expect(status.tooltip).toBe("24:12 · Работа");
    expect(status.menuPauseLabel).toBe("Пауза");
    expect(status.ringMode).toBe("focus");
    expect(status.ringProgress).toBe(0.032);
    expect(status.paused).toBe(false);
  });

  it("maps overtime +3:12 with full ring", () => {
    const status = toTrayStatus(
      derived({
        phase: "overtime",
        clockLabel: "+3:12",
        menuBarLabel: "+3:12",
        tooltip: "+3:12 · Работа",
        ringMode: "overtime",
        ringProgress: 1,
      }),
    );
    expect(status.tooltip).toBe("+3:12 · Работа");
    expect(status.ringMode).toBe("overtime");
    expect(status.ringProgress).toBe(1);
    expect(status.menuPauseLabel).toBe("Пауза");
  });

  it("maps break with spec menu bar and tooltip strings", () => {
    const status = toTrayStatus(
      derived({
        phase: "break",
        clockLabel: "05:00",
        menuBarLabel: "перерыв 5:00",
        tooltip: "перерыв 5:00 · Перерыв",
        tagName: "Работа",
        ringMode: "break",
        ringProgress: 0.4,
      }),
    );
    expect(status.menuBarLabel).toBe("перерыв 5:00");
    expect(status.tooltip).toBe("перерыв 5:00 · Перерыв");
    expect(status.menuPauseLabel).toBe("Пауза");
  });

  it("idle has no menu bar label and no pause menu item", () => {
    const status = toTrayStatus(
      derived({
        phase: "idle",
        menuBarLabel: null,
        tooltip: "25:00 · Работа",
        ringMode: "idle",
      }),
    );
    expect(status.menuBarLabel).toBeNull();
    expect(status.menuPauseLabel).toBeNull();
  });

  it("paused focus offers Продолжить", () => {
    const status = toTrayStatus(
      derived({
        phase: "paused",
        clockLabel: "24:00",
        menuBarLabel: "24:00",
        tooltip: "24:00 · Работа",
        ringMode: "focus",
        ringProgress: 0.04,
        paused: true,
      }),
    );
    expect(status.menuPauseLabel).toBe("Продолжить");
    expect(status.paused).toBe(true);
  });
});
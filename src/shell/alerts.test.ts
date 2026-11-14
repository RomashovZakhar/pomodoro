import { describe, expect, it } from "vitest";
import { initialState } from "../domain/timer";
import {
  alertPlan,
  closeWindowAction,
  onSpace,
  quitAction,
} from "./alerts";

describe("alertPlan", () => {
  it("returns focus-ended plan with verbatim body and sound", () => {
    const plan = alertPlan({
      ...initialState(),
      pendingAlert: "focus-ended",
    });
    expect(plan).toEqual({
      id: "focus-ended",
      title: "Помодоро",
      body: "Время вышло. Можно ещё поработать или уйти в перерыв.",
      sound: "focus-end",
    });
  });

  it("returns break-ended plan", () => {
    const plan = alertPlan({
      ...initialState(),
      pendingAlert: "break-ended",
    });
    expect(plan).toEqual({
      id: "break-ended",
      title: "Помодоро",
      body: "Перерыв закончился.",
      sound: "break-end",
    });
  });

  it("returns null when no pending alert", () => {
    expect(alertPlan(initialState())).toBeNull();
  });
});

describe("onSpace", () => {
  it.each([
    ["idle", "ignore"],
    ["focus", "pause"],
    ["overtime", "pause"],
    ["break", "pause"],
    ["paused", "resume"],
  ] as const)("phase %s → %s", (phase, expected) => {
    expect(onSpace(phase)).toBe(expected);
  });
});

describe("window and quit actions", () => {
  it("closeWindowAction hides the window", () => {
    expect(closeWindowAction()).toBe("hide");
  });

  it("quitAction exits without changing session", () => {
    expect(quitAction()).toBe("exit-without-changing-session");
  });
});
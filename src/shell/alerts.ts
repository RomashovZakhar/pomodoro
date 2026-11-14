import type { Derived, TimerState } from "../domain/types";

export type AlertPlan = {
  id: "focus-ended" | "break-ended";
  title: "Помодоро";
  body: string;
  sound: "focus-end" | "break-end";
};

export function alertPlan(state: TimerState): AlertPlan | null {
  if (state.pendingAlert === "focus-ended") {
    return {
      id: "focus-ended",
      title: "Помодоро",
      body: "Время вышло. Можно ещё поработать или уйти в перерыв.",
      sound: "focus-end",
    };
  }
  if (state.pendingAlert === "break-ended") {
    return {
      id: "break-ended",
      title: "Помодоро",
      body: "Перерыв закончился.",
      sound: "break-end",
    };
  }
  return null;
}

export function onSpace(
  phase: Derived["phase"],
): "pause" | "resume" | "ignore" {
  if (phase === "idle") return "ignore";
  if (phase === "paused") return "resume";
  return "pause";
}

export function closeWindowAction(): "hide" {
  return "hide";
}

export function quitAction(): "exit-without-changing-session" {
  return "exit-without-changing-session";
}
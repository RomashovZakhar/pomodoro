import {
  DEFAULT_SELECTED_TAG_ID,
  DEFAULT_SETTINGS,
  DEFAULT_TAGS,
} from "./defaults";
import { formatBigClock, formatMenuBar } from "./time";
import type { Derived, DerivedPhase, OpenPhase, Tag, TimerState } from "./types";

function findTag(tags: Tag[], tagId: string): Tag {
  const tag = tags.find((item) => item.id === tagId);
  if (!tag) {
    throw new Error(`unknown tag: ${tagId}`);
  }
  return tag;
}

function isPausedPhase(phase: OpenPhase): boolean {
  return (
    phase === "paused-focus" ||
    phase === "paused-overtime" ||
    phase === "paused-break"
  );
}

function focusRemainingMs(
  open: NonNullable<TimerState["open"]>,
  now: number,
): number {
  if (open.phase === "paused-focus" && open.focusRemainingMs !== undefined) {
    return open.focusRemainingMs;
  }
  return Math.max(0, open.focusEndsAt - now);
}

function toDerivedPhase(phase: OpenPhase): DerivedPhase {
  if (isPausedPhase(phase)) {
    return "paused";
  }
  if (phase === "focus") {
    return "focus";
  }
  if (phase === "overtime") {
    return "overtime";
  }
  return "break";
}

export function initialState(): TimerState {
  return {
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag })),
    selectedTagId: DEFAULT_SELECTED_TAG_ID,
    settings: { ...DEFAULT_SETTINGS },
    open: null,
    sessions: [],
    cycleCount: 0,
    pendingAlert: null,
    focusAlertFired: false,
  };
}

export type Action =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "surrender" }
  | { type: "tick" }
  | { type: "ack-alert" };

export function settle(state: TimerState, now: number): TimerState {
  if (state.open === null || state.open.phase !== "focus") {
    return state;
  }

  if (now < state.open.focusEndsAt) {
    return state;
  }

  const nextOpen = {
    ...state.open,
    phase: "overtime" as const,
    overtimeMs: now - state.open.focusEndsAt,
  };

  if (state.focusAlertFired) {
    return { ...state, open: nextOpen };
  }

  return {
    ...state,
    open: nextOpen,
    pendingAlert: "focus-ended",
    focusAlertFired: true,
  };
}

export function reduce(state: TimerState, action: Action, now: number): TimerState {
  const settled = settle(state, now);

  switch (action.type) {
    case "start": {
      if (settled.open !== null) {
        return settled;
      }
      const tag = findTag(settled.tags, settled.selectedTagId);
      const plannedMinutes = tag.focusMinutes;
      return {
        ...settled,
        open: {
          phase: "focus",
          tagId: tag.id,
          startedAt: now,
          plannedMinutes,
          focusEndsAt: now + plannedMinutes * 60_000,
        },
        pendingAlert: null,
        focusAlertFired: false,
      };
    }
    case "pause": {
      if (settled.open === null) {
        return settled;
      }
      if (settled.open.phase === "focus") {
        return {
          ...settled,
          open: {
            ...settled.open,
            phase: "paused-focus",
            focusRemainingMs: settled.open.focusEndsAt - now,
          },
        };
      }
      if (settled.open.phase === "overtime") {
        return {
          ...settled,
          open: {
            ...settled.open,
            phase: "paused-overtime",
            overtimeMs: now - settled.open.focusEndsAt,
          },
        };
      }
      return settled;
    }
    case "resume": {
      if (settled.open === null || settled.open.phase !== "paused-focus") {
        return settled;
      }
      const { focusRemainingMs: remaining, ...rest } = settled.open;
      if (remaining === undefined) {
        return settled;
      }
      return {
        ...settled,
        open: {
          ...rest,
          phase: "focus",
          focusEndsAt: now + remaining,
          focusRemainingMs: undefined,
        },
      };
    }
    case "surrender": {
      if (settled.open === null) {
        return settled;
      }
      const phase = settled.open.phase;
      if (phase === "overtime" || phase === "paused-overtime") {
        return settled;
      }
      if (phase !== "focus" && phase !== "paused-focus") {
        return settled;
      }
      return {
        ...settled,
        open: null,
        pendingAlert: null,
        focusAlertFired: false,
      };
    }
    case "tick":
      return settled;
    case "ack-alert":
      return { ...settled, pendingAlert: null };
    default:
      return settled;
  }
}

function deriveOpen(state: TimerState, now: number): Derived {
  const open = state.open!;
  const tag = findTag(state.tags, open.tagId);
  const paused = isPausedPhase(open.phase);
  const phase = toDerivedPhase(open.phase);
  const plannedMs = open.plannedMinutes * 60_000;

  if (open.phase === "focus" || open.phase === "paused-focus") {
    const remainingMs = focusRemainingMs(open, now);
    const remainingSeconds = remainingMs / 1000;
    const menuBarLabel = formatMenuBar(remainingSeconds, "remaining");
    return {
      phase,
      clockLabel: formatBigClock(remainingSeconds, "remaining"),
      menuBarLabel,
      tooltip: `${menuBarLabel} · ${tag.name}`,
      tagName: tag.name,
      plannedLabel: null,
      addLabel: null,
      addMinutes: 0,
      showSurrender: true,
      showAdd: false,
      showBreak: false,
      showSkip: false,
      ringMode: "focus",
      ringProgress: remainingMs / plannedMs,
      paused,
    };
  }

  if (open.phase === "overtime" || open.phase === "paused-overtime") {
    const elapsedMs =
      open.phase === "paused-overtime"
        ? (open.overtimeMs ?? 0)
        : Math.max(0, now - open.focusEndsAt);
    const elapsedSeconds = elapsedMs / 1000;
    const menuBarLabel = formatMenuBar(elapsedSeconds, "overtime");
    return {
      phase,
      clockLabel: formatBigClock(elapsedSeconds, "overtime"),
      menuBarLabel,
      tooltip: `${menuBarLabel} · ${tag.name}`,
      tagName: tag.name,
      plannedLabel: null,
      addLabel: null,
      addMinutes: 0,
      showSurrender: false,
      showAdd: false,
      showBreak: false,
      showSkip: false,
      ringMode: "overtime",
      ringProgress: 1,
      paused,
    };
  }

  return {
    phase,
    clockLabel: "00:00",
    menuBarLabel: null,
    tooltip: "",
    tagName: tag.name,
    plannedLabel: null,
    addLabel: null,
    addMinutes: 0,
    showSurrender: false,
    showAdd: false,
    showBreak: false,
    showSkip: false,
    ringMode: "break",
    ringProgress: 0,
    paused,
  };
}

export function derive(state: TimerState, now: number): Derived {
  if (state.open !== null) {
    return deriveOpen(state, now);
  }

  const tag = findTag(state.tags, state.selectedTagId);

  return {
    phase: "idle",
    clockLabel: formatBigClock(tag.focusMinutes * 60, "remaining"),
    menuBarLabel: null,
    tooltip: "",
    tagName: tag.name,
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
  };
}
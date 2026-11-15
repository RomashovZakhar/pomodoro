import {
  DEFAULT_SELECTED_TAG_ID,
  DEFAULT_SETTINGS,
  DEFAULT_TAGS,
} from "./defaults";
import { formatBigClock, formatMenuBar, formatOvertimeChip, overtimeAddMinutes } from "./time";
import { FOCUS_MINUTE_MAX, FOCUS_MINUTE_MIN } from "./types";
import type {
  CompletedSession,
  Derived,
  DerivedPhase,
  FocusMinutes,
  OpenPhase,
  OpenSession,
  Settings,
  Tag,
  TimerAction,
  TimerState,
} from "./types";

function findTag(tags: Tag[], tagId: string): Tag {
  const tag = tags.find((item) => item.id === tagId);
  if (!tag) {
    throw new Error(`unknown tag: ${tagId}`);
  }
  return tag;
}

function isArchived(tag: Tag): boolean {
  return tag.archived === true;
}

function isFocusMinutes(minutes: number): minutes is FocusMinutes {
  return (
    Number.isInteger(minutes) &&
    minutes >= FOCUS_MINUTE_MIN &&
    minutes <= FOCUS_MINUTE_MAX
  );
}

function activeTagCount(tags: Tag[]): number {
  return tags.filter((tag) => !isArchived(tag)).length;
}

function firstActiveTagId(tags: Tag[], exceptId?: string): string | undefined {
  return tags.find((tag) => !isArchived(tag) && tag.id !== exceptId)?.id;
}

function applySettingsPatch(
  current: Settings,
  patch: Partial<Settings>,
): Settings | null {
  if (patch.shortBreakMinutes !== undefined) {
    if (patch.shortBreakMinutes < 1 || patch.shortBreakMinutes > 30) {
      return null;
    }
  }
  if (patch.longBreakMinutes !== undefined) {
    if (patch.longBreakMinutes < 1 || patch.longBreakMinutes > 60) {
      return null;
    }
  }
  if (patch.sessionsUntilLongBreak !== undefined) {
    if (patch.sessionsUntilLongBreak < 1 || patch.sessionsUntilLongBreak > 10) {
      return null;
    }
  }
  return { ...current, ...patch };
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
    breakAlertFired: false,
  };
}

export type Action = TimerAction;

function overtimeElapsedMs(open: OpenSession, now: number): number {
  if (open.phase === "paused-overtime") {
    return open.overtimeMs ?? 0;
  }
  return Math.max(0, now - open.focusEndsAt);
}

function recordFocusAndStartBreak(
  state: TimerState,
  now: number,
  recordedMinutes: number,
): TimerState {
  const open = state.open!;
  const isLongBreak =
    (state.cycleCount + 1) % state.settings.sessionsUntilLongBreak === 0;
  const breakMinutes = isLongBreak
    ? state.settings.longBreakMinutes
    : state.settings.shortBreakMinutes;
  const session: CompletedSession = {
    id: crypto.randomUUID(),
    tagId: open.tagId,
    startedAt: open.startedAt,
    recordedMinutes,
  };
  return {
    ...state,
    sessions: [...state.sessions, session],
    cycleCount: isLongBreak ? 0 : state.cycleCount + 1,
    open: {
      phase: "break",
      tagId: open.tagId,
      startedAt: open.startedAt,
      plannedMinutes: open.plannedMinutes,
      focusEndsAt: open.focusEndsAt,
      breakEndsAt: now + breakMinutes * 60_000,
      breakIsLong: isLongBreak,
    },
  };
}

function breakRemainingMs(
  open: NonNullable<TimerState["open"]>,
  now: number,
): number {
  if (open.phase === "paused-break" && open.breakRemainingMs !== undefined) {
    return open.breakRemainingMs;
  }
  if (open.breakEndsAt === undefined) {
    return 0;
  }
  return Math.max(0, open.breakEndsAt - now);
}

export function settle(state: TimerState, now: number): TimerState {
  if (state.open === null) {
    return state;
  }

  if (state.open.phase === "focus") {
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

  if (state.open.phase === "break") {
    const breakEndsAt = state.open.breakEndsAt;
    if (breakEndsAt === undefined || now < breakEndsAt) {
      return state;
    }

    if (state.breakAlertFired) {
      return { ...state, open: null };
    }

    return {
      ...state,
      open: null,
      pendingAlert: "break-ended",
      breakAlertFired: true,
    };
  }

  return state;
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
        breakAlertFired: false,
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
      if (settled.open.phase === "break") {
        const breakEndsAt = settled.open.breakEndsAt;
        if (breakEndsAt === undefined) {
          return settled;
        }
        return {
          ...settled,
          open: {
            ...settled.open,
            phase: "paused-break",
            breakRemainingMs: breakEndsAt - now,
          },
        };
      }
      return settled;
    }
    case "resume": {
      if (settled.open === null) {
        return settled;
      }
      if (settled.open.phase === "paused-focus") {
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
      if (settled.open.phase === "paused-overtime") {
        const overtimeMs = settled.open.overtimeMs ?? 0;
        return {
          ...settled,
          open: {
            ...settled.open,
            phase: "overtime",
            focusEndsAt: now - overtimeMs,
            overtimeMs: undefined,
          },
        };
      }
      if (settled.open.phase === "paused-break") {
        const { breakRemainingMs: remaining, ...rest } = settled.open;
        if (remaining === undefined) {
          return settled;
        }
        return {
          ...settled,
          open: {
            ...rest,
            phase: "break",
            breakEndsAt: now + remaining,
            breakRemainingMs: undefined,
          },
        };
      }
      return settled;
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
    case "add-overtime": {
      if (settled.open === null) {
        return settled;
      }
      const phase = settled.open.phase;
      if (phase !== "overtime" && phase !== "paused-overtime") {
        return settled;
      }
      const n = overtimeAddMinutes(overtimeElapsedMs(settled.open, now));
      return recordFocusAndStartBreak(
        settled,
        now,
        settled.open.plannedMinutes + n,
      );
    }
    case "take-break": {
      if (settled.open === null) {
        return settled;
      }
      const phase = settled.open.phase;
      if (phase !== "overtime" && phase !== "paused-overtime") {
        return settled;
      }
      return recordFocusAndStartBreak(
        settled,
        now,
        settled.open.plannedMinutes,
      );
    }
    case "skip-break": {
      if (settled.open === null) {
        return settled;
      }
      const phase = settled.open.phase;
      if (phase !== "break" && phase !== "paused-break") {
        return settled;
      }
      return {
        ...settled,
        open: null,
        pendingAlert: null,
      };
    }
    case "select-tag": {
      const tag = settled.tags.find((item) => item.id === action.tagId);
      if (!tag || isArchived(tag)) {
        return settled;
      }
      return { ...settled, selectedTagId: action.tagId };
    }
    case "set-focus-minutes": {
      const minutes = action.minutes;
      if (!isFocusMinutes(minutes)) {
        return settled;
      }
      const selectedId = settled.selectedTagId;
      return {
        ...settled,
        tags: settled.tags.map((tag) =>
          tag.id === selectedId ? { ...tag, focusMinutes: minutes } : tag,
        ),
      };
    }
    case "create-tag": {
      const focusMinutes =
        action.focusMinutes !== undefined && isFocusMinutes(action.focusMinutes)
          ? action.focusMinutes
          : (25 as FocusMinutes);
      return {
        ...settled,
        tags: [
          ...settled.tags,
          {
            id: crypto.randomUUID(),
            name: action.name,
            color: action.color,
            focusMinutes,
          },
        ],
      };
    }
    case "update-tag": {
      const index = settled.tags.findIndex((item) => item.id === action.tagId);
      if (index === -1) {
        return settled;
      }
      const nextTags = [...settled.tags];
      const current = nextTags[index]!;
      const focusMinutes =
        action.focusMinutes !== undefined && isFocusMinutes(action.focusMinutes)
          ? action.focusMinutes
          : current.focusMinutes;
      nextTags[index] = {
        ...current,
        name: action.name,
        ...(action.color !== undefined ? { color: action.color } : {}),
        focusMinutes,
      };
      return { ...settled, tags: nextTags };
    }
    case "archive-tag": {
      const tag = settled.tags.find((item) => item.id === action.tagId);
      if (!tag || isArchived(tag)) {
        return settled;
      }
      if (activeTagCount(settled.tags) <= 1) {
        return settled;
      }
      if (settled.open?.tagId === action.tagId) {
        return settled;
      }
      const tags = settled.tags.map((item) =>
        item.id === action.tagId ? { ...item, archived: true } : item,
      );
      let selectedTagId = settled.selectedTagId;
      if (selectedTagId === action.tagId) {
        const fallback = firstActiveTagId(tags, action.tagId);
        if (fallback === undefined) {
          return settled;
        }
        selectedTagId = fallback;
      }
      return { ...settled, tags, selectedTagId };
    }
    case "update-settings": {
      const settings = applySettingsPatch(settled.settings, action.settings);
      if (settings === null) {
        return settled;
      }
      return { ...settled, settings };
    }
    case "delete-session": {
      const nextSessions = settled.sessions.filter(
        (item) => item.id !== action.sessionId,
      );
      if (nextSessions.length === settled.sessions.length) {
        return settled;
      }
      return { ...settled, sessions: nextSessions };
    }
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
    const elapsedMs = overtimeElapsedMs(open, now);
    const elapsedSeconds = elapsedMs / 1000;
    const addMinutes = overtimeAddMinutes(elapsedMs);
    const menuBarLabel = formatMenuBar(elapsedSeconds, "overtime");
    const plannedClock = formatBigClock(open.plannedMinutes * 60, "remaining");
    return {
      phase,
      clockLabel: formatBigClock(elapsedSeconds, "overtime"),
      menuBarLabel,
      tooltip: `${menuBarLabel} · ${tag.name}`,
      tagName: tag.name,
      plannedLabel: `было ${plannedClock}`,
      addLabel: formatOvertimeChip(elapsedMs),
      addMinutes,
      showSurrender: false,
      showAdd: true,
      showBreak: true,
      showSkip: false,
      ringMode: "overtime",
      ringProgress: 1,
      paused,
    };
  }

  const remainingMs = breakRemainingMs(open, now);
  const remainingSeconds = remainingMs / 1000;
  const breakTotalMs =
    (open.breakIsLong
      ? state.settings.longBreakMinutes
      : state.settings.shortBreakMinutes) * 60_000;
  const menuBarLabel = formatMenuBar(remainingSeconds, "break");
  return {
    phase,
    clockLabel: formatBigClock(remainingSeconds, "remaining"),
    menuBarLabel,
    tooltip: `${menuBarLabel} · Перерыв`,
    tagName: tag.name,
    plannedLabel: null,
    addLabel: null,
    addMinutes: 0,
    showSurrender: false,
    showAdd: false,
    showBreak: false,
    showSkip: true,
    ringMode: "break",
    ringProgress: breakTotalMs > 0 ? remainingMs / breakTotalMs : 0,
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
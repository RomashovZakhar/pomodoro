import {
  DEFAULT_SELECTED_TAG_ID,
  DEFAULT_SETTINGS,
  DEFAULT_TAGS,
} from "./defaults";
import { formatBigClock } from "./time";
import type { Derived, Tag, TimerState } from "./types";

function findTag(tags: Tag[], tagId: string): Tag {
  const tag = tags.find((item) => item.id === tagId);
  if (!tag) {
    throw new Error(`unknown tag: ${tagId}`);
  }
  return tag;
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

export function derive(state: TimerState, _now: number): Derived {
  if (state.open !== null) {
    throw new Error("derive for open sessions is not implemented in task 1");
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
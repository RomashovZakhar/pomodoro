export const FOCUS_MINUTE_MIN = 1;
export const FOCUS_MINUTE_MAX = 180;
export const FOCUS_PRESETS = [15, 25, 50, 90] as const;
export const FOCUS_MINUTE_OPTIONS = FOCUS_PRESETS;

export type FocusMinutes = number;

export type Theme = "system" | "light" | "dark";

export type PendingAlert = "focus-ended" | "break-ended";

export interface Tag {
  id: string;
  name: string;
  color: string;
  focusMinutes: FocusMinutes;
  archived?: boolean;
}

export interface Settings {
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  launchAtLogin: boolean;
  theme: Theme;
}

export type OpenPhase =
  | "focus"
  | "paused-focus"
  | "overtime"
  | "paused-overtime"
  | "break"
  | "paused-break";

export interface OpenSession {
  phase: OpenPhase;
  tagId: string;
  startedAt: number;
  plannedMinutes: number;
  focusEndsAt: number;
  focusRemainingMs?: number;
  overtimeMs?: number;
  breakEndsAt?: number;
  breakIsLong?: boolean;
  breakRemainingMs?: number;
}

export interface CompletedSession {
  id: string;
  tagId: string;
  startedAt: number;
  recordedMinutes: number;
}

export interface TimerState {
  tags: Tag[];
  selectedTagId: string;
  settings: Settings;
  open: OpenSession | null;
  sessions: CompletedSession[];
  cycleCount: number;
  pendingAlert: PendingAlert | null;
  focusAlertFired: boolean;
  breakAlertFired: boolean;
}

export type DerivedPhase = "idle" | "focus" | "overtime" | "break" | "paused";

export type RingMode = "idle" | "focus" | "overtime" | "break";

export type TimerAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "surrender" }
  | { type: "tick" }
  | { type: "ack-alert" }
  | { type: "add-overtime" }
  | { type: "take-break" }
  | { type: "skip-break" }
  | { type: "select-tag"; tagId: string }
  | { type: "set-focus-minutes"; minutes: number }
  | { type: "create-tag"; name: string; color: string; focusMinutes?: FocusMinutes }
  | {
      type: "update-tag";
      tagId: string;
      name: string;
      color?: string;
      focusMinutes?: number;
    }
  | { type: "archive-tag"; tagId: string }
  | { type: "update-settings"; settings: Partial<Settings> }
  | { type: "delete-session"; sessionId: string };

export interface Derived {
  phase: DerivedPhase;
  clockLabel: string;
  menuBarLabel: string | null;
  tooltip: string;
  tagName: string;
  plannedLabel: string | null;
  addLabel: string | null;
  addMinutes: number;
  showSurrender: boolean;
  showAdd: boolean;
  showBreak: boolean;
  showSkip: boolean;
  ringMode: RingMode;
  ringProgress: number;
  paused: boolean;
}
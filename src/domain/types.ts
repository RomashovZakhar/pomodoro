export const FOCUS_MINUTE_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 120, 150, 180,
] as const;

export type FocusMinutes = (typeof FOCUS_MINUTE_OPTIONS)[number];

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
}

export type DerivedPhase = "idle" | "focus" | "overtime" | "break" | "paused";

export type RingMode = "idle" | "focus" | "overtime" | "break";

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
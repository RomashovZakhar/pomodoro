import type { Settings, Tag } from "./types";

export const WINDOWS_TRAY_HINT =
  "Windows прячет новую иконку. Перетащите её из стрелочки к часам, чтобы время было видно.";

export const DEFAULT_TAGS: Tag[] = [
  { id: "tag-work", name: "Работа", color: "#E07A4C", focusMinutes: 25 },
  { id: "tag-study", name: "Учёба", color: "#E0A24C", focusMinutes: 25 },
  { id: "tag-own", name: "Своё", color: "#D4C06A", focusMinutes: 25 },
];

export const DEFAULT_SETTINGS: Settings = {
  shortBreakMinutes: 5,
  longBreakMinutes: 20,
  sessionsUntilLongBreak: 4,
  soundEnabled: true,
  notificationsEnabled: true,
  launchAtLogin: true,
  theme: "system",
};

export const DEFAULT_SELECTED_TAG_ID = "tag-work";
import type { Derived, RingMode } from "../domain/types";

export type TrayStatus = {
  menuBarLabel: string | null;
  tooltip: string;
  ringMode: RingMode;
  ringProgress: number;
  paused: boolean;
  menuPauseLabel: "Пауза" | "Продолжить" | null;
};

export function toTrayStatus(derived: Derived): TrayStatus {
  let menuPauseLabel: TrayStatus["menuPauseLabel"] = null;
  if (derived.phase !== "idle") {
    menuPauseLabel = derived.paused ? "Продолжить" : "Пауза";
  }

  return {
    menuBarLabel: derived.menuBarLabel,
    tooltip: derived.tooltip,
    ringMode: derived.ringMode,
    ringProgress: derived.ringProgress,
    paused: derived.paused,
    menuPauseLabel,
  };
}
import { useState } from "react";
import type { TimerAction, TimerState } from "../domain/types";
import { SettingsView } from "./SettingsView";
import { StatsView } from "./StatsView";
import { TimelineView } from "./TimelineView";
import { TimerFace } from "./TimerFace";
import { useAppTheme } from "./theme";

export function DayWindow({
  state,
  now,
  platform,
  onAction,
}: {
  state: TimerState;
  now: number;
  platform: string;
  onAction: (action: TimerAction) => void;
}) {
  useAppTheme(state.settings.theme);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app-shell day">
      <section className="card day-timer">
        <TimerFace state={state} now={now} onAction={onAction} />
        <button
          type="button"
          className="quiet"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          Настройки
        </button>
      </section>
      <div className="day-main">
        <TimelineView
          state={state}
          now={now}
          onDelete={(sessionId) =>
            onAction({ type: "delete-session", sessionId })
          }
        />
        <StatsView state={state} now={now} />
        {settingsOpen ? (
          <SettingsView state={state} platform={platform} onAction={onAction} />
        ) : null}
      </div>
    </div>
  );
}

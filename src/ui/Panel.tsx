import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TimerAction, TimerState } from "../domain/types";
import { ScreenDeck } from "./ScreenDeck";
import { SettingsView } from "./SettingsView";
import { StatsView } from "./StatsView";
import { TimelineView } from "./TimelineView";
import { TimerFace } from "./TimerFace";
import { useAppTheme } from "./theme";

export function Panel({
  state,
  now,
  platform = "linux",
  onAction,
  onOpenDay,
}: {
  state: TimerState;
  now: number;
  platform?: string;
  onAction: (action: TimerAction) => void;
  onOpenDay?: () => void;
}) {
  useAppTheme(state.settings.theme);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      void invoke("hide_panel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-shell panel">
      <div className="card panel-card">
        <ScreenDeck
          home={
            <>
              <TimerFace state={state} now={now} onAction={onAction} />
              <button type="button" className="day-link" onClick={() => onOpenDay?.()}>
                Открыть день
              </button>
            </>
          }
          calendar={
            <TimelineView
              state={state}
              now={now}
              onDelete={(sessionId) => onAction({ type: "delete-session", sessionId })}
            />
          }
          summary={<StatsView state={state} now={now} />}
          settings={<SettingsView state={state} platform={platform} onAction={onAction} />}
        />
      </div>
    </div>
  );
}

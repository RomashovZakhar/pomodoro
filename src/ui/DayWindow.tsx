import type { TimerAction, TimerState } from "../domain/types";
import { ScreenDeck } from "./ScreenDeck";
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

  return (
    <div className="app-shell day">
      <ScreenDeck
        home={<TimerFace state={state} now={now} onAction={onAction} />}
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
  );
}

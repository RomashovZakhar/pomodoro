import type { TimerAction, TimerState } from "../domain/types";
import { TimerFace } from "./TimerFace";
import { useAppTheme } from "./theme";

export function Panel({
  state,
  now,
  onAction,
  onOpenDay,
}: {
  state: TimerState;
  now: number;
  onAction: (action: TimerAction) => void;
  onOpenDay?: () => void;
}) {
  useAppTheme(state.settings.theme);

  return (
    <div className="app-shell panel">
      <div className="card">
        <TimerFace state={state} now={now} onAction={onAction} />
        <button type="button" className="quiet" onClick={() => onOpenDay?.()}>
          Открыть день
        </button>
      </div>
    </div>
  );
}

import type { CompletedSession } from "../domain/types";
import { tomatoScale } from "../domain/timeline";

export function TomatoPile({ sessions }: { sessions: CompletedSession[] }) {
  return (
    <div className="tomato-pile" data-testid="tomato-pile" aria-hidden="true">
      {sessions.map((session) => (
        <span
          key={session.id}
          className="tomato"
          style={{ transform: `scale(${tomatoScale(session.recordedMinutes)})` }}
        />
      ))}
    </div>
  );
}

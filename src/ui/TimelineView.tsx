import { useState } from "react";
import type { TimerState } from "../domain/types";
import { emptyDayCopy, timeline } from "../domain/timeline";

export function TimelineView({
  state,
  now,
  onDelete,
}: {
  state: TimerState;
  now: number;
  onDelete: (sessionId: string) => void;
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const days = timeline(state.sessions, state.tags, now, view, zone);
  const empty = days.every((day) => day.blocks.length === 0);
  const clock = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  });
  const weekDayLabel =
    view === "week"
      ? new Intl.DateTimeFormat("ru-RU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: zone,
        })
      : null;

  return (
    <section className="card timeline" role="group" aria-label="Лента">
      <div className="ranges">
        <button
          type="button"
          aria-pressed={view === "day"}
          onClick={() => setView("day")}
        >
          День
        </button>
        <button
          type="button"
          aria-pressed={view === "week"}
          onClick={() => setView("week")}
        >
          Неделя
        </button>
      </div>
      {empty ? <p>{emptyDayCopy()}</p> : null}
      {days.map((day) => (
        <div
          key={day.start}
          className={view === "week" ? "timeline-day" : undefined}
        >
          {weekDayLabel ? (
            <h3 className="timeline-day-heading">
              {weekDayLabel.format(day.start)}
            </h3>
          ) : null}
          {day.blocks.map((block) => (
            <article key={block.sessionId} className="block">
              <span className="swatch" style={{ background: block.color }} />
              <span>
                {block.name} · {clock.format(block.startedAt)} · {block.label}
              </span>
              <button type="button" onClick={() => onDelete(block.sessionId)}>
                Удалить сессию
              </button>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

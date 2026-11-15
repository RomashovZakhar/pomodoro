import { useState } from "react";
import type { TimerState } from "../domain/types";
import { emptyDayCopy, emptyWeekCopy, timeline } from "../domain/timeline";
import { inkFor } from "./ink";

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

  const dateTitle = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: zone,
  }).format(now);

  return (
    <section className="timeline" role="group" aria-label="Лента">
      <header className="screen-head">
        <h1>{dateTitle}</h1>
        <div className="ranges">
          <button
            type="button"
            className="range"
            aria-pressed={view === "day"}
            onClick={() => setView("day")}
          >
            День
          </button>
          <button
            type="button"
            className="range"
            aria-pressed={view === "week"}
            onClick={() => setView("week")}
          >
            Неделя
          </button>
        </div>
      </header>
      {empty ? <p className="hint">{view === "week" ? emptyWeekCopy() : emptyDayCopy()}</p> : null}
      {days.map((day) => (
        <div key={day.start} className={view === "week" ? "timeline-day" : undefined}>
          {weekDayLabel ? (
            <h3 className="timeline-day-heading">{weekDayLabel.format(day.start)}</h3>
          ) : null}
          {day.blocks.map((block) => (
            <div key={block.sessionId} className="session">
              <time className="session-time">{clock.format(block.startedAt)}</time>
              <article
                className="block"
                style={{ background: block.color, color: inkFor(block.color) }}
              >
                <span className="block-copy">
                  <strong>{block.name}</strong>
                  <span>{block.label}</span>
                </span>
                <button type="button" onClick={() => onDelete(block.sessionId)}>
                  Удалить
                </button>
              </article>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

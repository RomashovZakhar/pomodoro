import { useState } from "react";
import type { TimerState } from "../domain/types";
import { stats } from "../domain/stats";
import { endOfZonedPeriod, periodStart } from "../domain/timeline";
import { TomatoPile } from "./TomatoPile";

const RANGES = ["day", "week", "month", "year"] as const;
const RANGE_LABEL = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  year: "Год",
} as const;

export function StatsView({ state, now }: { state: TimerState; now: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("day");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const summary = stats(state.sessions, state.tags, now, range, zone);
  const from = periodStart(range, now, zone);
  const to = endOfZonedPeriod(range, now, zone);
  const periodSessions = state.sessions.filter(
    (session) => session.startedAt >= from && session.startedAt < to,
  );

  return (
    <section className="card stats" role="group" aria-label="Статистика">
      <div className="ranges">
        {RANGES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={range === item}
            onClick={() => setRange(item)}
          >
            {RANGE_LABEL[item]}
          </button>
        ))}
      </div>
      <p>
        Помидоры {summary.periodTomatoes} за период, {summary.totalTomatoes} всего
      </p>
      <p>
        Дни {summary.periodDays} за период, {summary.totalDays} всего
      </p>
      <p>
        Минуты {summary.periodMinutes} за период, {summary.totalMinutes} всего
      </p>
      {summary.tags.map((row) => (
        <p key={row.tagId} className="tag-share">
          <span>{row.name}</span>
          <span>
            {row.minutes} мин · {Math.round(row.share * 100)}%
          </span>
        </p>
      ))}
      <TomatoPile sessions={periodSessions} />
    </section>
  );
}

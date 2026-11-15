import { useState } from "react";
import type { TimerState } from "../domain/types";
import { stats } from "../domain/stats";
import { durationLabel } from "../domain/timeline";

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

  return (
    <section className="stats" role="group" aria-label="Статистика">
      <header className="screen-head">
        <h1>Сводка</h1>
        <div className="ranges">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className="range"
              aria-pressed={range === item}
              onClick={() => setRange(item)}
            >
              {RANGE_LABEL[item]}
            </button>
          ))}
        </div>
      </header>
      <div className="stat-grid">
        <article className="stat-card">
          <span className="stat-kicker">Помидоры</span>
          <strong>{summary.periodTomatoes}</strong>
          <span className="hint">всего {summary.totalTomatoes}</span>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Фокус</span>
          <strong>{durationLabel(summary.periodMinutes)}</strong>
          <span className="hint">всего {durationLabel(summary.totalMinutes)}</span>
        </article>
        <article className="stat-card wide">
          <span className="stat-kicker">Дни с сессией</span>
          <strong>{summary.periodDays}</strong>
          <span className="hint">всего {summary.totalDays}</span>
        </article>
      </div>
      <h2>По тегам</h2>
      <div className="group">
        {summary.tags.length === 0 ? <p className="hint">Пока нет сессий за этот срок.</p> : null}
        {summary.tags.map((row) => (
          <p key={row.tagId} className="tag-share">
            <span className="swatch" style={{ background: row.color }} />
            <span>{row.name}</span>
            <span>
              {durationLabel(row.minutes)} · {Math.round(row.share * 100)}%
            </span>
          </p>
        ))}
      </div>
    </section>
  );
}

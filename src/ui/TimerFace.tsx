import { useEffect } from "react";
import { FOCUS_MINUTE_OPTIONS } from "../domain/types";
import type { TimerAction, TimerState } from "../domain/types";
import { derive } from "../domain/timer";
import { onSpace } from "../shell/alerts";

function keepsSpace(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("button, a")) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function TimerFace({
  state,
  now,
  onAction,
}: {
  state: TimerState;
  now: number;
  onAction: (action: TimerAction) => void;
}) {
  const derived = derive(state, now);
  const selected = state.tags.find((tag) => tag.id === state.selectedTagId);
  const activeTags = state.tags.filter((tag) => tag.archived !== true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " || event.repeat) return;
      if (keepsSpace(event.target)) return;
      const decision = onSpace(derived.phase);
      if (decision === "ignore") return;
      event.preventDefault();
      onAction({ type: decision });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [derived.phase, onAction]);

  return (
    <div className="timer-face">
      <p className="clock-digits">{derived.clockLabel}</p>
      {derived.phase === "idle" ? null : (
        <p className="tag-name">{derived.tagName}</p>
      )}
      {derived.plannedLabel ? <p className="planned">{derived.plannedLabel}</p> : null}
      {derived.phase === "idle" ? (
        <div className="choices">
          <label>
            Длина
            <select
              aria-label="Длина"
              value={selected ? String(selected.focusMinutes) : "25"}
              onChange={(event) =>
                onAction({
                  type: "set-focus-minutes",
                  minutes: Number(event.target.value),
                })
              }
            >
              {FOCUS_MINUTE_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              ))}
            </select>
          </label>
          <div className="choices" role="group" aria-label="Тег">
            {activeTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                aria-pressed={tag.id === state.selectedTagId}
                onClick={() => onAction({ type: "select-tag", tagId: tag.id })}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="actions">
        {derived.phase !== "idle" ? (
          <button
            type="button"
            className="pause"
            onClick={() =>
              onAction({ type: derived.paused ? "resume" : "pause" })
            }
          >
            {derived.paused ? "Продолжить" : "Пауза"}
          </button>
        ) : null}
        {derived.phase === "idle" ? (
          <button
            type="button"
            className="primary"
            onClick={() => onAction({ type: "start" })}
          >
            Начать
          </button>
        ) : null}
        {derived.showAdd && derived.addLabel ? (
          <button
            type="button"
            className="primary"
            onClick={() => onAction({ type: "add-overtime" })}
          >
            {derived.addLabel}
          </button>
        ) : null}
        {derived.showBreak ? (
          <button
            type="button"
            className="primary"
            onClick={() => onAction({ type: "take-break" })}
          >
            Перерыв
          </button>
        ) : null}
        {derived.showSkip ? (
          <button
            type="button"
            className="primary"
            onClick={() => onAction({ type: "skip-break" })}
          >
            Пропустить
          </button>
        ) : null}
        {derived.showSurrender ? (
          <button
            type="button"
            className="quiet"
            onClick={() => onAction({ type: "surrender" })}
          >
            Сдаться
          </button>
        ) : null}
      </div>
    </div>
  );
}

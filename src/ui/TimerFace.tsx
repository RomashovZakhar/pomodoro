import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { TimerAction, TimerState } from "../domain/types";
import { derive } from "../domain/timer";
import { onSpace } from "../shell/alerts";
import { MinuteRuler } from "./MinuteRuler";
import { TagSheet } from "./TagSheet";

const HOLD_MS = 700;

function keepsSpace(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("button, a")) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.getAttribute("role") === "slider";
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
  const [rulerOpen, setRulerOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const tagName = selected?.name ?? derived.tagName;
  const idle = derived.phase === "idle";
  const stopAction = derived.showSurrender
    ? "surrender"
    : derived.showSkip
      ? "skip-break"
      : null;
  const overtime = derived.showAdd;
  const [holdProgress, setHoldProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const holdRef = useRef<{ x: number; y: number; timer: number } | null>(null);

  const clearHold = () => {
    if (holdRef.current) {
      window.clearInterval(holdRef.current.timer);
      holdRef.current = null;
    }
    setHoldProgress(0);
    setHolding(false);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " || event.repeat || event.defaultPrevented) return;
      if (keepsSpace(event.target)) return;
      if (document.querySelector("[data-overlay-open]")) return;
      const decision = onSpace(derived.phase);
      if (decision === "ignore") return;
      event.preventDefault();
      onAction({ type: decision });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [derived.phase, onAction]);

  useEffect(() => {
    if (idle) return;
    setRulerOpen(false);
    setTagOpen(false);
  }, [idle]);

  useEffect(() => {
    return () => {
      if (holdRef.current) window.clearInterval(holdRef.current.timer);
    };
  }, []);

  const onHoldDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stopAction === null || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, textarea")) return;
    clearHold();
    setHolding(true);
    const action = stopAction;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / HOLD_MS);
      if (progress >= 1) {
        window.clearInterval(timer);
        holdRef.current = null;
        setHoldProgress(0);
        setHolding(false);
        onAction({ type: action });
        return;
      }
      setHoldProgress(progress);
    }, 40);
    holdRef.current = { x: event.clientX, y: event.clientY, timer };
  };

  const onHoldMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = holdRef.current;
    if (!current) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 12) clearHold();
  };

  return (
    <div
      className={stopAction ? "timer-face is-session" : "timer-face"}
      onPointerDown={onHoldDown}
      onPointerMove={onHoldMove}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
    >
      {overtime ? null : idle ? (
        <button type="button" className="clock-digits" onClick={() => setRulerOpen(true)}>
          {derived.clockLabel}
        </button>
      ) : (
        <p className="clock-digits">{derived.clockLabel}</p>
      )}
      {idle ? (
        <button
          type="button"
          className="tag-line"
          aria-haspopup="dialog"
          aria-expanded={tagOpen}
          onClick={() => setTagOpen(true)}
        >
          <span>{tagName}</span>
          <span aria-hidden="true"> ›</span>
        </button>
      ) : null}
      <div className="actions">
        {derived.paused ? (
          <button type="button" className="quiet" onClick={() => onAction({ type: "resume" })}>
            Продолжить
          </button>
        ) : null}
        {idle ? (
          <button type="button" className="start" onClick={() => onAction({ type: "start" })}>
            Начать
          </button>
        ) : null}
        {derived.showAdd && derived.addLabel ? (
          <button
            type="button"
            className="start overtime-chip"
            onClick={() => onAction({ type: "add-overtime" })}
          >
            {derived.addLabel}
          </button>
        ) : null}
        {derived.showBreak ? (
          <button type="button" className="primary" onClick={() => onAction({ type: "take-break" })}>
            Перерыв
          </button>
        ) : null}
      </div>
      {stopAction ? (
        <div className="hold-chrome">
          {holding ? (
            <span className="hold-track">
              <span className="hold-track-fill" style={{ width: `${holdProgress * 100}%` }} />
            </span>
          ) : null}
          <p className="hold-hint">Удерживайте, чтобы закончить</p>
        </div>
      ) : null}
      {rulerOpen
        ? createPortal(
            <MinuteRuler
              minutes={selected?.focusMinutes ?? 25}
              onCancel={() => setRulerOpen(false)}
              onCommit={(minutes) => {
                onAction({ type: "set-focus-minutes", minutes });
                setRulerOpen(false);
              }}
            />,
            document.body,
          )
        : null}
      {tagOpen
        ? createPortal(
            <TagSheet
              tags={activeTags}
              selectedId={state.selectedTagId}
              onClose={() => setTagOpen(false)}
              onSelect={(tagId) => {
                onAction({ type: "select-tag", tagId });
                setTagOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

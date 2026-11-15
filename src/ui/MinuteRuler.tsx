import { useEffect, useRef, useState } from "react";
import { FOCUS_MINUTE_MAX, FOCUS_MINUTE_MIN } from "../domain/types";

const PIXELS_PER_MINUTE = 16;

function clampMinute(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function MinuteRuler({
  minutes: initial,
  min = FOCUS_MINUTE_MIN,
  max = FOCUS_MINUTE_MAX,
  label = "Длина фокуса",
  caption,
  onCancel,
  onCommit,
}: {
  minutes: number;
  min?: number;
  max?: number;
  label?: string;
  caption?: string;
  onCancel: () => void;
  onCommit: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = useState(initial);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; start: number } | null>(null);

  useEffect(() => {
    viewport.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="overlay" data-overlay-open onPointerDown={onCancel}>
      <div
        className="ruler"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="ruler-value">{minutes}</p>
        {caption ? <p className="ruler-caption">{caption}</p> : null}
        <div
          ref={viewport}
          className="ruler-viewport"
          role="slider"
          tabIndex={0}
          aria-label="Минуты"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={minutes}
          aria-valuetext={caption ? `${minutes}. ${caption}` : `${minutes} мин`}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            event.stopPropagation();
            const step = event.shiftKey ? 5 : 1;
            setMinutes((current) =>
              clampMinute(current + (event.key === "ArrowRight" ? step : -step), min, max),
            );
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            drag.current = { id: event.pointerId, x: event.clientX, start: minutes };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current || current.id !== event.pointerId) return;
            const delta = Math.round((current.x - event.clientX) / PIXELS_PER_MINUTE);
            setMinutes(clampMinute(current.start + delta, min, max));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <div
            className="ruler-track"
            aria-hidden="true"
            style={{
              transform: `translateX(${-((minutes - min) * PIXELS_PER_MINUTE + PIXELS_PER_MINUTE / 2)}px)`,
            }}
          >
            {Array.from({ length: max - min + 1 }, (_, index) => {
              const value = min + index;
              const distance = Math.abs(value - minutes);
              return (
                <span
                  key={value}
                  className={value % 5 === 0 ? "ruler-tick major" : "ruler-tick"}
                  style={{ opacity: distance === 0 ? 1 : Math.max(0.45, 1 - distance / 28) }}
                >
                  {value % 5 === 0 ? <span className="ruler-label">{value}</span> : <span />}
                  <span className="ruler-mark" />
                </span>
              );
            })}
          </div>
          <span className="ruler-needle" aria-hidden="true" />
        </div>
        <button type="button" className="primary" onClick={() => onCommit(minutes)}>
          Готово
        </button>
      </div>
    </div>
  );
}

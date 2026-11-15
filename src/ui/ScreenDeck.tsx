import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { clampDrag, DECK_THRESHOLD, lockAxis, nextPlace, placeOffset, type Place } from "./deck";

const AXIS_SLOP = 8;

function keepsKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.getAttribute("role") === "slider";
}

function visibleDuring(place: Place, screen: Place, dx: number, dy: number, dragging: boolean): boolean {
  if (!dragging) return screen === place;
  if (screen === place || screen === "home") return true;
  if (place !== "home") return false;
  if (dx < 0 && screen === "calendar") return true;
  if (dx > 0 && screen === "settings") return true;
  if (dy < 0 && screen === "summary") return true;
  return false;
}

export function ScreenDeck({
  home,
  calendar,
  summary,
  settings,
}: {
  home: ReactNode;
  calendar: ReactNode;
  summary: ReactNode;
  settings: ReactNode;
}) {
  const [place, setPlace] = useState<Place>("home");
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const frame = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ dx: 0, dy: 0 });
  const suppressClick = useRef(false);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    onHandle: boolean;
    inScroll: boolean;
    dragging: boolean;
    scrollTop: number;
  } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || keepsKeys(event.target)) return;
      if (document.querySelector("[data-overlay-open]")) return;
      if (event.key === "ArrowRight" && place === "home") setPlace("calendar");
      if (event.key === "ArrowLeft" && place === "home") setPlace("settings");
      if (event.key === "ArrowDown" && place === "home") setPlace("summary");
      if (event.key === "ArrowLeft" && place === "calendar") setPlace("home");
      if (event.key === "ArrowRight" && place === "settings") setPlace("home");
      if (event.key === "ArrowUp" && place === "summary") setPlace("home");
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || place === "home") return;
      if (document.querySelector("[data-overlay-open]")) return;
      event.preventDefault();
      event.stopPropagation();
      setPlace("home");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onEscape, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onEscape, true);
    };
  }, [place]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (document.querySelector("[data-overlay-open]")) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const control = target.closest("button, a, input, select, textarea");
    if (control && !control.closest(".clock-digits, .tag-line")) return;
    const scroller = target.closest(".screen-scroll");
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      onHandle: Boolean(target.closest("[data-deck-handle]")),
      inScroll: scroller instanceof HTMLElement,
      scrollTop: scroller instanceof HTMLElement ? scroller.scrollTop : 0,
      dragging: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const rawX = event.clientX - current.x;
    const rawY = event.clientY - current.y;
    if (!current.dragging) {
      if (Math.hypot(rawX, rawY) < AXIS_SLOP) return;
      const horizontal = Math.abs(rawX) > Math.abs(rawY);
      const atTop = !current.inScroll || current.scrollTop <= 0;
      const towardSummary = place === "home" && !horizontal && rawY < 0;
      const backFromSummary = place === "summary" && !horizontal && rawY > 0 && (current.onHandle || atTop);
      const allow = horizontal || towardSummary || backFromSummary;
      if (!allow) {
        gesture.current = null;
        return;
      }
      current.dragging = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The gesture still finishes on pointerup when the browser cannot capture it.
      }
    }
    const locked = lockAxis(rawX, rawY);
    dragRef.current = locked;
    const width = Math.max(frame.current?.clientWidth ?? 0, 1);
    const height = Math.max(frame.current?.clientHeight ?? 0, 1);
    const next = clampDrag(place, locked.dx, locked.dy, width, height);
    setDrag({ ...next, active: true });
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const moved = current.dragging;
    gesture.current = null;
    if (!moved) return;
    suppressClick.current = true;
    const { dx, dy } = dragRef.current;
    dragRef.current = { dx: 0, dy: 0 };
    setDrag({ dx: 0, dy: 0, active: false });
    const width = frame.current?.clientWidth ?? 1;
    const threshold = Math.min(DECK_THRESHOLD, Math.max(48, Math.round(Math.min(width, frame.current?.clientHeight ?? 1) * 0.12)));
    setPlace((currentPlace) => nextPlace(currentPlace, dx, dy, threshold));
  };

  const base = placeOffset(place);
  const transform = `translate3d(calc(${base.x * 100}% + ${drag.dx}px), calc(${base.y * 100}% + ${drag.dy}px), 0)`;
  const goHome = () => setPlace("home");

  return (
    <div
      className={drag.active ? "deck is-dragging" : "deck"}
      ref={frame}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className={drag.active ? "deck-plane is-dragging" : "deck-plane"} style={{ transform }}>
        <section className="deck-screen deck-home" hidden={!visibleDuring(place, "home", drag.dx, drag.dy, drag.active)}>
          <div className="home-stage">{home}</div>
        </section>
        <Side placeName="calendar" hidden={!visibleDuring(place, "calendar", drag.dx, drag.dy, drag.active)} onHome={goHome}>
          {calendar}
        </Side>
        <Side placeName="summary" hidden={!visibleDuring(place, "summary", drag.dx, drag.dy, drag.active)} onHome={goHome}>
          {summary}
        </Side>
        <Side placeName="settings" hidden={!visibleDuring(place, "settings", drag.dx, drag.dy, drag.active)} onHome={goHome}>
          {settings}
        </Side>
      </div>
    </div>
  );
}

function Side({
  placeName,
  hidden,
  onHome,
  children,
}: {
  placeName: Exclude<Place, "home">;
  hidden: boolean;
  onHome: () => void;
  children: ReactNode;
}) {
  return (
    <section className="deck-screen" data-place={placeName} hidden={hidden}>
      <div className="screen-handle" data-deck-handle>
        <button type="button" className="back" onClick={onHome}>
          На главный
        </button>
      </div>
      <div className="screen-scroll">
        <div className="screen-body">{children}</div>
      </div>
    </section>
  );
}

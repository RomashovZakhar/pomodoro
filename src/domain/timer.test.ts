import { describe, expect, it } from "vitest";
import { derive, initialState, reduce, settle } from "./timer";

describe("timer idle", () => {
  it("derives the default idle panel", () => {
    const derived = derive(initialState(), 0);
    expect(derived.phase).toBe("idle");
    expect(derived.clockLabel).toBe("25:00");
    expect(derived.menuBarLabel).toBeNull();
    expect(derived.tagName).toBe("Работа");
    expect(derived.showAdd).toBe(false);
    expect(derived.ringMode).toBe("idle");
  });
});

describe("planned focus", () => {
  const t0 = 1_700_000_000_000;

  it("derives remaining labels while focus runs", () => {
    const state = reduce(initialState(), { type: "start" }, t0);
    const derived = derive(state, t0 + 88_000);
    expect(derived.clockLabel).toBe("23:32");
    expect(derived.menuBarLabel).toBe("23:32");
  });

  it("formats exactly five minutes left on both clocks", () => {
    const state = reduce(initialState(), { type: "start" }, t0);
    const derived = derive(state, t0 + 20 * 60_000);
    expect(derived.clockLabel).toBe("05:00");
    expect(derived.menuBarLabel).toBe("5:00");
  });

  it("tracks ring progress from full to half", () => {
    const state = reduce(initialState(), { type: "start" }, t0);
    expect(derive(state, t0).ringProgress).toBe(1);
    expect(derive(state, t0 + (25 * 60_000) / 2).ringProgress).toBe(0.5);
  });

  it("freezes remaining time across a long pause", () => {
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "pause" }, t0 + 60_000);
    state = reduce(state, { type: "resume" }, t0 + 60_000 + 10 * 60_000);
    expect(state.open?.startedAt).toBe(t0);
    const derived = derive(state, t0 + 60_000 + 10 * 60_000);
    expect(derived.clockLabel).toBe("24:00");
  });

  it("surrenders from focus and paused-focus without recording", () => {
    let running = reduce(initialState(), { type: "start" }, t0);
    running = reduce(running, { type: "surrender" }, t0 + 30_000);
    expect(running.open).toBeNull();
    expect(running.sessions).toEqual([]);
    expect(running.cycleCount).toBe(0);

    let paused = reduce(initialState(), { type: "start" }, t0);
    paused = reduce(paused, { type: "pause" }, t0 + 30_000);
    paused = reduce(paused, { type: "surrender" }, t0 + 40_000);
    expect(paused.open).toBeNull();
    expect(paused.sessions).toEqual([]);
    expect(paused.cycleCount).toBe(0);
  });

  it("collapses paused open phases into derived paused", () => {
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "pause" }, t0 + 1_000);
    expect(derive(state, t0 + 1_000).phase).toBe("paused");
    expect(derive(state, t0 + 1_000).paused).toBe(true);

    state = reduce(state, { type: "resume" }, t0 + 2_000);
    state = reduce(state, { type: "tick" }, t0 + 25 * 60_000);
    state = reduce(state, { type: "pause" }, t0 + 25 * 60_000 + 1_000);
    expect(derive(state, t0 + 25 * 60_000 + 1_000).phase).toBe("paused");
  });

  it("ticks into overtime with a single focus-ended alert", () => {
    const focusEndsAt = t0 + 25 * 60_000;
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "tick" }, focusEndsAt);
    expect(state.open?.phase).toBe("overtime");
    expect(state.pendingAlert).toBe("focus-ended");
    expect(state.sessions).toEqual([]);
    expect(state.open?.breakEndsAt).toBeUndefined();
  });

  it("does not re-arm the focus alert on another tick", () => {
    const focusEndsAt = t0 + 25 * 60_000;
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "tick" }, focusEndsAt);
    state = reduce(state, { type: "ack-alert" }, focusEndsAt);
    expect(state.pendingAlert).toBeNull();
    state = reduce(state, { type: "tick" }, focusEndsAt + 5_000);
    expect(state.pendingAlert).toBeNull();
    expect(state.focusAlertFired).toBe(true);
  });

  it("ignores surrender once focus is in overtime", () => {
    const focusEndsAt = t0 + 25 * 60_000;
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "tick" }, focusEndsAt);
    state = reduce(state, { type: "surrender" }, focusEndsAt + 1_000);
    expect(state.open?.phase).toBe("overtime");
  });

  it("freezes elapsed overtime across a long pause", () => {
    const focusEndsAt = t0 + 25 * 60_000;
    const pauseAt = focusEndsAt + 90_000;
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "tick" }, focusEndsAt);
    state = reduce(state, { type: "tick" }, pauseAt);
    const atPause = derive(state, pauseAt);
    expect(atPause.clockLabel).toBe("+01:30");
    state = reduce(state, { type: "pause" }, pauseAt);
    const resumeAt = pauseAt + 10 * 60_000;
    state = reduce(state, { type: "resume" }, resumeAt);
    expect(state.open?.phase).toBe("overtime");
    const afterResume = derive(state, resumeAt);
    expect(afterResume.clockLabel).toBe(atPause.clockLabel);
  });
});

describe("overtime recording", () => {
  const t0 = 1_700_000_000_000;

  function overtimeAt(elapsedMs: number) {
    const focusEndsAt = t0 + 25 * 60_000;
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "tick" }, focusEndsAt + elapsedMs);
    return { state, focusEndsAt, now: focusEndsAt + elapsedMs };
  }

  it("derives add labels in overtime", () => {
    const { state, now } = overtimeAt(192_000);
    const derived = derive(state, now);
    expect(derived.clockLabel).toBe("+03:12");
    expect(derived.plannedLabel).toBe("было 25:00");
    expect(derived.addLabel).toBe("Добавить 4 мин");
    expect(derived.addMinutes).toBe(4);
    expect(derived.showAdd).toBe(true);
    expect(derived.showBreak).toBe(true);
    expect(derived.showSurrender).toBe(false);
  });

  it("records planned plus N on add-overtime and starts a short break", () => {
    const { state, now } = overtimeAt(192_000);
    const next = reduce(state, { type: "add-overtime" }, now);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]).toMatchObject({
      tagId: "tag-work",
      startedAt: t0,
      recordedMinutes: 29,
    });
    expect(next.sessions[0].id).toBeTruthy();
    expect(next.open?.phase).toBe("break");
    expect(next.open?.breakIsLong).toBe(false);
    expect(next.open?.breakEndsAt).toBe(now + 5 * 60_000);
    expect(next.cycleCount).toBe(1);
    expect(next.focusAlertFired).toBe(true);
    expect(next.pendingAlert).toBe("focus-ended");
  });

  it("records planned minutes only on take-break", () => {
    const { state, now } = overtimeAt(192_000);
    const next = reduce(state, { type: "take-break" }, now);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0].recordedMinutes).toBe(25);
    expect(next.open?.phase).toBe("break");
    expect(next.cycleCount).toBe(1);
  });

  it("freezes add minutes while overtime is paused", () => {
    const focusEndsAt = t0 + 25 * 60_000;
    const pauseAt = focusEndsAt + 90_000;
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "tick" }, pauseAt);
    state = reduce(state, { type: "pause" }, pauseAt);
    const resumeAt = pauseAt + 10 * 60_000;
    const frozen = derive(state, resumeAt);
    expect(frozen.addMinutes).toBe(2);
    expect(frozen.clockLabel).toBe("+01:30");
    state = reduce(state, { type: "resume" }, resumeAt);
    const afterResume = derive(state, resumeAt + 30_000);
    expect(afterResume.addMinutes).toBe(3);
    expect(afterResume.clockLabel).toBe("+02:00");
  });

  it("adds from paused-overtime without ticking forward", () => {
    const focusEndsAt = t0 + 25 * 60_000;
    const pauseAt = focusEndsAt + 90_000;
    let state = reduce(initialState(), { type: "start" }, t0);
    state = reduce(state, { type: "tick" }, pauseAt);
    state = reduce(state, { type: "pause" }, pauseAt);
    const resumeAt = pauseAt + 10 * 60_000;
    const next = reduce(state, { type: "add-overtime" }, resumeAt);
    expect(next.sessions[0].recordedMinutes).toBe(27);
    expect(next.open?.phase).toBe("break");
  });

  it("caps add minutes and clock at three hours", () => {
    const elapsedMs = 181 * 60_000;
    const { state, now } = overtimeAt(elapsedMs);
    const derived = derive(state, now);
    expect(derived.addLabel).toBe("Добавить 180 мин");
    expect(derived.addMinutes).toBe(180);
    expect(derived.clockLabel).toBe("+3:00:00");
  });

  it("settles into overtime after reopen with one alert and wall-clock N", () => {
    const focusEndsAt = t0 + 25 * 60_000;
    const saved = reduce(initialState(), { type: "start" }, t0);
    const later = focusEndsAt + 181 * 60_000;
    const reopened = settle(saved, later);
    expect(reopened.open?.phase).toBe("overtime");
    expect(reopened.pendingAlert).toBe("focus-ended");
    expect(derive(reopened, later).addMinutes).toBe(180);
    const acked = { ...reopened, pendingAlert: null, focusAlertFired: true };
    const again = settle(acked, later + 60_000);
    expect(again.pendingAlert).toBeNull();
  });
});
import { describe, expect, it } from "vitest";
import { derive, initialState, reduce } from "./timer";

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
});
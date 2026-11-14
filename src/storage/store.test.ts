import { describe, expect, it } from "vitest";
import { initialState } from "../domain/timer";
import type { TimerState } from "../domain/types";
import {
  createMemoryStore,
  deserialize,
  serialize,
} from "./store";

const t0 = 1_700_000_000_000;

function stateWithOpenFocusAndSession(): TimerState {
  const focusEndsAt = t0 + 25 * 60_000;
  return {
    ...initialState(),
    sessions: [
      {
        id: "session-1",
        tagId: "tag-work",
        startedAt: t0 - 30 * 60_000,
        recordedMinutes: 25,
      },
    ],
    cycleCount: 1,
    open: {
      phase: "focus",
      tagId: "tag-work",
      startedAt: t0,
      plannedMinutes: 25,
      focusEndsAt,
    },
  };
}

describe("serialize / deserialize", () => {
  it("round-trips open focus without shifting focusEndsAt", () => {
    const state = stateWithOpenFocusAndSession();
    const focusEndsAt = state.open!.focusEndsAt;
    const roundTripped = deserialize(serialize(state));
    expect(roundTripped.open?.focusEndsAt).toBe(focusEndsAt);
    expect(roundTripped).toEqual(state);
  });

  it("throws on an empty string", () => {
    expect(() => deserialize("")).toThrow();
  });

  it("throws on unknown file version", () => {
    const raw = JSON.stringify({ version: 2, state: initialState() });
    expect(() => deserialize(raw)).toThrow();
  });
});

describe("createMemoryStore", () => {
  it("loads initial state when no seed was provided", async () => {
    const store = createMemoryStore();
    await expect(store.load()).resolves.toEqual(initialState());
  });

  it("preserves open session after save and load", async () => {
    const state = stateWithOpenFocusAndSession();
    const store = createMemoryStore();
    await store.save(state);
    await expect(store.load()).resolves.toEqual(state);
  });
});
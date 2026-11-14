import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialState, reduce } from "../domain/timer";
import type { TimerAction, TimerState } from "../domain/types";
import { useTimer, type TimerPorts } from "./useTimer";

const T0 = 1_700_000_000_000;

interface Harness {
  ports: TimerPorts;
  saved: TimerState[];
  trays: string[];
  played: string[];
  notified: string[];
  emitted: { state: TimerState; now: number }[];
  actions: TimerAction[];
  autostart: boolean[];
  emit: (event: "timer-action" | "timer-tick" | "timer-state", payload?: unknown) => void;
}

function createHarness(options?: {
  load?: TimerState;
  now?: () => number;
  loadImpl?: () => Promise<TimerState>;
}): Harness {
  const saved: TimerState[] = [];
  const trays: string[] = [];
  const played: string[] = [];
  const notified: string[] = [];
  const emitted: { state: TimerState; now: number }[] = [];
  const actions: TimerAction[] = [];
  const autostart: boolean[] = [];
  const handlers = new Map<string, (payload: unknown) => void>();

  const ports: TimerPorts = {
    load:
      options?.loadImpl ?? (async () => structuredClone(options?.load ?? initialState())),
    save: async (state) => {
      saved.push(structuredClone(state));
    },
    setTray: async (status) => {
      trays.push(status.menuPauseLabel ?? "");
    },
    play: (sound) => {
      played.push(sound);
    },
    notify: (plan) => {
      notified.push(plan.id);
    },
    emitState: (payload) => {
      emitted.push(structuredClone(payload));
    },
    emitAction: (action) => {
      actions.push(action);
    },
    listen: (event, handler) => {
      handlers.set(event, handler);
      return () => {
        handlers.delete(event);
      };
    },
    syncAutostart: async (enabled) => {
      autostart.push(enabled);
    },
    now: options?.now ?? (() => T0),
  };

  return {
    ports,
    saved,
    trays,
    played,
    notified,
    emitted,
    actions,
    autostart,
    emit(event, payload) {
      handlers.get(event)?.(payload);
    },
  };
}

describe("owner clock", () => {
  it("saves, updates the tray, emits state, and syncs autostart", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useTimer("owner", harness.ports));
    await waitFor(() => expect(harness.autostart).toEqual([true]));
    expect(harness.saved.length).toBeGreaterThan(0);
    expect(harness.trays.length).toBeGreaterThan(0);
    expect(harness.emitted[harness.emitted.length - 1]?.state.open).toBeNull();
    expect(result.current.state.open).toBeNull();
  });

  it("reduces start from the panel and keeps timer-state from rewriting it", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useTimer("owner", harness.ports));
    await waitFor(() => expect(harness.saved.length).toBeGreaterThan(0));
    act(() => {
      result.current.dispatch({ type: "start" });
    });
    await waitFor(() => expect(harness.trays[harness.trays.length - 1]).toBe("Пауза"));
    expect(result.current.state.open?.phase).toBe("focus");
    expect(harness.emitted[harness.emitted.length - 1]?.state.open?.phase).toBe("focus");

    const started = reduce(initialState(), { type: "start" }, T0);
    act(() => {
      harness.emit("timer-state", { state: started, now: T0 + 5_000 });
    });
    expect(result.current.now).toBe(T0);
    expect(result.current.state.open?.startedAt).toBe(T0);
  });

  it("applies a rust tick and a day action through the same reduce", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useTimer("owner", harness.ports));
    await waitFor(() => expect(harness.saved.length).toBeGreaterThan(0));
    act(() => {
      harness.emit("timer-action", { type: "start" });
    });
    await waitFor(() => expect(result.current.state.open?.phase).toBe("focus"));
    const saves = harness.saved.length;
    act(() => {
      harness.emit("timer-tick");
    });
    await waitFor(() => expect(harness.saved.length).toBeGreaterThan(saves));
    expect(result.current.state.open?.phase).toBe("focus");
  });

  it("plays and notifies once, saves the alert, then ack-alert", async () => {
    const started = reduce(initialState(), { type: "start" }, T0);
    const harness = createHarness({
      load: started,
      now: () => T0 + 25 * 60_000,
    });
    renderHook(() => useTimer("owner", harness.ports));
    await waitFor(() => {
      expect(harness.played).toEqual(["focus-end"]);
      expect(harness.saved[harness.saved.length - 1]?.pendingAlert).toBeNull();
    });
    expect(harness.notified).toEqual(["focus-ended"]);
    expect(harness.saved.some((state) => state.pendingAlert === "focus-ended")).toBe(
      true,
    );

    const saves = harness.saved.length;
    act(() => {
      harness.emit("timer-tick");
    });
    await waitFor(() => expect(harness.saved.length).toBeGreaterThan(saves));
    expect(harness.played).toEqual(["focus-end"]);
    expect(harness.notified).toEqual(["focus-ended"]);
  });

  it("skips the sound when sound is off and the notification when notifications are off", async () => {
    const started = reduce(initialState(), { type: "start" }, T0);
    const quiet = {
      ...started,
      settings: {
        ...started.settings,
        soundEnabled: false,
        notificationsEnabled: true,
      },
    };
    const soundOff = createHarness({
      load: quiet,
      now: () => T0 + 25 * 60_000,
    });
    const first = renderHook(() => useTimer("owner", soundOff.ports));
    await waitFor(() => expect(soundOff.notified).toEqual(["focus-ended"]));
    expect(soundOff.played).toEqual([]);
    first.unmount();

    const silent = {
      ...started,
      settings: {
        ...started.settings,
        soundEnabled: true,
        notificationsEnabled: false,
      },
    };
    const notesOff = createHarness({
      load: silent,
      now: () => T0 + 25 * 60_000,
    });
    renderHook(() => useTimer("owner", notesOff.ports));
    await waitFor(() => expect(notesOff.played).toEqual(["focus-end"]));
    expect(notesOff.notified).toEqual([]);
  });

  it("does not publish the blank initial state over sessions still loading", async () => {
    const loaded: TimerState = {
      ...initialState(),
      cycleCount: 1,
      sessions: [
        {
          id: "session-1",
          tagId: "tag-work",
          startedAt: T0 - 30 * 60_000,
          recordedMinutes: 25,
        },
      ],
    };
    let resolveLoad: (state: TimerState) => void = () => {};
    const gate = new Promise<TimerState>((resolve) => {
      resolveLoad = resolve;
    });
    const harness = createHarness({
      loadImpl: () => gate,
    });
    const { result } = renderHook(() => useTimer("owner", harness.ports));

    act(() => {
      result.current.dispatch({ type: "start" });
      harness.emit("timer-action", { type: "pause" });
    });

    await act(async () => {
      resolveLoad(loaded);
    });

    await waitFor(() => expect(harness.saved.length).toBeGreaterThan(0));
    for (const state of harness.saved) {
      expect(state.sessions).toEqual(loaded.sessions);
    }
    await waitFor(() => expect(result.current.state.open?.phase).toBe("paused-focus"));
    expect(result.current.state.sessions).toEqual(loaded.sessions);
  });
});

describe("mirror window", () => {
  it("follows timer-state and sends clicks back without ticking or saving", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useTimer("mirror", harness.ports));
    const started = reduce(initialState(), { type: "start" }, T0);
    act(() => {
      harness.emit("timer-state", { state: started, now: T0 + 1_000 });
    });
    await waitFor(() => expect(result.current.state.open?.phase).toBe("focus"));
    expect(result.current.now).toBe(T0 + 1_000);

    act(() => {
      harness.emit("timer-tick");
    });
    expect(harness.saved).toEqual([]);
    expect(harness.played).toEqual([]);

    act(() => {
      result.current.dispatch({ type: "pause" });
    });
    expect(harness.actions).toEqual([{ type: "pause" }]);
    expect(harness.saved).toEqual([]);
    expect(result.current.state.open?.phase).toBe("focus");
  });
});

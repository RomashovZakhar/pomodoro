import { useCallback, useEffect, useRef, useState } from "react";
import { derive, initialState, reduce } from "../domain/timer";
import type { TimerAction, TimerState } from "../domain/types";
import { alertPlan, type AlertPlan } from "../shell/alerts";
import { toTrayStatus, type TrayStatus } from "../shell/status";

export type TimerRole = "owner" | "mirror";

const ACTION_TYPES = new Set<TimerAction["type"]>([
  "start",
  "pause",
  "resume",
  "surrender",
  "tick",
  "ack-alert",
  "add-overtime",
  "take-break",
  "skip-break",
  "select-tag",
  "set-focus-minutes",
  "create-tag",
  "update-tag",
  "archive-tag",
  "update-settings",
  "delete-session",
]);

export interface TimerPorts {
  load: () => Promise<TimerState>;
  save: (state: TimerState) => Promise<void>;
  setTray: (status: TrayStatus) => Promise<void>;
  play: (sound: AlertPlan["sound"]) => void;
  notify: (plan: AlertPlan) => void;
  emitState: (payload: { state: TimerState; now: number }) => void;
  emitAction: (action: TimerAction) => void;
  listen: (
    event: "timer-action" | "timer-tick" | "timer-state",
    handler: (payload: unknown) => void,
  ) => void | (() => void) | Promise<void | (() => void)>;
  syncAutostart: (enabled: boolean) => Promise<void>;
  now: () => number;
}

function isTimerAction(payload: unknown): payload is TimerAction {
  if (!payload || typeof payload !== "object") return false;
  const type = (payload as { type?: unknown }).type;
  return typeof type === "string" && ACTION_TYPES.has(type as TimerAction["type"]);
}

function isStatePayload(
  payload: unknown,
): payload is { state: TimerState; now: number } {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as { state?: unknown; now?: unknown };
  return typeof record.now === "number" && !!record.state && typeof record.state === "object";
}

export function useTimer(role: TimerRole, ports: TimerPorts) {
  const portsRef = useRef(ports);
  portsRef.current = ports;
  const [state, setState] = useState<TimerState>(() => initialState());
  const [now, setNow] = useState(() => ports.now());
  const stateRef = useRef(state);
  const autostartRef = useRef<boolean | null>(null);
  const installedRef = useRef(false);
  const [installed, setInstalled] = useState(false);
  const chain = useRef(Promise.resolve());

  const publish = useCallback(async (action: TimerAction) => {
    if (!installedRef.current) return;
    const currentPorts = portsRef.current;
    const at = currentPorts.now();
    const reduced = reduce(stateRef.current, action, at);
    await currentPorts.save(reduced);
    let visible = reduced;
    const plan = alertPlan(reduced);
    if (plan) {
      if (reduced.settings.soundEnabled) currentPorts.play(plan.sound);
      if (reduced.settings.notificationsEnabled) currentPorts.notify(plan);
      visible = reduce(reduced, { type: "ack-alert" }, at);
      await currentPorts.save(visible);
    }
    stateRef.current = visible;
    setState(visible);
    setNow(at);
    currentPorts.emitState({ state: visible, now: at });
    if (autostartRef.current !== visible.settings.launchAtLogin) {
      autostartRef.current = visible.settings.launchAtLogin;
      try {
        await currentPorts.syncAutostart(visible.settings.launchAtLogin);
      } catch (error) {
        console.error(error);
      }
    }
    await currentPorts.setTray(toTrayStatus(derive(visible, at)));
  }, []);

  const enqueue = useCallback(
    (action: TimerAction) => {
      chain.current = chain.current.then(() => publish(action)).catch((error: unknown) => {
        console.error(error);
      });
    },
    [publish],
  );

  const dispatch = useCallback(
    (action: TimerAction) => {
      if (role === "mirror") {
        portsRef.current.emitAction(action);
        return;
      }
      enqueue(action);
    },
    [enqueue, role],
  );

  useEffect(() => {
    if (role !== "owner") return;
    let cancelled = false;
    const stops: Array<() => void> = [];

    const track = (stop: void | (() => void) | Promise<void | (() => void)>) => {
      void Promise.resolve(stop).then((unlisten) => {
        if (typeof unlisten !== "function") return;
        if (cancelled) unlisten();
        else stops.push(unlisten);
      });
    };

    chain.current = chain.current
      .then(async () => {
        const loaded = await portsRef.current.load();
        if (cancelled) return;
        stateRef.current = loaded;
        installedRef.current = true;
        setState(loaded);
        setInstalled(true);
        await publish({ type: "tick" });
      })
      .catch((error: unknown) => {
        console.error(error);
      });

    track(
      portsRef.current.listen("timer-tick", () => {
        if (!cancelled) enqueue({ type: "tick" });
      }),
    );
    track(
      portsRef.current.listen("timer-action", (payload) => {
        if (cancelled || !isTimerAction(payload)) return;
        enqueue(payload);
      }),
    );

    return () => {
      cancelled = true;
      installedRef.current = false;
      for (const stop of stops) stop();
    };
  }, [enqueue, publish, role]);

  useEffect(() => {
    if (role !== "mirror") return;
    let cancelled = false;
    const stops: Array<() => void> = [];
    void Promise.resolve(
      portsRef.current.listen("timer-state", (payload) => {
        if (!isStatePayload(payload)) return;
        stateRef.current = payload.state;
        setState(payload.state);
        setNow(payload.now);
      }),
    ).then((unlisten) => {
      if (typeof unlisten !== "function") return;
      if (cancelled) unlisten();
      else stops.push(unlisten);
    });
    return () => {
      cancelled = true;
      for (const stop of stops) stop();
    };
  }, [role]);

  const ready = role !== "owner" || installed;
  return { state, now, dispatch, ready };
}

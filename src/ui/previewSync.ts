import { initialState } from "../domain/timer";
import { createPreviewMailbox, type PreviewAction } from "./previewMailbox";
import type { TimerPorts } from "./useTimer";

export { createPreviewMailbox };
export type { PreviewAction };

export function startPreviewActionPump(
  onAction: (action: unknown) => void,
  options?: { fetchImpl?: typeof fetch; intervalMs?: number },
): () => void {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const intervalMs = options?.intervalMs ?? 300;
  let stopped = false;
  let since = -1;

  const run = async () => {
    while (!stopped) {
      try {
        const response = await fetchImpl(`/__pomodoro/action?since=${since}`);
        if (response.ok) {
          const body = (await response.json()) as { cursor: number; actions: PreviewAction[] };
          since = body.cursor;
          for (const item of body.actions) onAction(item.action);
        }
      } catch {
        // The dev server is absent outside `tauri dev`.
      }
      if (stopped) return;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  };

  void run();
  return () => {
    stopped = true;
  };
}

export function startPreviewStatePump(
  onState: (payload: unknown) => void,
  options?: { fetchImpl?: typeof fetch; intervalMs?: number },
): () => void {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const intervalMs = options?.intervalMs ?? 300;
  let stopped = false;

  const run = async () => {
    while (!stopped) {
      try {
        const response = await fetchImpl("/__pomodoro/state");
        if (response.ok) {
          const body = (await response.json()) as unknown;
          if (body) onState(body);
        }
      } catch {
        // The dev server is absent outside `tauri dev`.
      }
      if (stopped) return;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  };

  void run();
  return () => {
    stopped = true;
  };
}

export async function publishPreviewState(payload: unknown): Promise<void> {
  await fetch("/__pomodoro/state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function publishPreviewAction(action: unknown): Promise<void> {
  await fetch("/__pomodoro/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action),
  });
}

export function createPreviewPorts(): TimerPorts {
  return {
    load: async () => initialState(),
    save: async () => {},
    setTray: async () => {},
    play: () => {},
    notify: () => {},
    emitState: (payload) => {
      void publishPreviewState(payload).catch(() => {});
    },
    emitAction: (action) => {
      void publishPreviewAction(action).catch(() => {});
    },
    listen: (event, handler) => {
      if (event === "timer-state") return startPreviewStatePump(handler);
      if (event === "timer-action") return startPreviewActionPump(handler);
      return () => {};
    },
    syncAutostart: async () => {},
    now: () => Date.now(),
  };
}

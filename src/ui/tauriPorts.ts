import { invoke } from "@tauri-apps/api/core";
import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { disable, enable } from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AlertPlan } from "../shell/alerts";
import { createTauriStore } from "../storage/store";
import { publishPreviewState, startPreviewActionPump } from "./previewSync";
import type { TimerPorts } from "./useTimer";

const store = createTauriStore();
let notificationClicks: Promise<void> | null = null;

function watchNotificationClicks(): Promise<void> {
  if (!notificationClicks) {
    notificationClicks = onAction(() => {
      void invoke("show_panel");
    }).then(() => undefined);
  }
  return notificationClicks;
}

async function playShellSound(name: AlertPlan["sound"]): Promise<void> {
  const bytes = await invoke<number[]>("read_alert_sound", { name });
  const blob = new Blob([Uint8Array.from(bytes)], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  await audio.play();
}

async function deliverNotification(plan: AlertPlan): Promise<void> {
  await watchNotificationClicks();
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (!granted) return;
  sendNotification({ title: plan.title, body: plan.body, silent: true });
}

export function createTauriPorts(): TimerPorts {
  void watchNotificationClicks();
  return {
    load: () => store.load(),
    save: (state) => store.save(state),
    setTray: (status) => invoke("set_tray_status", { status }),
    play: (sound) => {
      void playShellSound(sound).catch((error: unknown) => {
        console.error(error);
      });
    },
    notify: (plan) => {
      void deliverNotification(plan).catch((error: unknown) => {
        console.error(error);
      });
    },
    emitState: (payload) => {
      void emit("timer-state", payload);
      if (import.meta.env.DEV) {
        void publishPreviewState(payload).catch(() => {});
      }
    },
    emitAction: (action) => {
      void emitTo("panel", "timer-action", action);
    },
    listen: (event, handler) => {
      const unlisten = listen(event, (message) => handler(message.payload));
      if (!import.meta.env.DEV || event !== "timer-action") return unlisten;
      const stopPump = startPreviewActionPump(handler);
      return Promise.resolve(unlisten).then((stop) => () => {
        stopPump();
        if (typeof stop === "function") stop();
      });
    },
    syncAutostart: async (enabled) => {
      if (enabled) await enable();
      else await disable();
    },
    now: () => Date.now(),
  };
}

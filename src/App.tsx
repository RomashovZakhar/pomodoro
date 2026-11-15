import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { DayWindow } from "./ui/DayWindow";
import { Panel } from "./ui/Panel";
import { createPreviewPorts } from "./ui/previewSync";
import { createTauriPorts } from "./ui/tauriPorts";
import { useTimer } from "./ui/useTimer";
import "./ui/theme.css";

function detectPlatform(userAgent: string): "windows" | "macos" | "linux" {
  if (userAgent.includes("Windows")) return "windows";
  if (userAgent.includes("Mac")) return "macos";
  return "linux";
}

function hasTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function App() {
  const [label, setLabel] = useState<"panel" | "day" | null>(null);
  const ports = useMemo(() => (hasTauri() ? createTauriPorts() : createPreviewPorts()), []);
  const role = label === "panel" ? "owner" : "mirror";
  const timer = useTimer(role, ports);

  useEffect(() => {
    const next = (() => {
      if (new URLSearchParams(window.location.search).get("window") === "day") {
        return "day" as const;
      }
      try {
        return getCurrentWebview().label === "day" ? "day" : "panel";
      } catch {
        return "panel" as const;
      }
    })();
    document.documentElement.dataset.window = next;
    setLabel(next);
  }, []);

  if (label === null || (label === "panel" && !timer.ready)) return null;

  if (label === "day") {
    return (
      <DayWindow
        state={timer.state}
        now={timer.now}
        platform={detectPlatform(navigator.userAgent)}
        onAction={timer.dispatch}
      />
    );
  }

  return (
    <Panel
      state={timer.state}
      now={timer.now}
      platform={detectPlatform(navigator.userAgent)}
      onAction={timer.dispatch}
      onOpenDay={() => {
        void invoke("show_day");
      }}
    />
  );
}

export default App;

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { DayWindow } from "./ui/DayWindow";
import { Panel } from "./ui/Panel";
import { createTauriPorts } from "./ui/tauriPorts";
import { useTimer } from "./ui/useTimer";
import "./ui/theme.css";

function detectPlatform(userAgent: string): "windows" | "macos" | "linux" {
  if (userAgent.includes("Windows")) return "windows";
  if (userAgent.includes("Mac")) return "macos";
  return "linux";
}

function App() {
  const [label, setLabel] = useState<"panel" | "day" | null>(null);
  const ports = useMemo(() => createTauriPorts(), []);
  const role = label === "panel" ? "owner" : "mirror";
  const timer = useTimer(role, ports);

  useEffect(() => {
    try {
      const current = getCurrentWebview().label;
      setLabel(current === "day" ? "day" : "panel");
    } catch {
      setLabel("panel");
    }
  }, []);

  if (label === null) return null;

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
      onAction={timer.dispatch}
      onOpenDay={() => {
        void invoke("show_day");
      }}
    />
  );
}

export default App;

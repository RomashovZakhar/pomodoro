import { useEffect } from "react";
import type { Theme } from "../domain/types";

const WINDOW_BG = {
  dark: "#12141a",
  light: "#f3f1ec",
} as const;

function paintNativeWindow(next: keyof typeof WINDOW_BG) {
  if (document.documentElement.dataset.window !== "day") return;
  void import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) =>
      getCurrentWindow().setBackgroundColor(WINDOW_BG[next]),
    )
    .catch(() => undefined);
}

export function useAppTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (next: keyof typeof WINDOW_BG) => {
      root.dataset.theme = next;
      paintNativeWindow(next);
    };
    if (theme !== "system") {
      apply(theme);
      return;
    }

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) {
      apply("dark");
      return;
    }

    const onChange = (event: MediaQueryListEvent) => {
      apply(event.matches ? "dark" : "light");
    };
    apply(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}

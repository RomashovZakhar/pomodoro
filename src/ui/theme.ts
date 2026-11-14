import { useEffect } from "react";
import type { Theme } from "../domain/types";

export function useAppTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme !== "system") {
      root.dataset.theme = theme;
      return;
    }

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) {
      root.dataset.theme = "dark";
      return;
    }

    const apply = (matches: boolean) => {
      root.dataset.theme = matches ? "dark" : "light";
    };
    apply(media.matches);
    const onChange = (event: MediaQueryListEvent) => {
      apply(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { initialState, reduce } from "../domain/timer";
import type { TimerState } from "../domain/types";
import { Panel } from "./Panel";

declare const process: { cwd(): string };

const T0 = 1_700_000_000_000;

function injectTheme() {
  const css = readFileSync(`${process.cwd()}/src/ui/theme.css`, "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

function focusState(): { state: TimerState; now: number } {
  return {
    state: reduce(initialState(), { type: "start" }, T0),
    now: T0 + 88_000,
  };
}

function overtimeState(): { state: TimerState; now: number } {
  const now = T0 + 25 * 60_000 + 192_000;
  let state = reduce(initialState(), { type: "start" }, T0);
  state = reduce(state, { type: "tick" }, now);
  state = reduce(state, { type: "ack-alert" }, now);
  return { state, now };
}

function breakState(): { state: TimerState; now: number } {
  const now = T0 + 25 * 60_000;
  let state = reduce(initialState(), { type: "start" }, T0);
  state = reduce(state, { type: "tick" }, now);
  state = reduce(state, { type: "ack-alert" }, now);
  state = reduce(state, { type: "take-break" }, now);
  return { state, now };
}

function mockColorScheme(matchesDark: boolean) {
  let dark = matchesDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  window.matchMedia = ((query: string) => ({
    matches: query.includes("dark") ? dark : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: EventListener) => {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
    },
    removeEventListener: (_type: string, listener: EventListener) => {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
    },
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return {
    preferDark(next: boolean) {
      dark = next;
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
  };
}

beforeAll(() => {
  injectTheme();
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("idle panel", () => {
  it("shows 25:00, Работа, and Начать without settings or ambient sounds", () => {
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    expect(screen.getByText("25:00")).toBeTruthy();
    expect(screen.getByText("Работа")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Начать" })).toBeTruthy();
    expect(screen.queryByText("Настройки")).toBeNull();
    expect(screen.queryByText("Дождь")).toBeNull();
    expect(screen.queryByText("Океан")).toBeNull();
  });

  it("starts the selected tag", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Panel state={initialState()} now={T0} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Начать" }));
    expect(onAction).toHaveBeenCalledWith({ type: "start" });
  });
});

describe("focus panel", () => {
  it("offers Сдаться before zero", () => {
    const { state, now } = focusState();
    render(<Panel state={state} now={now} onAction={() => {}} />);
    expect(screen.getByRole("button", { name: "Сдаться" })).toBeTruthy();
    expect(screen.getByText("23:32")).toBeTruthy();
  });

  it("surrenders when Сдаться is pressed", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { state, now } = focusState();
    render(<Panel state={state} now={now} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Сдаться" }));
    expect(onAction).toHaveBeenCalledWith({ type: "surrender" });
  });
});

describe("overtime panel", () => {
  it("shows add, break, and pause without a minute field or Сдаться", () => {
    const { state, now } = overtimeState();
    const { container } = render(
      <Panel state={state} now={now} onAction={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Добавить 4 мин" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перерыв" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Пауза" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Сдаться" })).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("records overtime or starts the planned break", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { state, now } = overtimeState();
    render(<Panel state={state} now={now} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Добавить 4 мин" }));
    await user.click(screen.getByRole("button", { name: "Перерыв" }));
    await user.click(screen.getByRole("button", { name: "Пауза" }));
    expect(onAction).toHaveBeenNthCalledWith(1, { type: "add-overtime" });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: "take-break" });
    expect(onAction).toHaveBeenNthCalledWith(3, { type: "pause" });
  });
});

describe("break panel", () => {
  it("shows the countdown and Пропустить", () => {
    const { state, now } = breakState();
    render(<Panel state={state} now={now} onAction={() => {}} />);
    expect(screen.getByText("05:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Пропустить" })).toBeTruthy();
  });

  it("skips the break", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { state, now } = breakState();
    render(<Panel state={state} now={now} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Пропустить" }));
    expect(onAction).toHaveBeenCalledWith({ type: "skip-break" });
  });
});

describe("space", () => {
  it("pauses a running focus and resumes a pause", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const running = focusState();
    const { unmount } = render(
      <Panel state={running.state} now={running.now} onAction={onAction} />,
    );
    await user.keyboard(" ");
    expect(onAction).toHaveBeenCalledWith({ type: "pause" });

    unmount();
    onAction.mockClear();
    let paused = reduce(initialState(), { type: "start" }, T0);
    paused = reduce(paused, { type: "pause" }, T0 + 1_000);
    render(<Panel state={paused} now={T0 + 1_000} onAction={onAction} />);
    await user.keyboard(" ");
    expect(onAction).toHaveBeenCalledWith({ type: "resume" });
  });

  it("does nothing while idle", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Panel state={initialState()} now={T0} onAction={onAction} />);
    await user.keyboard(" ");
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("theme", () => {
  it("paints the brief dark tokens and 72px digits", () => {
    const state = reduce(
      initialState(),
      { type: "update-settings", settings: { theme: "dark" } },
      T0,
    );
    render(<Panel state={state} now={T0} onAction={() => {}} />);
    const shell = document.querySelector(".app-shell") as HTMLElement;
    const card = document.querySelector(".card") as HTMLElement;
    expect(getComputedStyle(shell).backgroundColor).toBe("rgb(26, 28, 35)");
    expect(getComputedStyle(shell).color).toBe("rgb(244, 241, 234)");
    expect(getComputedStyle(card).backgroundColor).toBe("rgb(36, 39, 51)");
    expect(getComputedStyle(screen.getByText("25:00")).fontSize).toBe("72px");
  });

  it("paints the brief light tokens", () => {
    const state = reduce(
      initialState(),
      { type: "update-settings", settings: { theme: "light" } },
      T0,
    );
    render(<Panel state={state} now={T0} onAction={() => {}} />);
    const shell = document.querySelector(".app-shell") as HTMLElement;
    const card = document.querySelector(".card") as HTMLElement;
    expect(getComputedStyle(shell).backgroundColor).toBe("rgb(246, 241, 232)");
    expect(getComputedStyle(shell).color).toBe("rgb(42, 38, 34)");
    expect(getComputedStyle(card).backgroundColor).toBe("rgb(255, 253, 248)");
  });

  it("follows prefers-color-scheme while theme is system", () => {
    const scheme = mockColorScheme(false);
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    expect(document.documentElement.dataset.theme).toBe("light");
    scheme.preferDark(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

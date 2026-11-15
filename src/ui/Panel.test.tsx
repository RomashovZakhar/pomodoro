import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
import { initialState, reduce } from "../domain/timer";
import type { TimerState } from "../domain/types";
import { Panel } from "./Panel";

declare const process: { cwd(): string };

const T0 = 1_700_000_000_000;
const HOLD_WAIT = 760;

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
    expect(screen.queryByRole("heading", { name: "Настройки" })).toBeNull();
    expect(screen.queryByText("Дождь")).toBeNull();
    expect(screen.queryByText("Океан")).toBeNull();
  });

  it("sets a length from the ruler opened by the clock", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Panel state={initialState()} now={T0} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "25:00" }));
    const slider = screen.getByRole("slider", { name: "Минуты" });
    expect(slider.getAttribute("aria-valuenow")).toBe("25");
    slider.focus();
    for (let step = 0; step < 13; step += 1) {
      await user.keyboard("{ArrowLeft}");
    }
    expect(slider.getAttribute("aria-valuenow")).toBe("12");
    await user.click(screen.getByRole("button", { name: "Готово" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "set-focus-minutes",
      minutes: 12,
    });
    expect(screen.queryByRole("slider", { name: "Минуты" })).toBeNull();
  });

  it("closes the ruler on Escape without hiding the panel or saving", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Panel state={initialState()} now={T0} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "25:00" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Длина фокуса" })).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("picks another tag from the tag sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Panel state={initialState()} now={T0} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: /Работа/ }));
    const sheet = screen.getByRole("dialog", { name: "Тег" });
    const picked = within(sheet).getByRole("button", { name: /Учёба/ });
    expect(picked.getAttribute("aria-pressed")).toBe("false");
    await user.click(picked);
    expect(onAction).toHaveBeenCalledWith({
      type: "select-tag",
      tagId: "tag-study",
    });
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
  it("shows only the clock and a hold hint", () => {
    const { state, now } = focusState();
    render(<Panel state={state} now={now} onAction={() => {}} />);
    expect(screen.getByText("23:32")).toBeTruthy();
    expect(screen.getByText("Удерживайте, чтобы закончить")).toBeTruthy();
    expect(document.querySelector(".hold-track")).toBeNull();
    const face = document.querySelector(".timer-face") as HTMLElement;
    fireEvent.pointerDown(face, { clientX: 30, clientY: 30, button: 0, pointerId: 1 });
    expect(document.querySelector(".hold-track")).toBeTruthy();
    fireEvent.pointerUp(face, { clientX: 30, clientY: 30, pointerId: 1 });
    expect(document.querySelector(".hold-track")).toBeNull();
    expect(screen.queryByRole("button", { name: "Пауза" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Сдаться" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Работа" })).toBeNull();
  });

  it("surrenders when the session is held", () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    const { state, now } = focusState();
    render(<Panel state={state} now={now} onAction={onAction} />);
    const face = document.querySelector(".timer-face") as HTMLElement;
    fireEvent.pointerDown(face, { clientX: 30, clientY: 30, button: 0, pointerId: 1 });
    vi.advanceTimersByTime(HOLD_WAIT);
    expect(onAction).toHaveBeenCalledWith({ type: "surrender" });
    vi.useRealTimers();
  });
});

describe("overtime panel", () => {
  it("puts the extra time in a button and keeps the break", () => {
    const { state, now } = overtimeState();
    const { container } = render(
      <Panel state={state} now={now} onAction={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "3 мин" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перерыв" })).toBeTruthy();
    expect(screen.queryByText("+03:12")).toBeNull();
    expect(screen.queryByRole("button", { name: "Пауза" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Сдаться" })).toBeNull();
    expect(container.querySelector(".home-stage input")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("records overtime or starts the planned break", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { state, now } = overtimeState();
    render(<Panel state={state} now={now} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "3 мин" }));
    await user.click(screen.getByRole("button", { name: "Перерыв" }));
    expect(onAction).toHaveBeenNthCalledWith(1, { type: "add-overtime" });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: "take-break" });
  });
});

describe("break panel", () => {
  it("shows the countdown without a skip button", () => {
    const { state, now } = breakState();
    render(<Panel state={state} now={now} onAction={() => {}} />);
    expect(screen.getByText("05:00")).toBeTruthy();
    expect(screen.getByText("Удерживайте, чтобы закончить")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Пропустить" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Пауза" })).toBeNull();
  });

  it("skips the break when it is held", () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    const { state, now } = breakState();
    render(<Panel state={state} now={now} onAction={onAction} />);
    const face = document.querySelector(".timer-face") as HTMLElement;
    fireEvent.pointerDown(face, { clientX: 30, clientY: 30, button: 0, pointerId: 1 });
    vi.advanceTimersByTime(HOLD_WAIT);
    expect(onAction).toHaveBeenCalledWith({ type: "skip-break" });
    vi.useRealTimers();
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

function swipe(dx: number, dy: number) {
  const deck = document.querySelector(".deck") as HTMLElement;
  fireEvent.pointerDown(deck, { clientX: 40, clientY: 40, button: 0, pointerId: 1 });
  fireEvent.pointerMove(deck, { clientX: 40 + dx, clientY: 40 + dy, pointerId: 1 });
  fireEvent.pointerUp(deck, { clientX: 40 + dx, clientY: 40 + dy, pointerId: 1 });
}

describe("panel swipes", () => {
  it("opens the summary below and returns without closing the widget", async () => {
    const user = userEvent.setup();
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    swipe(0, -90);
    expect(screen.getByRole("heading", { name: "Сводка" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("heading", { name: "Сводка" })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Начать" })).toBeTruthy();
  });

  it("swipes from the clock without opening the ruler", () => {
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    const clock = screen.getByRole("button", { name: "25:00" });
    fireEvent.pointerDown(clock, { clientX: 80, clientY: 80, button: 0, pointerId: 1 });
    fireEvent.pointerMove(clock, { clientX: 80 - 90, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(clock, { clientX: 80 - 90, clientY: 80, pointerId: 1 });
    fireEvent.click(clock);
    expect(screen.getByRole("group", { name: "Лента" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Длина фокуса" })).toBeNull();
  });

  it("opens the calendar to the right and the settings to the left", () => {
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    swipe(-90, 0);
    expect(screen.getByRole("group", { name: "Лента" })).toBeTruthy();
    swipe(90, 0);
    expect(screen.queryByRole("group", { name: "Лента" })).toBeNull();
    swipe(90, 0);
    expect(screen.getByRole("heading", { name: "Настройки" })).toBeTruthy();
    swipe(-90, 0);
    expect(screen.queryByRole("heading", { name: "Настройки" })).toBeNull();
  });
});

describe("panel dismiss", () => {
  it("hides the panel when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    await user.keyboard("{Escape}");
    expect(invoke).toHaveBeenCalledWith("hide_panel");
  });
});

describe("widget shape", () => {
  it("uses one rounded card on a transparent shell", () => {
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    const shell = document.querySelector(".panel") as HTMLElement;
    const card = document.querySelector(".panel-card") as HTMLElement;
    expect(getComputedStyle(shell).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(shell).paddingTop).toBe("0px");
    expect(getComputedStyle(card).borderRadius).toBe("16px");
    expect(getComputedStyle(card).boxShadow).toBe("none");
  });

  it("keeps the card corners when the time ruler is open", async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.window = "panel";
    render(<Panel state={initialState()} now={T0} onAction={() => {}} />);
    await user.click(screen.getByRole("button", { name: "25:00" }));
    const overlay = document.querySelector(".overlay") as HTMLElement;
    expect(getComputedStyle(overlay).borderRadius).toBe("16px");
    expect(getComputedStyle(overlay).overflow).toBe("hidden");
    delete document.documentElement.dataset.window;
  });

  it("configures a short transparent panel window", () => {
    const conf = JSON.parse(
      readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, "utf8"),
    ) as {
      app: {
        windows: Array<{
          label: string;
          transparent?: boolean;
          shadow?: boolean;
          backgroundColor?: string;
          width: number;
          height: number;
        }>;
      };
    };
    const panel = conf.app.windows.find((window) => window.label === "panel");
    expect(panel?.transparent).toBe(true);
    expect(panel?.shadow).toBe(false);
    expect(panel?.backgroundColor).toBeUndefined();
    expect(panel?.width).toBeGreaterThanOrEqual(320);
    expect(panel?.width).toBeLessThanOrEqual(360);
    expect(panel?.height).toBeGreaterThanOrEqual(260);
    expect(panel?.height).toBeLessThanOrEqual(360);
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
    expect(getComputedStyle(shell).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(shell).color).toBe("rgb(244, 241, 234)");
    expect(getComputedStyle(card).backgroundColor).toBe("rgb(28, 31, 39)");
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
    expect(getComputedStyle(shell).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(shell).color).toBe("rgb(28, 30, 36)");
    expect(getComputedStyle(card).backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("follows prefers-color-scheme while theme is system", () => {
    const scheme = mockColorScheme(false);
    const state = reduce(
      initialState(),
      { type: "update-settings", settings: { theme: "system" } },
      T0,
    );
    render(<Panel state={state} now={T0} onAction={() => {}} />);
    expect(document.documentElement.dataset.theme).toBe("light");
    scheme.preferDark(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

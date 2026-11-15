import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WINDOWS_TRAY_HINT } from "../domain/defaults";
import { timeline } from "../domain/timeline";
import { initialState, reduce } from "../domain/timer";
import type { TimerState } from "../domain/types";
import { DayWindow } from "./DayWindow";

const T0 = 1_700_000_000_000;
const DAY = Date.UTC(2026, 10, 15, 8, 0, 0);

function overtimeState(): { state: TimerState; now: number } {
  const now = T0 + 25 * 60_000 + 192_000;
  let state = reduce(initialState(), { type: "start" }, T0);
  state = reduce(state, { type: "tick" }, now);
  state = reduce(state, { type: "ack-alert" }, now);
  return { state, now };
}

function focusState(): { state: TimerState; now: number } {
  return {
    state: reduce(initialState(), { type: "start" }, T0),
    now: T0 + 88_000,
  };
}

function dayWithSession(): TimerState {
  return {
    ...initialState(),
    sessions: [
      {
        id: "sess-1",
        tagId: "tag-work",
        startedAt: DAY,
        recordedMinutes: 50,
      },
    ],
  };
}

afterEach(() => {
  cleanup();
});

function swipe(dx: number, dy: number) {
  const deck = document.querySelector(".deck") as HTMLElement;
  fireEvent.pointerDown(deck, { clientX: 80, clientY: 80, button: 0, pointerId: 1 });
  fireEvent.pointerMove(deck, { clientX: 80 + dx, clientY: 80 + dy, pointerId: 1 });
  fireEvent.pointerUp(deck, { clientX: 80 + dx, clientY: 80 + dy, pointerId: 1 });
}

describe("day window timer", () => {
  it("keeps the timer home quiet until a swipe screen is opened", async () => {
    const user = userEvent.setup();
    const { state, now } = overtimeState();
    render(
      <DayWindow state={state} now={now} platform="linux" onAction={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "3 мин" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перерыв" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Пауза" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Лента" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Короткий перерыв" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Добавить сессию" })).toBeNull();
    expect(screen.queryByText("Добавить сессию")).toBeNull();
    expect(document.querySelector(".tomato-pile")).toBeNull();
    expect(screen.queryByRole("button", { name: "Календарь" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Сводка" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Настройки" })).toBeNull();

    await user.keyboard("{ArrowRight}");
    const timeline = screen.getByRole("group", { name: "Лента" });
    expect(screen.getByText("В этот день сессий не было.")).toBeTruthy();
    expect(within(timeline).getByRole("button", { name: "День" })).toBeTruthy();
    expect(within(timeline).getByRole("button", { name: "Неделя" })).toBeTruthy();

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowDown}");
    const stats = screen.getByRole("group", { name: "Статистика" });
    expect(within(stats).getByRole("button", { name: "День" })).toBeTruthy();
    expect(within(stats).getByRole("button", { name: "Неделя" })).toBeTruthy();
    expect(within(stats).getByRole("button", { name: "Месяц" })).toBeTruthy();
    expect(within(stats).getByRole("button", { name: "Год" })).toBeTruthy();
    expect(document.querySelector(".tomato-pile")).toBeNull();
  });

  it("keeps space for the timer unless a text field is focused", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { state, now } = focusState();
    render(
      <DayWindow state={state} now={now} platform="linux" onAction={onAction} />,
    );
    await user.keyboard("{ArrowLeft}");
    const field = screen.getByLabelText("Новый тег");
    field.focus();
    await user.keyboard(" ");
    expect(onAction).not.toHaveBeenCalled();
    field.blur();
    await user.keyboard(" ");
    expect(onAction).toHaveBeenCalledWith({ type: "pause" });
  });

  it("swipes up to the summary and back, then left to the calendar and back", () => {
    render(
      <DayWindow state={initialState()} now={DAY} platform="linux" onAction={() => {}} />,
    );
    swipe(0, -120);
    expect(screen.getByRole("group", { name: "Статистика" })).toBeTruthy();
    swipe(0, 120);
    expect(screen.queryByRole("group", { name: "Статистика" })).toBeNull();
    swipe(-120, 0);
    expect(screen.getByRole("group", { name: "Лента" })).toBeTruthy();
    swipe(120, 0);
    expect(screen.queryByRole("group", { name: "Лента" })).toBeNull();
  });
});

function weekDayLabel(start: number, zone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: zone,
  }).format(start);
}

describe("week timeline", () => {
  it("shows seven labeled day rows in the week view", async () => {
    const user = userEvent.setup();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = Date.UTC(2026, 10, 15, 12, 0, 0);
    const weekDays = timeline([], initialState().tags, now, "week", zone);
    expect(weekDays).toHaveLength(7);

    const sessionDay = weekDays[3]!;
    const otherSessionDay = weekDays[5]!;
    const emptyDay = weekDays[1]!;
    const sameLocalTime = 10 * 60_000;
    const state: TimerState = {
      ...initialState(),
      sessions: [
        {
          id: "sess-week",
          tagId: "tag-work",
          startedAt: sessionDay.start + sameLocalTime,
          recordedMinutes: 25,
        },
        {
          id: "sess-other-day",
          tagId: "tag-work",
          startedAt: otherSessionDay.start + sameLocalTime,
          recordedMinutes: 25,
        },
      ],
    };

    render(
      <DayWindow state={state} now={now} platform="linux" onAction={() => {}} />,
    );
    await user.keyboard("{ArrowRight}");
    const timelineSection = screen.getByRole("group", { name: "Лента" });
    await user.click(within(timelineSection).getByRole("button", { name: "Неделя" }));

    const labels = weekDays.map((d) => weekDayLabel(d.start, zone));
    expect(new Set(labels).size).toBe(7);
    for (const label of labels) {
      expect(within(timelineSection).getByText(label)).toBeTruthy();
    }

    const deleteButtons = within(timelineSection).getAllByRole("button", {
      name: "Удалить",
    });
    expect(deleteButtons).toHaveLength(2);

    for (const button of deleteButtons) {
      const row = button.closest(".timeline-day");
      expect(row).toBeTruthy();
      const label = within(row as HTMLElement).getByRole("heading", {
        level: 3,
      });
      expect(label.textContent?.length).toBeGreaterThan(0);
    }
    const sessionRow = deleteButtons[0]!.closest(".timeline-day");
    expect(
      within(sessionRow as HTMLElement).getByText(weekDayLabel(sessionDay.start, zone)),
    ).toBeTruthy();
    const otherRow = deleteButtons[1]!.closest(".timeline-day");
    expect(
      within(otherRow as HTMLElement).getByText(
        weekDayLabel(otherSessionDay.start, zone),
      ),
    ).toBeTruthy();

    const emptyRow = within(timelineSection)
      .getByText(weekDayLabel(emptyDay.start, zone))
      .closest(".timeline-day");
    expect(emptyRow).toBeTruthy();
    expect(
      within(emptyRow as HTMLElement).queryByRole("button", {
        name: "Удалить",
      }),
    ).toBeNull();
  });
});

describe("week and tomatoes", () => {
  it("says the week is empty without a tomato pile", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DayWindow
        state={initialState()}
        now={DAY}
        platform="linux"
        onAction={() => {}}
      />,
    );
    await user.keyboard("{ArrowRight}");
    const timeline = screen.getByRole("group", { name: "Лента" });
    await user.click(within(timeline).getByRole("button", { name: "Неделя" }));
    expect(screen.getByText("На этой неделе сессий не было.")).toBeTruthy();
    expect(document.querySelector(".tomato-pile")).toBeNull();
    unmount();

    render(
      <DayWindow
        state={dayWithSession()}
        now={DAY}
        platform="linux"
        onAction={() => {}}
      />,
    );
    expect(document.querySelector(".tomato-pile")).toBeNull();
  });
});

describe("sessions", () => {
  it("deletes a session from the day list", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <DayWindow
        state={dayWithSession()}
        now={DAY}
        platform="linux"
        onAction={onAction}
      />,
    );
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "delete-session",
      sessionId: "sess-1",
    });
  });
});

describe("settings", () => {
  async function openSettings(platform: "windows" | "macos" | "linux") {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <DayWindow
        state={initialState()}
        now={DAY}
        platform={platform}
        onAction={onAction}
      />,
    );
    await user.keyboard("{ArrowLeft}");
    return { user, onAction };
  }

  it("edits breaks, theme, sound, notifications, and autostart", async () => {
    const { user, onAction } = await openSettings("linux");
    expect(screen.getByRole("button", { name: "Короткий перерыв" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Длинный перерыв" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Сессий до длинного" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Тема" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Звук" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Уведомления" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Запуск вместе с системой" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Короткий перерыв" }));
    const slider = screen.getByRole("slider", { name: "Минуты" });
    expect(slider.getAttribute("aria-valuemax")).toBe("30");
    expect(slider.getAttribute("aria-valuenow")).toBe("5");
    slider.focus();
    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
    await user.click(screen.getByRole("button", { name: "Готово" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { shortBreakMinutes: 15 },
    });

    await user.click(screen.getByRole("button", { name: "Тёмная" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { theme: "dark" },
    });

    await user.click(screen.getByRole("switch", { name: "Звук" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { soundEnabled: false },
    });

    await user.click(screen.getByRole("switch", { name: "Уведомления" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { notificationsEnabled: false },
    });

    await user.click(screen.getByRole("switch", { name: "Запуск вместе с системой" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { launchAtLogin: false },
    });
  });

  it("adds, renames, recolors, and archives a tag", async () => {
    const { user, onAction } = await openSettings("linux");
    await user.type(screen.getByLabelText("Новый тег"), "Проект");
    await user.click(screen.getByRole("button", { name: "Цвет новый #6E9A84" }));
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "create-tag",
      name: "Проект",
      color: "#6E9A84",
      focusMinutes: 25,
    });

    const name = screen.getByLabelText("Имя Работа");
    await user.clear(name);
    await user.type(name, "Дедлайн");
    await user.tab();
    expect(onAction).toHaveBeenCalledWith({
      type: "update-tag",
      tagId: "tag-work",
      name: "Дедлайн",
    });

    await user.click(screen.getByRole("button", { name: "Цвет Работа #C46A6A" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-tag",
      tagId: "tag-work",
      name: "Дедлайн",
      color: "#C46A6A",
    });

    await user.click(screen.getByRole("button", { name: "Длина Работа" }));
    const length = screen.getByRole("slider", { name: "Минуты" });
    length.focus();
    await user.keyboard("{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    await user.click(screen.getByRole("button", { name: "Готово" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-tag",
      tagId: "tag-work",
      name: "Дедлайн",
      focusMinutes: 12,
    });

    await user.click(screen.getAllByRole("button", { name: "Убрать" })[0]!);
    expect(onAction).toHaveBeenCalledWith({
      type: "archive-tag",
      tagId: "tag-work",
    });
  });

  it("shows the tray hint only when platform is windows", async () => {
    const windows = await openSettings("windows");
    expect(screen.getByText(WINDOWS_TRAY_HINT)).toBeTruthy();
    cleanup();
    await openSettings("macos");
    expect(screen.queryByText(WINDOWS_TRAY_HINT)).toBeNull();
    void windows;
  });
});

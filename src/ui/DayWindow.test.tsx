import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WINDOWS_TRAY_HINT } from "../domain/defaults";
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

describe("day window timer", () => {
  it("shows the same overtime buttons, the empty day, and both range switches", () => {
    const { state, now } = overtimeState();
    render(
      <DayWindow state={state} now={now} platform="linux" onAction={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Добавить 4 мин" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перерыв" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Пауза" })).toBeTruthy();
    expect(screen.getByText("В этот день сессий не было.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Добавить сессию" })).toBeNull();
    expect(screen.queryByText("Добавить сессию")).toBeNull();

    const timeline = screen.getByRole("group", { name: "Лента" });
    expect(within(timeline).getByRole("button", { name: "День" })).toBeTruthy();
    expect(within(timeline).getByRole("button", { name: "Неделя" })).toBeTruthy();

    const stats = screen.getByRole("group", { name: "Статистика" });
    expect(within(stats).getByRole("button", { name: "День" })).toBeTruthy();
    expect(within(stats).getByRole("button", { name: "Неделя" })).toBeTruthy();
    expect(within(stats).getByRole("button", { name: "Месяц" })).toBeTruthy();
    expect(within(stats).getByRole("button", { name: "Год" })).toBeTruthy();
  });

  it("keeps space for the timer unless a text field is focused", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { state, now } = focusState();
    render(
      <DayWindow state={state} now={now} platform="linux" onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "Настройки" }));
    const field = screen.getByLabelText("Новый тег");
    field.focus();
    await user.keyboard(" ");
    expect(onAction).not.toHaveBeenCalled();
    field.blur();
    await user.keyboard(" ");
    expect(onAction).toHaveBeenCalledWith({ type: "pause" });
  });
});

describe("sessions", () => {
  it("deletes a block and leaves the tomato pile without buttons", async () => {
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
    const pile = screen.getByTestId("tomato-pile");
    expect(pile.childElementCount).toBeGreaterThan(0);
    expect(within(pile).queryAllByRole("button")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Удалить сессию" }));
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
    await user.click(screen.getByRole("button", { name: "Настройки" }));
    return { user, onAction };
  }

  it("edits breaks, theme, sound, notifications, and autostart", async () => {
    const { user, onAction } = await openSettings("linux");
    expect(screen.getByLabelText("Короткий перерыв")).toBeTruthy();
    expect(screen.getByLabelText("Длинный перерыв")).toBeTruthy();
    expect(screen.getByLabelText("Сессий до длинного")).toBeTruthy();
    expect(screen.getByLabelText("Тема")).toBeTruthy();
    expect(screen.getByLabelText("Звук")).toBeTruthy();
    expect(screen.getByLabelText("Уведомления")).toBeTruthy();
    expect(screen.getByLabelText("Запуск вместе с системой")).toBeTruthy();

    await user.clear(screen.getByLabelText("Короткий перерыв"));
    await user.type(screen.getByLabelText("Короткий перерыв"), "10");
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { shortBreakMinutes: 10 },
    });

    await user.selectOptions(screen.getByLabelText("Тема"), "dark");
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { theme: "dark" },
    });

    await user.click(screen.getByLabelText("Звук"));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { soundEnabled: false },
    });

    await user.click(screen.getByLabelText("Уведомления"));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { notificationsEnabled: false },
    });

    await user.click(screen.getByLabelText("Запуск вместе с системой"));
    expect(onAction).toHaveBeenCalledWith({
      type: "update-settings",
      settings: { launchAtLogin: false },
    });
  });

  it("adds, renames, recolors, and archives a tag", async () => {
    const { user, onAction } = await openSettings("linux");
    await user.type(screen.getByLabelText("Новый тег"), "Проект");
    fireEvent.change(screen.getByLabelText("Цвет нового тега"), {
      target: { value: "#5C7A6E" },
    });
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onAction).toHaveBeenCalledWith({
      type: "create-tag",
      name: "Проект",
      color: "#5C7A6E",
    });

    const name = screen.getByLabelText("Имя Работа");
    await user.clear(name);
    await user.type(name, "Дедлайн");
    await user.click(screen.getAllByRole("button", { name: "Переименовать" })[0]!);
    expect(onAction).toHaveBeenCalledWith({
      type: "update-tag",
      tagId: "tag-work",
      name: "Дедлайн",
    });

    fireEvent.change(screen.getByLabelText("Цвет Работа"), {
      target: { value: "#112233" },
    });
    await user.click(screen.getAllByRole("button", { name: "Перекрасить" })[0]!);
    expect(onAction).toHaveBeenCalledWith({
      type: "update-tag",
      tagId: "tag-work",
      name: "Работа",
      color: "#112233",
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

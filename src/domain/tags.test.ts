import { afterEach, describe, expect, it, vi } from "vitest";
import { derive, initialState, reduce } from "./timer";

const t0 = 1_700_000_000_000;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("create-tag", () => {
  it("appends a new tag with a random id", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111",
    );
    const state = reduce(
      initialState(),
      { type: "create-tag", name: "Проект", color: "#112233" },
      t0,
    );
    expect(state.tags).toHaveLength(4);
    expect(state.tags[3]).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Проект",
      color: "#112233",
      focusMinutes: 25,
    });
  });
});

describe("update-tag", () => {
  it("renames a tag for timeline lookup", () => {
    const state = reduce(
      initialState(),
      { type: "update-tag", tagId: "tag-work", name: "Дедлайн" },
      t0,
    );
    const tag = state.tags.find((item) => item.id === "tag-work");
    expect(tag?.name).toBe("Дедлайн");
    expect(derive(state, t0).tagName).toBe("Дедлайн");
  });
});

describe("select-tag", () => {
  it("switches the selected tag when idle", () => {
    const state = reduce(
      initialState(),
      { type: "select-tag", tagId: "tag-study" },
      t0,
    );
    expect(state.selectedTagId).toBe("tag-study");
    expect(derive(state, t0).tagName).toBe("Учёба");
  });

  it("rejects archived tags", () => {
    let state = initialState();
    state = reduce(state, { type: "archive-tag", tagId: "tag-study" }, t0);
    const before = state.selectedTagId;
    state = reduce(state, { type: "select-tag", tagId: "tag-study" }, t0);
    expect(state.selectedTagId).toBe(before);
  });
});

describe("set-focus-minutes", () => {
  it("updates the selected tag and idle clock", () => {
    let state = reduce(
      initialState(),
      { type: "set-focus-minutes", minutes: 50 },
      t0,
    );
    expect(state.tags.find((t) => t.id === "tag-work")?.focusMinutes).toBe(50);
    expect(derive(state, t0).clockLabel).toBe("50:00");

    state = reduce(state, { type: "select-tag", tagId: "tag-study" }, t0);
    state = reduce(state, { type: "select-tag", tagId: "tag-work" }, t0);
    expect(derive(state, t0).clockLabel).toBe("50:00");
  });

  it("rejects minutes outside FOCUS_MINUTE_OPTIONS", () => {
    const before = initialState();
    const state = reduce(
      before,
      { type: "set-focus-minutes", minutes: 12 },
      t0,
    );
    expect(state).toEqual(before);
  });
});

describe("archive-tag", () => {
  it("hides the tag from selection but keeps sessions", () => {
    const withSession: typeof initialState extends () => infer S ? S : never = {
      ...initialState(),
      sessions: [
        {
          id: "sess-1",
          tagId: "tag-study",
          startedAt: t0,
          recordedMinutes: 25,
        },
      ],
    };
    let state = reduce(withSession, { type: "archive-tag", tagId: "tag-study" }, t0);
    const archived = state.tags.find((t) => t.id === "tag-study");
    expect(archived?.archived).toBe(true);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]?.tagId).toBe("tag-study");

    const beforeSelect = state.selectedTagId;
    state = reduce(state, { type: "select-tag", tagId: "tag-study" }, t0);
    expect(state.selectedTagId).toBe(beforeSelect);
  });

  it("rejects archiving the last non-archived tag", () => {
    let state = initialState();
    state = reduce(state, { type: "archive-tag", tagId: "tag-study" }, t0);
    state = reduce(state, { type: "archive-tag", tagId: "tag-own" }, t0);
    const before = state.tags.map((t) => ({ ...t }));
    state = reduce(state, { type: "archive-tag", tagId: "tag-work" }, t0);
    expect(state.tags).toEqual(before);
  });

  it("rejects archiving the tag of an open session", () => {
    let state = reduce(initialState(), { type: "start" }, t0);
    const before = state.tags.map((t) => ({ ...t }));
    state = reduce(state, { type: "archive-tag", tagId: "tag-work" }, t0);
    expect(state.tags).toEqual(before);
  });
});

describe("update-settings", () => {
  it("accepts short break 10, long break 15, and period 3", () => {
    let state = reduce(
      initialState(),
      {
        type: "update-settings",
        settings: {
          shortBreakMinutes: 10,
          longBreakMinutes: 15,
          sessionsUntilLongBreak: 3,
        },
      },
      t0,
    );
    expect(state.settings.shortBreakMinutes).toBe(10);
    expect(state.settings.longBreakMinutes).toBe(15);
    expect(state.settings.sessionsUntilLongBreak).toBe(3);
  });

  it("rejects short break 0", () => {
    const before = initialState();
    const state = reduce(
      before,
      { type: "update-settings", settings: { shortBreakMinutes: 0 } },
      t0,
    );
    expect(state).toEqual(before);
  });

  it("switches theme to dark", () => {
    const state = reduce(
      initialState(),
      { type: "update-settings", settings: { theme: "dark" } },
      t0,
    );
    expect(state.settings.theme).toBe("dark");
  });
});
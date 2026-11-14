import { describe, expect, it } from "vitest";
import type { CompletedSession, Tag } from "./types";
import { initialState, reduce } from "./timer";
import {
  durationLabel,
  emptyDayCopy,
  timeline,
  tomatoScale,
} from "./timeline";

const TIME_ZONE = "Europe/Moscow";

/** 15 ноября 2026, 11:00 по Москве (UTC+3). */
const NOV_15_11_MOSCOW = Date.UTC(2026, 10, 15, 8, 0, 0);

const tags: Tag[] = [
  { id: "tag-work", name: "Работа", color: "#E07A4C", focusMinutes: 25 },
  { id: "tag-study", name: "Учёба", color: "#E0A24C", focusMinutes: 25 },
];

function session(
  overrides: Partial<CompletedSession> & Pick<CompletedSession, "id">,
): CompletedSession {
  return {
    tagId: "tag-work",
    startedAt: NOV_15_11_MOSCOW,
    recordedMinutes: 25,
    ...overrides,
  };
}

describe("durationLabel", () => {
  it("formats minutes under an hour", () => {
    expect(durationLabel(25)).toBe("25 мин");
  });

  it("formats exactly one hour", () => {
    expect(durationLabel(60)).toBe("1 ч");
  });

  it("formats hours and minutes", () => {
    expect(durationLabel(90)).toBe("1 ч 30 мин");
  });
});

describe("emptyDayCopy", () => {
  it("returns the exact empty-day string", () => {
    expect(emptyDayCopy()).toBe("В этот день сессий не было.");
  });
});

describe("tomatoScale", () => {
  it("maps common session lengths", () => {
    expect(tomatoScale(25)).toBe(1);
    expect(tomatoScale(50)).toBe(2);
    expect(tomatoScale(10)).toBe(0.8);
  });
});

describe("timeline day", () => {
  it("builds one block for a session on the anchor day", () => {
    const sessions = [session({ id: "s1" })];
    const days = timeline(sessions, tags, NOV_15_11_MOSCOW, "day", TIME_ZONE);
    expect(days).toHaveLength(1);
    expect(days[0]!.blocks).toHaveLength(1);
    const block = days[0]!.blocks[0]!;
    expect(block.sessionId).toBe("s1");
    expect(block.tagId).toBe("tag-work");
    expect(block.name).toBe("Работа");
    expect(block.color).toBe("#E07A4C");
    expect(block.startedAt).toBe(NOV_15_11_MOSCOW);
    expect(block.endedAt).toBe(NOV_15_11_MOSCOW + 25 * 60_000);
    expect(block.recordedMinutes).toBe(25);
    expect(block.label).toBe("25 мин");
  });

  it("returns zero blocks for a day without sessions", () => {
    const days = timeline([], tags, NOV_15_11_MOSCOW, "day", TIME_ZONE);
    expect(days).toHaveLength(1);
    expect(days[0]!.blocks).toHaveLength(0);
  });

  it("resolves archived tags and missing tags", () => {
    const archived: Tag[] = [
      {
        id: "tag-old",
        name: "Архив",
        color: "#111111",
        focusMinutes: 25,
        archived: true,
      },
    ];
    const sessions = [
      session({ id: "s-arch", tagId: "tag-old", recordedMinutes: 10 }),
      session({ id: "s-gone", tagId: "missing", recordedMinutes: 15 }),
    ];
    const days = timeline(sessions, archived, NOV_15_11_MOSCOW, "day", TIME_ZONE);
    const blocks = days[0]!.blocks;
    expect(blocks.find((b) => b.sessionId === "s-arch")).toMatchObject({
      name: "Архив",
      color: "#111111",
    });
    expect(blocks.find((b) => b.sessionId === "s-gone")).toMatchObject({
      name: "Без тега",
      color: "#A8A49B",
    });
  });
});

describe("timeline week", () => {
  it("starts the week on Monday 9 November 2026 in Europe/Moscow", () => {
    const sessions = [session({ id: "s1" })];
    const days = timeline(sessions, tags, NOV_15_11_MOSCOW, "week", TIME_ZONE);
    expect(days).toHaveLength(7);
    const mondayStart = Date.UTC(2026, 10, 8, 21, 0, 0);
    expect(days[0]!.start).toBe(mondayStart);
    const totalBlocks = days.reduce((n, d) => n + d.blocks.length, 0);
    expect(totalBlocks).toBe(1);
    expect(days[6]!.blocks).toHaveLength(1);
  });
});

describe("delete-session", () => {
  const t0 = 1_700_000_000_000;

  it("removes a session without changing cycleCount or an open break", () => {
    const seeded: typeof initialState extends () => infer S ? S : never = {
      ...initialState(),
      sessions: [
        {
          id: "keep",
          tagId: "tag-work",
          startedAt: t0,
          recordedMinutes: 25,
        },
        {
          id: "drop",
          tagId: "tag-work",
          startedAt: t0 + 60_000,
          recordedMinutes: 25,
        },
      ],
      cycleCount: 2,
      open: {
        phase: "break",
        tagId: "tag-work",
        startedAt: t0,
        plannedMinutes: 25,
        focusEndsAt: t0 + 25 * 60_000,
        breakEndsAt: t0 + 30 * 60_000,
        breakIsLong: false,
      },
    };
    const next = reduce(
      seeded,
      { type: "delete-session", sessionId: "drop" },
      t0 + 5 * 60_000,
    );
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]!.id).toBe("keep");
    expect(next.cycleCount).toBe(2);
    expect(next.open?.phase).toBe("break");
  });
});
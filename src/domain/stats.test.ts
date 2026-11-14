import { describe, expect, it } from "vitest";
import type { CompletedSession, Tag } from "./types";
import { stats } from "./stats";

const TIME_ZONE = "Europe/Moscow";

const NOV_15_11_MOSCOW = Date.UTC(2026, 10, 15, 8, 0, 0);
const NOV_14_11_MOSCOW = Date.UTC(2026, 10, 14, 8, 0, 0);

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

describe("stats day", () => {
  it("counts one tomato and full tag share for a single session", () => {
    const sessions = [session({ id: "s1" })];
    const result = stats(sessions, tags, NOV_15_11_MOSCOW, "day", TIME_ZONE);
    expect(result.periodTomatoes).toBe(1);
    expect(result.periodMinutes).toBe(25);
    expect(result.periodDays).toBe(1);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]).toMatchObject({
      tagId: "tag-work",
      name: "Работа",
      color: "#E07A4C",
      minutes: 25,
      share: 1,
    });
  });

  it("includes other days in totals only", () => {
    const sessions = [
      session({ id: "s1" }),
      {
        id: "s2",
        tagId: "tag-work",
        startedAt: NOV_14_11_MOSCOW,
        recordedMinutes: 25,
      },
    ];
    const result = stats(sessions, tags, NOV_15_11_MOSCOW, "day", TIME_ZONE);
    expect(result.periodTomatoes).toBe(1);
    expect(result.totalTomatoes).toBe(2);
    expect(result.periodMinutes).toBe(25);
    expect(result.totalMinutes).toBe(50);
    expect(result.periodDays).toBe(1);
    expect(result.totalDays).toBe(2);
  });

  it("returns zeros and an empty tags array when the period has no sessions", () => {
    const sessions = [
      {
        id: "s2",
        tagId: "tag-work",
        startedAt: NOV_14_11_MOSCOW,
        recordedMinutes: 25,
      },
    ];
    const result = stats(sessions, tags, NOV_15_11_MOSCOW, "day", TIME_ZONE);
    expect(result.periodTomatoes).toBe(0);
    expect(result.periodMinutes).toBe(0);
    expect(result.periodDays).toBe(0);
    expect(result.tags).toEqual([]);
    expect(result.totalTomatoes).toBe(1);
    expect(result.totalMinutes).toBe(25);
    expect(result.totalDays).toBe(1);
  });
});

describe("stats tag shares", () => {
  it("sorts tags by minutes descending", () => {
    const sessions = [
      session({ id: "s1", tagId: "tag-study", recordedMinutes: 10 }),
      session({ id: "s2", tagId: "tag-work", recordedMinutes: 50 }),
    ];
    const result = stats(sessions, tags, NOV_15_11_MOSCOW, "day", TIME_ZONE);
    expect(result.periodMinutes).toBe(60);
    expect(result.tags.map((t) => t.tagId)).toEqual(["tag-work", "tag-study"]);
    expect(result.tags[0]!.share).toBeCloseTo(50 / 60);
    expect(result.tags[1]!.share).toBeCloseTo(10 / 60);
  });
});
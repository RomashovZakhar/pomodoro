import { describe, expect, it } from "vitest";
import type { CompletedSession, Tag } from "./types";
import { stats } from "./stats";
import {
  endOfZonedPeriod,
  startOfZonedWeek,
  zonedTimeToUtc,
} from "./timeline";

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

describe("stats DST boundaries", () => {
  const NY = "America/New_York";

  /** Воскресенье 8 марта 2026, полдень по Нью-Йорку (день перехода на летнее время). */
  const MAR_8_NOON_NY = zonedTimeToUtc(2026, 3, 8, 12, 0, 0, NY);

  /** Понедельник 9 марта 2026, 00:30 EDT — после укороченного воскресенья. */
  const MON_0030_NY = zonedTimeToUtc(2026, 3, 9, 0, 30, 0, NY);

  it("excludes Monday 00:30 EDT from Sunday stats after the short spring-forward day", () => {
    const sessions: CompletedSession[] = [
      {
        id: "mon",
        tagId: "tag-work",
        startedAt: MON_0030_NY,
        recordedMinutes: 25,
      },
    ];
    const result = stats(sessions, tags, MAR_8_NOON_NY, "day", NY);
    expect(result.periodTomatoes).toBe(0);
    expect(result.periodMinutes).toBe(0);
  });

  it("ends the week at the next Monday 00:00 local, not seven fixed UTC hours", () => {
    const weekStart = startOfZonedWeek(MAR_8_NOON_NY, NY);
    const weekEnd = endOfZonedPeriod("week", MAR_8_NOON_NY, NY);
    const nextMonday = zonedTimeToUtc(2026, 3, 9, 0, 0, 0, NY);
    expect(weekEnd).toBe(nextMonday);
    expect(weekEnd).not.toBe(weekStart + 7 * 86_400_000);

    const sessions: CompletedSession[] = [
      {
        id: "mon",
        tagId: "tag-work",
        startedAt: MON_0030_NY,
        recordedMinutes: 25,
      },
    ];
    const week = stats(sessions, tags, MAR_8_NOON_NY, "week", NY);
    expect(week.periodTomatoes).toBe(0);
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
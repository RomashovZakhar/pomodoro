import type { CompletedSession, Tag } from "./types";

export interface TimelineBlock {
  sessionId: string;
  tagId: string;
  name: string;
  color: string;
  startedAt: number;
  endedAt: number;
  recordedMinutes: number;
  label: string;
}

export interface TimelineDay {
  start: number;
  blocks: TimelineBlock[];
}

const MISSING_TAG_NAME = "Без тега";
const MISSING_TAG_COLOR = "#A8A49B";

type ZonedYmd = { year: number; month: number; day: number };

function getZonedParts(
  timestamp: number,
  timeZone: string,
): ZonedYmd & { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(new Date(timestamp))) {
    if (p.type !== "literal") {
      parts[p.type] = p.value;
    }
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const p = getZonedParts(utc, timeZone);
    const asUtc = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second,
    );
    const intended = Date.UTC(year, month - 1, day, hour, minute, second);
    utc -= asUtc - intended;
  }
  return utc;
}

export function startOfZonedDay(timestamp: number, timeZone: string): number {
  const p = getZonedParts(timestamp, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, timeZone);
}

export function calendarAddDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): ZonedYmd {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function zonedWeekdayIndex(timestamp: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const weekday = formatter.format(new Date(timestamp));
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekday] ?? 0;
}

export function startOfZonedWeek(timestamp: number, timeZone: string): number {
  const p = getZonedParts(timestamp, timeZone);
  const dow = zonedWeekdayIndex(timestamp, timeZone);
  const monday = calendarAddDays(p.year, p.month, p.day, -dow);
  return zonedTimeToUtc(monday.year, monday.month, monday.day, 0, 0, 0, timeZone);
}

export function startOfZonedMonth(timestamp: number, timeZone: string): number {
  const p = getZonedParts(timestamp, timeZone);
  return zonedTimeToUtc(p.year, p.month, 1, 0, 0, 0, timeZone);
}

export function startOfZonedYear(timestamp: number, timeZone: string): number {
  const p = getZonedParts(timestamp, timeZone);
  return zonedTimeToUtc(p.year, 1, 1, 0, 0, 0, timeZone);
}

export function endOfZonedPeriod(
  range: "day" | "week" | "month" | "year",
  anchor: number,
  timeZone: string,
): number {
  if (range === "day") {
    const p = getZonedParts(anchor, timeZone);
    const next = calendarAddDays(p.year, p.month, p.day, 1);
    return zonedTimeToUtc(next.year, next.month, next.day, 0, 0, 0, timeZone);
  }
  if (range === "week") {
    const weekStart = startOfZonedWeek(anchor, timeZone);
    const p = getZonedParts(weekStart, timeZone);
    const nextMonday = calendarAddDays(p.year, p.month, p.day, 7);
    return zonedTimeToUtc(
      nextMonday.year,
      nextMonday.month,
      nextMonday.day,
      0,
      0,
      0,
      timeZone,
    );
  }
  if (range === "month") {
    const p = getZonedParts(anchor, timeZone);
    const next =
      p.month === 12
        ? { year: p.year + 1, month: 1, day: 1 }
        : { year: p.year, month: p.month + 1, day: 1 };
    return zonedTimeToUtc(next.year, next.month, next.day, 0, 0, 0, timeZone);
  }
  const p = getZonedParts(anchor, timeZone);
  return zonedTimeToUtc(p.year + 1, 1, 1, 0, 0, 0, timeZone);
}

export function periodStart(
  range: "day" | "week" | "month" | "year",
  anchor: number,
  timeZone: string,
): number {
  if (range === "day") {
    return startOfZonedDay(anchor, timeZone);
  }
  if (range === "week") {
    return startOfZonedWeek(anchor, timeZone);
  }
  if (range === "month") {
    return startOfZonedMonth(anchor, timeZone);
  }
  return startOfZonedYear(anchor, timeZone);
}

function lookupTag(tags: Tag[], tagId: string): { name: string; color: string } {
  const tag = tags.find((item) => item.id === tagId);
  if (!tag) {
    return { name: MISSING_TAG_NAME, color: MISSING_TAG_COLOR };
  }
  return { name: tag.name, color: tag.color };
}

export function durationLabel(recordedMinutes: number): string {
  if (recordedMinutes < 60) {
    return `${recordedMinutes} мин`;
  }
  const hours = Math.floor(recordedMinutes / 60);
  const minutes = recordedMinutes % 60;
  if (minutes === 0) {
    return `${hours} ч`;
  }
  return `${hours} ч ${minutes} мин`;
}

export function emptyDayCopy(): string {
  return "В этот день сессий не было.";
}

export function tomatoScale(recordedMinutes: number): number {
  return Math.min(2, Math.max(0.8, recordedMinutes / 25));
}

function sessionBelongsToDay(
  session: CompletedSession,
  dayStart: number,
  timeZone: string,
): boolean {
  return startOfZonedDay(session.startedAt, timeZone) === dayStart;
}

function toBlock(session: CompletedSession, tags: Tag[]): TimelineBlock {
  const { name, color } = lookupTag(tags, session.tagId);
  return {
    sessionId: session.id,
    tagId: session.tagId,
    name,
    color,
    startedAt: session.startedAt,
    endedAt: session.startedAt + session.recordedMinutes * 60_000,
    recordedMinutes: session.recordedMinutes,
    label: durationLabel(session.recordedMinutes),
  };
}

export function timeline(
  sessions: CompletedSession[],
  tags: Tag[],
  anchor: number,
  view: "day" | "week",
  timeZone: string,
): TimelineDay[] {
  const rangeStart =
    view === "day"
      ? startOfZonedDay(anchor, timeZone)
      : startOfZonedWeek(anchor, timeZone);
  const origin = getZonedParts(rangeStart, timeZone);
  const dayCount = view === "day" ? 1 : 7;
  const days: TimelineDay[] = [];

  for (let i = 0; i < dayCount; i++) {
    const ymd = calendarAddDays(origin.year, origin.month, origin.day, i);
    const dayStart = zonedTimeToUtc(ymd.year, ymd.month, ymd.day, 0, 0, 0, timeZone);
    const blocks = sessions
      .filter((s) => sessionBelongsToDay(s, dayStart, timeZone))
      .map((s) => toBlock(s, tags))
      .sort((a, b) => a.startedAt - b.startedAt);
    days.push({ start: dayStart, blocks });
  }

  return days;
}
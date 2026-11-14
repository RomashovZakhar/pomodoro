import type { CompletedSession, Tag } from "./types";
import {
  endOfZonedPeriod,
  periodStart,
  startOfZonedDay,
} from "./timeline";

export interface StatsTagRow {
  tagId: string;
  name: string;
  color: string;
  minutes: number;
  share: number;
}

export interface Stats {
  periodTomatoes: number;
  totalTomatoes: number;
  periodDays: number;
  totalDays: number;
  periodMinutes: number;
  totalMinutes: number;
  tags: StatsTagRow[];
}

const MISSING_TAG_NAME = "Без тега";
const MISSING_TAG_COLOR = "#A8A49B";

function lookupTag(tags: Tag[], tagId: string): { name: string; color: string } {
  const tag = tags.find((item) => item.id === tagId);
  if (!tag) {
    return { name: MISSING_TAG_NAME, color: MISSING_TAG_COLOR };
  }
  return { name: tag.name, color: tag.color };
}

function inPeriod(
  session: CompletedSession,
  start: number,
  end: number,
): boolean {
  return session.startedAt >= start && session.startedAt < end;
}

function uniqueDayCount(
  sessions: CompletedSession[],
  timeZone: string,
): number {
  const days = new Set<number>();
  for (const session of sessions) {
    days.add(startOfZonedDay(session.startedAt, timeZone));
  }
  return days.size;
}

export function stats(
  sessions: CompletedSession[],
  tags: Tag[],
  anchor: number,
  range: "day" | "week" | "month" | "year",
  timeZone: string,
): Stats {
  const periodFrom = periodStart(range, anchor, timeZone);
  const periodTo = endOfZonedPeriod(range, anchor, timeZone);
  const periodSessions = sessions.filter((s) => inPeriod(s, periodFrom, periodTo));

  const periodTomatoes = periodSessions.length;
  const totalTomatoes = sessions.length;
  const periodMinutes = periodSessions.reduce((sum, s) => sum + s.recordedMinutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.recordedMinutes, 0);
  const periodDays = uniqueDayCount(periodSessions, timeZone);
  const totalDays = uniqueDayCount(sessions, timeZone);

  const byTag = new Map<string, number>();
  for (const session of periodSessions) {
    byTag.set(session.tagId, (byTag.get(session.tagId) ?? 0) + session.recordedMinutes);
  }

  const tagRows: StatsTagRow[] = [];
  if (periodMinutes > 0) {
    for (const [tagId, minutes] of byTag) {
      const { name, color } = lookupTag(tags, tagId);
      tagRows.push({
        tagId,
        name,
        color,
        minutes,
        share: minutes / periodMinutes,
      });
    }
    tagRows.sort((a, b) => b.minutes - a.minutes);
  }

  return {
    periodTomatoes,
    totalTomatoes,
    periodDays,
    totalDays,
    periodMinutes,
    totalMinutes,
    tags: tagRows,
  };
}

export { tomatoScale } from "./timeline";
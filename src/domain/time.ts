const OVERTIME_CAP_SECONDS = 3 * 3600;

export function overtimeAddMinutes(elapsedMs: number): number {
  return Math.min(180, Math.floor(elapsedMs / 60_000) + 1);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function splitSeconds(totalSeconds: number) {
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, seconds };
}

export function formatBigClock(
  totalSeconds: number,
  mode: "remaining" | "overtime",
): string {
  let seconds = Math.max(0, Math.floor(totalSeconds));
  if (mode === "overtime" && seconds > OVERTIME_CAP_SECONDS) {
    seconds = OVERTIME_CAP_SECONDS;
  }
  const parts = splitSeconds(seconds);
  if (mode === "overtime") {
    if (parts.hours >= 1) {
      return `+${parts.hours}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
    }
    return `+${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
  }
  if (parts.hours >= 1) {
    return `${parts.hours}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
  }
  return `${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
}

export function formatMenuBar(
  totalSeconds: number,
  mode: "remaining" | "overtime" | "break",
): string {
  let seconds = Math.max(0, Math.floor(totalSeconds));
  if (mode === "overtime" && seconds > OVERTIME_CAP_SECONDS) {
    seconds = OVERTIME_CAP_SECONDS;
  }
  const parts = splitSeconds(seconds);

  if (mode === "overtime") {
    if (parts.hours >= 1) {
      return `+${parts.hours}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
    }
    return `+${parts.minutes}:${pad2(parts.seconds)}`;
  }

  const time =
    parts.hours >= 1
      ? `${parts.hours}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`
      : `${parts.minutes}:${pad2(parts.seconds)}`;

  if (mode === "break") {
    return `перерыв ${time}`;
  }

  return time;
}

export function formatOvertimeChip(elapsedMs: number): string {
  const seconds = Math.min(
    OVERTIME_CAP_SECONDS,
    Math.max(0, Math.floor(elapsedMs / 1000)),
  );
  if (seconds < 60) return `+${seconds} с`;
  return `${Math.floor(seconds / 60)} мин`;
}
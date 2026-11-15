export type Place = "home" | "calendar" | "summary" | "settings";

export const DECK_THRESHOLD = 72;

export function placeOffset(place: Place): { x: number; y: number } {
  if (place === "calendar") return { x: -1, y: 0 };
  if (place === "settings") return { x: 1, y: 0 };
  if (place === "summary") return { x: 0, y: -1 };
  return { x: 0, y: 0 };
}

export function nextPlace(
  place: Place,
  dx: number,
  dy: number,
  threshold = DECK_THRESHOLD,
): Place {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (place === "home") {
    if (horizontal && dx <= -threshold) return "calendar";
    if (horizontal && dx >= threshold) return "settings";
    if (!horizontal && dy <= -threshold) return "summary";
    return "home";
  }
  if (place === "calendar" && horizontal && dx >= threshold) return "home";
  if (place === "settings" && horizontal && dx <= -threshold) return "home";
  if (place === "summary" && !horizontal && dy >= threshold) return "home";
  return place;
}

export function lockAxis(dx: number, dy: number): { dx: number; dy: number } {
  if (Math.abs(dx) >= Math.abs(dy)) return { dx, dy: 0 };
  return { dx: 0, dy };
}

export function clampDrag(
  place: Place,
  dx: number,
  dy: number,
  width: number,
  height: number,
): { dx: number; dy: number } {
  const limitX = Math.max(width, 1);
  const limitY = Math.max(height, 1);
  if (place === "home") {
    return {
      dx: Math.max(-limitX, Math.min(limitX, dx)),
      dy: Math.max(-limitY, Math.min(0, dy)),
    };
  }
  if (place === "calendar") {
    return { dx: Math.max(0, Math.min(limitX, dx)), dy: 0 };
  }
  if (place === "settings") {
    return { dx: Math.max(-limitX, Math.min(0, dx)), dy: 0 };
  }
  return { dx: 0, dy: Math.max(0, Math.min(limitY, dy)) };
}

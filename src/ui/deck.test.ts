import { describe, expect, it } from "vitest";
import { clampDrag, lockAxis, nextPlace, placeOffset } from "./deck";

describe("deck places", () => {
  it("keeps calendar on the right, settings on the left, and summary below", () => {
    expect(placeOffset("home")).toEqual({ x: 0, y: 0 });
    expect(placeOffset("calendar")).toEqual({ x: -1, y: 0 });
    expect(placeOffset("settings")).toEqual({ x: 1, y: 0 });
    expect(placeOffset("summary")).toEqual({ x: 0, y: -1 });
  });

  it("follows the finger to a neighbor and back home", () => {
    expect(nextPlace("home", -80, 10)).toBe("calendar");
    expect(nextPlace("home", 80, 10)).toBe("settings");
    expect(nextPlace("home", 10, -80)).toBe("summary");
    expect(nextPlace("home", 10, 80)).toBe("home");

    expect(nextPlace("calendar", 80, 0)).toBe("home");
    expect(nextPlace("calendar", -80, 0)).toBe("calendar");
    expect(nextPlace("settings", -80, 0)).toBe("home");
    expect(nextPlace("settings", 80, 0)).toBe("settings");
    expect(nextPlace("summary", 0, 80)).toBe("home");
    expect(nextPlace("summary", 0, -80)).toBe("summary");
  });

  it("locks one axis and refuses to drag into an empty side", () => {
    expect(lockAxis(30, 10)).toEqual({ dx: 30, dy: 0 });
    expect(lockAxis(10, 30)).toEqual({ dx: 0, dy: 30 });
    expect(clampDrag("home", -20, -40, 300, 400)).toEqual({ dx: -20, dy: -40 });
    expect(clampDrag("home", 500, 900, 300, 400)).toEqual({ dx: 300, dy: 0 });
    expect(clampDrag("calendar", -40, 20, 300, 400)).toEqual({ dx: 0, dy: 0 });
    expect(clampDrag("settings", 40, 20, 300, 400)).toEqual({ dx: 0, dy: 0 });
    expect(clampDrag("summary", 20, -30, 300, 400)).toEqual({ dx: 0, dy: 0 });
    expect(clampDrag("summary", 20, 30, 300, 400)).toEqual({ dx: 0, dy: 30 });
  });
});

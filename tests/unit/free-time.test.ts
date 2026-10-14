import { describe, expect, it } from "vitest";
import { firstFit, freeWindows, mergeIntervals, sharedFreeWindows } from "@/lib/planner/free-time";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("mergeIntervals", () => {
  it("merges overlapping and touching spans and sorts them", () => {
    expect(
      mergeIntervals([
        { start: h(13), end: h(14) },
        { start: h(9), end: h(10) },
        { start: h(9, 30), end: h(11) },
        { start: h(11), end: h(12) }, // touches the previous one
      ]),
    ).toEqual([
      { start: h(9), end: h(12) },
      { start: h(13), end: h(14) },
    ]);
  });

  it("does not mutate its input", () => {
    const input = [{ start: 0, end: 10 }, { start: 5, end: 20 }];
    mergeIntervals(input);
    expect(input).toEqual([{ start: 0, end: 10 }, { start: 5, end: 20 }]);
  });
});

describe("freeWindows", () => {
  it("returns the gaps between busy spans inside the day", () => {
    const busy = [{ start: h(9), end: h(10) }, { start: h(12), end: h(13) }];
    expect(freeWindows(busy, h(8), h(14))).toEqual([
      { start: h(8), end: h(9) },
      { start: h(10), end: h(12) },
      { start: h(13), end: h(14) },
    ]);
  });

  it("drops gaps shorter than the minimum", () => {
    const busy = [{ start: h(9), end: h(10) }, { start: h(10, 20), end: h(11) }];
    expect(freeWindows(busy, h(9), h(11), 30)).toEqual([]);
  });

  it("clips busy spans that start before or end after the day", () => {
    expect(freeWindows([{ start: h(6), end: h(9) }], h(8), h(10))).toEqual([{ start: h(9), end: h(10) }]);
  });

  it("an empty calendar is one big window", () => {
    expect(freeWindows([], h(8), h(22))).toEqual([{ start: h(8), end: h(22) }]);
  });
});

describe("sharedFreeWindows", () => {
  it("is free only where both people are free", () => {
    const me = [{ start: h(9), end: h(15) }];
    const friend = [{ start: h(16), end: h(18) }];
    expect(sharedFreeWindows(me, friend, h(8), h(22))).toEqual([
      { start: h(8), end: h(9) },
      { start: h(15), end: h(16) },
      { start: h(18), end: h(22) },
    ]);
  });
});

describe("firstFit (temporary placer)", () => {
  const busy = [{ start: h(9), end: h(12) }, { start: h(13), end: h(17) }];

  it("uses the first gap long enough", () => {
    expect(firstFit(busy, 60, h(8), h(22))).toEqual({ start: h(8), end: h(9) });
    expect(firstFit(busy, 90, h(8), h(22))).toEqual({ start: h(17), end: h(18, 30) });
  });

  it("never places before `notBefore`, rounded up to 15 minutes", () => {
    expect(firstFit(busy, 30, h(8), h(22), h(12, 7))).toEqual({ start: h(12, 15), end: h(12, 45) });
  });

  it("returns null when nothing fits", () => {
    expect(firstFit([{ start: h(8), end: h(22) }], 30, h(8), h(22))).toBeNull();
  });
});

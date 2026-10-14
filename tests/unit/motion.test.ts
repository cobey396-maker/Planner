import { describe, expect, it } from "vitest";
import { fadeUp, fluid, instant, scaleIn, transitionFor } from "@/lib/design/motion";

describe("motion", () => {
  // The brief's rule "no linear easing" becomes a test, so it can't regress.
  it("the app's single transition is a spring", () => {
    expect(fluid.type).toBe("spring");
    expect(fluid).not.toHaveProperty("ease");
  });

  it("settles quickly enough that the UI never feels sluggish", () => {
    expect(fluid.visualDuration).toBeLessThanOrEqual(0.5);
  });

  it("every variant animates with the same spring", () => {
    for (const v of [fadeUp, scaleIn]) {
      for (const state of ["animate", "exit"] as const) {
        expect((v[state] as { transition: unknown }).transition).toBe(fluid);
      }
    }
  });

  it("uses the spring normally and an instant transition for Reduce Motion", () => {
    expect(transitionFor(false)).toBe(fluid);
    expect(transitionFor(null)).toBe(fluid); // unknown yet → animate
    expect(transitionFor(true)).toBe(instant);
  });
});

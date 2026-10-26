// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiquidBackground } from "@/components/ui/liquid-background";

/**
 * The background sits behind every screen. If it moves, the browser must
 * redraw (and re-blur every glass card) on every frame forever, which made
 * taps lag by seconds on phones. It must stay still and cheap to paint.
 */
describe("LiquidBackground", () => {
  it("never animates and never uses a blur filter", () => {
    const { container } = render(<LiquidBackground />);
    const orbs = container.querySelectorAll("div > div");
    expect(orbs.length).toBeGreaterThan(0);
    for (const orb of orbs) {
      const el = orb as HTMLElement;
      expect(el.style.animation).toBe("");
      expect(el.style.filter).toBe("");
      expect(el.className).not.toMatch(/\b(animate-|blur-)/);
    }
  });
});

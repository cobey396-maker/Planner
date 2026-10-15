// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerProvider, usePlanner } from "@/lib/planner/store";

// Replace the real confetti with a spy: we only care WHEN it fires.
vi.mock("@/lib/confetti", () => ({ fireConfetti: vi.fn() }));
const { fireConfetti } = await import("@/lib/confetti");

const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider>{children}</PlannerProvider>;

describe("confetti on task completion", () => {
  beforeEach(() => vi.mocked(fireConfetti).mockClear());

  it("fires when a block is marked complete, not when it's un-checked", () => {
    const { result } = renderHook(() => usePlanner(), { wrapper });
    const id = result.current.blocks[0].id;

    act(() => result.current.toggleComplete(id));
    expect(result.current.completed.has(id)).toBe(true);
    expect(fireConfetti).toHaveBeenCalledTimes(1);

    act(() => result.current.toggleComplete(id)); // un-check
    expect(result.current.completed.has(id)).toBe(false);
    expect(fireConfetti).toHaveBeenCalledTimes(1);

    act(() => result.current.toggleComplete(id)); // complete again → celebrate again
    expect(fireConfetti).toHaveBeenCalledTimes(2);
  });
});

describe("fireConfetti itself", () => {
  it("does nothing when the user prefers reduced motion", async () => {
    const real = await vi.importActual<typeof import("@/lib/confetti")>("@/lib/confetti");
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    real.fireConfetti();
    expect(document.getElementById("confetti-canvas")).toBeNull();
    vi.unstubAllGlobals();
  });
});

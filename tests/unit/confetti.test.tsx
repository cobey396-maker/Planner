// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PLANNER, PlannerProvider, usePlanner } from "@/lib/planner/store";
import type { PlannedBlock } from "@/lib/planner/types";

// Replace the real confetti with a spy: we only care WHEN it fires.
vi.mock("@/lib/confetti", () => ({ fireConfetti: vi.fn() }));
const { fireConfetti } = await import("@/lib/confetti");

const block: PlannedBlock = {
  id: "b1",
  taskId: "t1",
  title: "Essay",
  color: "blue",
  startsAt: Date.UTC(2026, 9, 18, 15),
  endsAt: Date.UTC(2026, 9, 18, 16),
  status: "planned",
  completedAt: null,
};
// Demo ("local") mode: no server calls, so we test the store on its own.
const wrapper = ({ children }: { children: ReactNode }) => (
  <PlannerProvider initial={{ ...EMPTY_PLANNER, blocks: [block] }} mode="local">
    {children}
  </PlannerProvider>
);

describe("confetti on task completion", () => {
  beforeEach(() => vi.mocked(fireConfetti).mockClear());

  it("fires when a block is marked complete (and adds 10 points), not when it's un-checked", async () => {
    const { result } = renderHook(() => usePlanner(), { wrapper });
    const status = () => result.current.blocks[0].status;
    expect(result.current.pointsTotal).toBe(0);

    await act(() => result.current.setDone("b1", true));
    expect(status()).toBe("done");
    expect(result.current.pointsTotal).toBe(10);
    expect(fireConfetti).toHaveBeenCalledTimes(1);

    await act(() => result.current.setDone("b1", false)); // un-check
    expect(status()).toBe("planned");
    expect(result.current.pointsTotal).toBe(0);
    expect(fireConfetti).toHaveBeenCalledTimes(1);

    await act(() => result.current.setDone("b1", true)); // complete again → celebrate again
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

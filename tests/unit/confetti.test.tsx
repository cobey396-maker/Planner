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
  beforeEach(() => {
    vi.mocked(fireConfetti).mockClear();
    localStorage.clear(); // demo mode saves to the browser; start each test fresh
  });

  it("fires when a block is marked complete (and adds XP), not when it's un-checked", async () => {
    const { result } = renderHook(() => usePlanner(), { wrapper });
    const status = () => result.current.blocks[0].status;
    expect(result.current.pointsTotal).toBe(0);

    await act(() => result.current.setDone("b1", true));
    expect(status()).toBe("done");
    expect(result.current.pointsTotal).toBeGreaterThanOrEqual(100);
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

describe("leveling up", () => {
  beforeEach(() => localStorage.clear());
  it("crossing 500 XP shows the level-up celebration for level 2", async () => {
    const blocks: PlannedBlock[] = Array.from({ length: 5 }, (_, i) => ({ ...block, id: `l${i}`, taskId: `lt${i}` }));
    const { result } = renderHook(() => usePlanner(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PlannerProvider initial={{ ...EMPTY_PLANNER, blocks, pointsTotal: 450 }} mode="local">
          {children}
        </PlannerProvider>
      ),
    });
    expect(result.current.levelUp).toBeNull();
    await act(() => result.current.setDone("l0", true));
    expect(result.current.levelUp).toEqual({ from: 1, to: 2 });
    act(() => result.current.dismissLevelUp());
    expect(result.current.levelUp).toBeNull();
  });
});

describe("demo mode saving", () => {
  beforeEach(() => localStorage.clear());

  it("keeps each local account's tasks in this browser, separately", async () => {
    const mount = () =>
      renderHook(() => usePlanner(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <PlannerProvider initial={EMPTY_PLANNER} mode="local">
            {children}
          </PlannerProvider>
        ),
      });
    localStorage.setItem("profile", JSON.stringify({ name: "Ana", email: "ana@x.co" }));
    const first = mount();
    await act(() => first.result.current.addTask({ title: "Essay", minutes: 60, color: "blue", dayKeys: ["2030-01-07"], startMinute: 600 }));
    first.unmount();

    // Same account, new visit: the task is still there.
    const again = mount();
    expect(again.result.current.blocks.map((b) => b.title)).toEqual(["Essay"]);
    again.unmount();

    // Another account on the same device starts empty.
    localStorage.setItem("profile", JSON.stringify({ name: "Ben", email: "ben@x.co" }));
    const other = mount();
    expect(other.result.current.blocks).toEqual([]);
  });
});

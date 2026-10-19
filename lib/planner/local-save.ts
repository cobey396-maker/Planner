import type { PlannedBlock } from "./types";

/**
 * DEMO MODE SAVING: when the app runs without a database (no Supabase
 * settings), each local account's schedule is saved in this browser, under
 * its own key ("planner-data:<email>"), so tasks survive a refresh and
 * accounts on the same device don't mix. Signed-in accounts save to the
 * database instead and never use this.
 */
export type LocalSave = {
  v: 1;
  blocks: PlannedBlock[];
  pointsTotal: number;
  flameStyle: string;
  title: string;
  weekStartsOn: 1 | 7;
};

export const localSaveKey = (email: string | null | undefined) => `planner-data:${email?.trim().toLowerCase() || "guest"}`;

function isBlock(value: unknown): value is PlannedBlock {
  const b = value as PlannedBlock;
  return (
    typeof b === "object" &&
    b !== null &&
    typeof b.id === "string" &&
    typeof b.taskId === "string" &&
    typeof b.title === "string" &&
    typeof b.startsAt === "number" &&
    typeof b.endsAt === "number" &&
    (b.status === "planned" || b.status === "done" || b.status === "skipped")
  );
}

/** Read a saved schedule; anything malformed (old versions, manual edits) is ignored. */
export function loadLocal(key: string): LocalSave | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<LocalSave>;
    if (data.v !== 1 || !Array.isArray(data.blocks)) return null;
    return {
      v: 1,
      blocks: data.blocks.filter(isBlock),
      pointsTotal: typeof data.pointsTotal === "number" ? Math.max(0, data.pointsTotal) : 0,
      flameStyle: typeof data.flameStyle === "string" ? data.flameStyle : "classic",
      title: typeof data.title === "string" ? data.title : "rookie",
      weekStartsOn: data.weekStartsOn === 7 ? 7 : 1,
    };
  } catch {
    return null;
  }
}

export function saveLocal(key: string, data: LocalSave) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private browsing): keep working in memory.
  }
}

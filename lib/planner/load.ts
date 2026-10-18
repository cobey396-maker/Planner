import "server-only";
import type { TaskColor } from "@/lib/design/tokens";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { FriendRequest, HangoutInvite, PersonSummary, PlannedBlock, PlannerSettings, Suggestion } from "./types";

/**
 * Everything the tabs need, loaded once on the server when a tab opens
 * (in parallel). Every query runs with the user's own token, so row-level
 * security guarantees it's only their data (and what friends may see).
 */
export type PlannerData = {
  settings: PlannerSettings & {
    notifyUpcoming: boolean;
    notifyMissed: boolean;
    notifyFriends: boolean;
    reminderLeadMinutes: number;
    discoverable: boolean;
  };
  profile: PersonSummary;
  blocks: PlannedBlock[];
  pointsTotal: number;
  friends: PersonSummary[];
  requests: FriendRequest[];
  suggestions: Suggestion[];
  inviteCode: string | null;
  hangouts: HangoutInvite[];
  hasAcceptedHangout: boolean;
  /** The database is missing a migration: tell the user how to update it. */
  databaseOutdated: boolean;
};

/** Blocks from this far back are enough for streaks, badges and recaps. */
const HISTORY_DAYS = 400;

type ProfileRow = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  avatar_color: TaskColor;
  city: string | null;
  region: string | null;
};

const PROFILE_FIELDS = "id, display_name, handle, avatar_url, avatar_color, city, region";

export function toPerson(row: ProfileRow): PersonSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    avatarColor: row.avatar_color,
    city: row.city,
    region: row.region,
  };
}

/** Postgres error codes that mean "this table/column/function doesn't exist yet". */
const MISSING_OBJECT = new Set(["42703", "42P01", "42883", "PGRST202", "PGRST204"]);

export async function loadPlannerData(supabase: ServerSupabase, userId: string, repaired = false): Promise<PlannerData> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();

  const [settings, profile, blocks, points, friendships, suggestions, invite, hangouts] = await Promise.all([
    supabase
      .from("user_settings")
      .select("time_zone, week_starts_on, notify_upcoming, notify_missed, notify_friends, reminder_lead_minutes, discoverable")
      .eq("user_id", userId)
      .single(),
    supabase.from("profiles").select(PROFILE_FIELDS).eq("id", userId).single(),
    supabase
      .from("blocks")
      .select("id, task_id, starts_at, ends_at, status, completed_at, tasks(title, color)")
      .gte("starts_at", since)
      .order("starts_at"),
    supabase.from("points_ledger").select("points"),
    supabase.from("friendships").select("id, requester_id, addressee_id, status"),
    supabase.rpc("suggest_friends", { max_results: 10 }),
    supabase.rpc("my_invite_code"),
    supabase.from("hangout_invites").select("id, from_user_id, to_user_id, starts_at, ends_at, activity, status"),
  ]);

  // An account without its profile row can't save anything (tasks need it).
  // Ask the database to recreate the missing rows, then load again, once.
  let repairUnavailable = false;
  if (!profile.data && profile.error?.code === "PGRST116" && !repaired) {
    const { error } = await supabase.rpc("ensure_my_account");
    if (!error) return loadPlannerData(supabase, userId, true);
    repairUnavailable = MISSING_OBJECT.has(error.code ?? "");
  }
  const databaseOutdated =
    repairUnavailable || [settings, profile, suggestions].some((r) => r.error && MISSING_OBJECT.has(r.error.code ?? ""));

  // People connected to me: fetch their public profile fields in one query.
  const rows = (friendships.data ?? []) as { id: string; requester_id: string; addressee_id: string; status: string }[];
  const otherIds = [...new Set(rows.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id)))];
  const hangoutRows = (hangouts.data ?? []) as {
    id: string;
    from_user_id: string;
    to_user_id: string;
    starts_at: string;
    ends_at: string;
    activity: string;
    status: string;
  }[];
  const people = new Map<string, PersonSummary>();
  if (otherIds.length) {
    const { data } = await supabase.from("profiles").select(PROFILE_FIELDS).in("id", otherIds);
    for (const p of (data ?? []) as ProfileRow[]) people.set(p.id, toPerson(p));
  }

  const s = settings.data as {
    time_zone: string;
    week_starts_on: number;
    notify_upcoming: boolean;
    notify_missed: boolean;
    notify_friends: boolean;
    reminder_lead_minutes: number;
    discoverable: boolean;
  } | null;

  return {
    settings: {
      timeZone: s?.time_zone ?? "UTC",
      weekStartsOn: s?.week_starts_on === 7 ? 7 : 1,
      notifyUpcoming: s?.notify_upcoming ?? true,
      notifyMissed: s?.notify_missed ?? true,
      notifyFriends: s?.notify_friends ?? true,
      reminderLeadMinutes: s?.reminder_lead_minutes ?? 15,
      discoverable: s?.discoverable ?? true,
    },
    profile: profile.data
      ? toPerson(profile.data as ProfileRow)
      : { id: userId, displayName: "You", handle: "", avatarUrl: null, avatarColor: "blue", city: null, region: null },
    blocks: ((blocks.data ?? []) as unknown as {
      id: string;
      task_id: string;
      starts_at: string;
      ends_at: string;
      status: PlannedBlock["status"];
      completed_at: string | null;
      tasks: { title: string; color: TaskColor } | null;
    }[]).map((b) => ({
      id: b.id,
      taskId: b.task_id,
      title: b.tasks?.title ?? "Task",
      color: b.tasks?.color ?? "orange",
      startsAt: Date.parse(b.starts_at),
      endsAt: Date.parse(b.ends_at),
      status: b.status,
      completedAt: b.completed_at ? Date.parse(b.completed_at) : null,
    })),
    pointsTotal: ((points.data ?? []) as { points: number }[]).reduce((sum, p) => sum + p.points, 0),
    friends: rows
      .filter((f) => f.status === "accepted")
      .map((f) => people.get(f.requester_id === userId ? f.addressee_id : f.requester_id))
      .filter((p): p is PersonSummary => Boolean(p)),
    requests: rows
      .filter((f) => f.status === "pending" && f.addressee_id === userId && people.has(f.requester_id))
      .map((f) => ({ friendshipId: f.id, from: people.get(f.requester_id)! })),
    suggestions: ((suggestions.data ?? []) as (ProfileRow & { mutual_count: number; reason: string })[]).map((r) => ({
      ...toPerson(r),
      mutualCount: r.mutual_count,
      reason: r.reason === "mutual" ? "mutual" : "nearby",
    })),
    inviteCode: (invite.data as string | null) ?? null,
    hangouts: hangoutRows
      .filter((h) => h.status === "pending" && h.to_user_id === userId && people.has(h.from_user_id))
      .map((h) => ({
        id: h.id,
        from: people.get(h.from_user_id)!,
        startsAt: Date.parse(h.starts_at),
        endsAt: Date.parse(h.ends_at),
        activity: h.activity,
      })),
    hasAcceptedHangout: hangoutRows.some((h) => h.status === "accepted"),
    databaseOutdated,
  };
}

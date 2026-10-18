"use client";

import { Check, Copy, EyeOff, MapPin, Share2, UserPlus, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import { sharedFreeWindows } from "@/lib/planner/free-time";
import { usePlanner } from "@/lib/planner/store";
import type { Interval, PersonSummary } from "@/lib/planner/types";
import { formatDayKey, formatDuration, formatTimeRange } from "@/lib/time";
import { addDays, dayKey, dayRange, startOfWeek, zonedTimeToUtc } from "@/lib/tz";
import { levelOf, titleName } from "@/lib/planner/levels";
import { useNow } from "@/lib/use-now";

/** Shared free time is only searched for between these local hours. */
const SOCIAL_START = 8 * 60;
const SOCIAL_END = 22 * 60;
const ACTIVITIES = ["📚 Study", "🏋️ Gym", "🍕 Food", "🎮 Chill", "🛹 Outside"];

const place = (p: { city: string | null; region: string | null }) => [p.city, p.region].filter(Boolean).join(", ");

/**
 * FRIENDS: real people only. Requests and hangout invites at the top, your
 * friends and the free time you share, then "People you may know"
 * (friends of friends first, then people in your city). Friends only ever
 * see when you're busy, never what you're doing.
 */
export function FriendsScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const toast = useToast();
  const { mode, friends, requests, suggestions, hangouts, profile, respondRequest, requestFriend, respondHangout } = usePlanner();
  const [inviting, setInviting] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  // Arrived from someone's invite link (app/add/[code]/route.ts)?
  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (!invite) return;
    toast(invite === "sent" ? "Friend request sent" : "That invite link isn't valid");
    window.history.replaceState(null, "", "/friends");
  }, [toast]);

  return (
    <LargeTitlePage
      title="Friends"
      subtitle="Find time when you're both free."
      trailing={
        <Button variant="glass" size="icon" aria-label="Invite a friend" onClick={() => setInviting(true)}>
          <UserPlus size={20} className="text-tint" />
        </Button>
      }
    >
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-6">
        <AnimatePresence>
          {hangouts.map((h) => (
            <motion.div key={h.id} layout variants={fadeUp} initial="initial" animate="animate" exit="exit">
              <Card className="flex items-center gap-3">
                <Avatar name={h.from.displayName} color={h.from.avatarColor} src={h.from.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-headline">
                    {h.from.displayName.split(" ")[0]}: {h.activity}
                  </div>
                  <div className="text-subhead text-secondary-label">
                    {now ? formatTimeRange(h.startsAt, h.endsAt, Intl.DateTimeFormat().resolvedOptions().timeZone) : ""}
                  </div>
                </div>
                <Button size="icon" variant="tinted" aria-label="Accept invite" onClick={() => void respondHangout(h.id, true).then(() => toast("See you there!"))}>
                  <Check size={20} />
                </Button>
                <Button size="icon" variant="danger" aria-label="Decline invite" onClick={() => void respondHangout(h.id, false)}>
                  <X size={20} />
                </Button>
              </Card>
            </motion.div>
          ))}
          {requests.map((r) => (
            <motion.div key={r.friendshipId} layout variants={fadeUp} initial="initial" animate="animate" exit="exit">
              <Card className="flex items-center gap-3">
                <Avatar name={r.from.displayName} color={r.from.avatarColor} src={r.from.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-headline">{r.from.displayName}</div>
                  <div className="text-subhead text-secondary-label">wants to be friends</div>
                </div>
                <Button
                  size="icon"
                  variant="tinted"
                  aria-label={`Accept ${r.from.displayName}`}
                  onClick={async () => {
                    const res = await respondRequest(r.friendshipId, true);
                    toast(res.ok ? `You and ${r.from.displayName.split(" ")[0]} are friends` : res.error);
                  }}
                >
                  <Check size={20} />
                </Button>
                <Button size="icon" variant="danger" aria-label={`Decline ${r.from.displayName}`} onClick={() => void respondRequest(r.friendshipId, false)}>
                  <X size={20} />
                </Button>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        <motion.section variants={fadeUp}>
          <SectionHeader>Leaderboard · this week</SectionHeader>
          <Leaderboard />
        </motion.section>

        <motion.section variants={fadeUp}>
          <SectionHeader>Your friends</SectionHeader>
          {friends.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-8 text-center">
              <span aria-hidden className="grid size-14 place-items-center rounded-full bg-fill text-secondary-label">
                <Users size={26} />
              </span>
              <h3 className="mt-3 text-headline">No friends yet</h3>
              <p className="mt-1 max-w-xs text-subhead text-secondary-label">
                Send your invite link to a friend, or add someone from the suggestions below.
              </p>
              <Button className="mt-4 rounded-full" variant="tinted" onClick={() => setInviting(true)}>
                <Share2 aria-hidden size={18} /> Invite a friend
              </Button>
            </Card>
          ) : (
            <FreeTogether friends={friends} />
          )}
        </motion.section>

        <motion.section variants={fadeUp}>
          <SectionHeader>People you may know</SectionHeader>
          {suggestions.length === 0 ? (
            <Card className="text-subhead text-secondary-label">
              {mode === "local" ? (
                <>
                  <Link href="/" className="font-semibold text-tint">
                    Create an account
                  </Link>{" "}
                  to see people you may know.
                </>
              ) : !profile?.city ? (
                <>
                  Add your city in{" "}
                  <Link href="/settings" className="font-semibold text-tint">
                    Settings
                  </Link>{" "}
                  to see people near you. Friends of your friends show up here too.
                </>
              ) : (
                `No suggestions yet. As people near ${place(profile)} join, or your friends add friends, they'll show up here.`
              )}
            </Card>
          ) : (
            <div className="glass-card overflow-hidden rounded-card [&>*+*]:border-t [&>*+*]:border-separator">
              {suggestions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={s.displayName} color={s.avatarColor} src={s.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-headline">{s.displayName}</div>
                    <div className="flex items-center gap-1 truncate text-subhead text-secondary-label">
                      {s.reason === "mutual" ? (
                        <>
                          <Users aria-hidden size={13} /> {s.mutualCount} mutual friend{s.mutualCount === 1 ? "" : "s"}
                        </>
                      ) : (
                        <>
                          <MapPin aria-hidden size={13} /> {place(s) || "Near you"}
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={requested.has(s.id) ? "plain" : "tinted"}
                    className="rounded-full"
                    disabled={requested.has(s.id)}
                    onClick={async () => {
                      const res = await requestFriend(s.id);
                      if (res.ok) setRequested((prev) => new Set(prev).add(s.id));
                      toast(res.ok ? "Friend request sent" : res.error);
                    }}
                  >
                    {requested.has(s.id) ? "Requested" : "Add"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 px-1 text-footnote text-secondary-label">
            <EyeOff aria-hidden size={14} /> Friends only see when you&apos;re busy, never what you&apos;re doing.
          </p>
        </motion.section>
      </motion.div>

      <InviteSheet open={inviting} onOpenChange={setInviting} />
    </LargeTitlePage>
  );
}

/** Pick a friend and a day; see the times you're BOTH free; tap one to invite. */
function FreeTogether({ friends }: { friends: PersonSummary[] }) {
  const now = useNow();
  const toast = useToast();
  const { timeZone, friendBusy, sendHangout } = usePlanner();
  const [friendId, setFriendId] = useState(friends[0].id);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [data, setData] = useState<{ key: string; busy: Interval[]; mine: Interval[] } | null>(null);
  const [slot, setSlot] = useState<Interval | null>(null);
  const [activity, setActivity] = useState(ACTIVITIES[0]);

  const friend = friends.find((f) => f.id === friendId) ?? friends[0];
  const today = now ? dayKey(now.getTime(), timeZone) : null;
  const day = pickedDay ?? today;
  const requestKey = day ? `${friend.id}:${day}` : null;

  useEffect(() => {
    if (!requestKey || !day) return;
    let cancelled = false;
    void friendBusy(friend.id, day).then((res) => {
      if (!cancelled && res.ok) setData({ key: requestKey, busy: res.busy, mine: res.mine });
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey, friend.id, day, friendBusy]);

  if (!now || !day || !today) return <Skeleton className="h-48 rounded-card" />;

  const { start: dayStart } = dayRange(day, timeZone);
  const windowStart = Math.max(zonedTimeToUtc(day, SOCIAL_START, timeZone), now.getTime());
  const windowEnd = zonedTimeToUtc(day, SOCIAL_END, timeZone);
  const loaded = data?.key === requestKey ? data : null;
  const toMin = (ms: number) => Math.round((ms - dayStart) / 60000);
  const shared = loaded
    ? sharedFreeWindows(
        loaded.mine.map((i) => ({ start: toMin(i.start), end: toMin(i.end) })),
        loaded.busy.map((i) => ({ start: toMin(i.start), end: toMin(i.end) })),
        toMin(windowStart),
        toMin(windowEnd),
        45,
      ).map((w) => ({ start: dayStart + w.start * 60000, end: dayStart + w.end * 60000 }))
    : [];

  return (
    <Card>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
        {friends.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === friend.id}
            onClick={() => setFriendId(f.id)}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <span className={cn("rounded-full p-[3px]", f.id === friend.id && "shadow-[0_0_0_2.5px_var(--tint)]")}>
              <Avatar name={f.displayName} color={f.avatarColor} src={f.avatarUrl} size={48} />
            </span>
            <span className={cn("w-full truncate text-center text-footnote", f.id === friend.id ? "font-semibold" : "text-secondary-label")}>
              {f.displayName.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => (
          <Chip key={d} group="friend-day" selected={d === day} onClick={() => setPickedDay(d)}>
            {d === today ? "Today" : formatDayKey(d, { weekday: "short" })}
          </Chip>
        ))}
      </div>
      <div className="mt-4">
        {!loaded ? (
          <Skeleton className="h-16" />
        ) : shared.length === 0 ? (
          <p className="text-subhead text-secondary-label">No shared free time that day (8 AM–10 PM). Try another day.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {shared.map((w) => (
              <motion.button
                key={w.start}
                type="button"
                aria-label={`Both free ${formatTimeRange(w.start, w.end, timeZone)}. Send an invite`}
                onClick={() => setSlot(w)}
                whileTap={{ scale: 0.95 }}
                transition={fluid}
                className="rounded-full bg-success/15 px-3.5 py-2 text-subhead font-medium"
              >
                {formatTimeRange(w.start, w.end, timeZone)}
                <span className="ml-1.5 text-secondary-label">{formatDuration(Math.round((w.end - w.start) / 60000))}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={slot !== null}
        onOpenChange={(o) => !o && setSlot(null)}
        title={`Hang out with ${friend.displayName.split(" ")[0]}`}
        description={slot ? `${formatDayKey(day, { weekday: "long" })} · ${formatTimeRange(slot.start, slot.end, timeZone)}` : undefined}
      >
        <div className="flex flex-col gap-5 pt-1">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {ACTIVITIES.map((a) => (
              <Chip key={a} group="activity" selected={activity === a} onClick={() => setActivity(a)}>
                {a}
              </Chip>
            ))}
          </div>
          <Button
            size="lg"
            onClick={async () => {
              if (!slot) return;
              const res = await sendHangout(friend.id, slot.start, slot.end, activity);
              toast(res.ok ? `Invite sent to ${friend.displayName.split(" ")[0]}` : res.error);
              setSlot(null);
            }}
          >
            Send invite
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const { inviteCode } = usePlanner();
  const url = inviteCode && typeof window !== "undefined" ? `${window.location.origin}/add/${inviteCode}` : null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Long-press the link instead");
    }
  }

  async function share() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Add me on Auto-Planner", url });
      } catch {
        // Closed the share sheet.
      }
    } else {
      await copy();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Invite a friend" description="Anyone with your link can send you a friend request.">
      {url ? (
        <div className="flex flex-col gap-4 pt-1">
          <div className="glass-card select-all break-all rounded-2xl px-4 py-3.5 text-body text-tint">{url}</div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="tinted" size="lg" onClick={() => void copy()}>
              <Copy aria-hidden size={18} /> Copy
            </Button>
            <Button size="lg" onClick={() => void share()}>
              <Share2 aria-hidden size={18} /> Share
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-1">
          <p className="text-body text-secondary-label">You need an account to get your own invite link.</p>
          <Link href="/" className="inline-flex h-[52px] items-center justify-center rounded-full bg-tint text-headline text-on-tint">
            Create an account
          </Link>
        </div>
      )}
    </Sheet>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * You and your friends, ranked by XP earned this week (resets when your week
 * starts). Shows each person's level and equipped title. Only friends can
 * see each other here.
 */
function Leaderboard() {
  const now = useNow();
  const { mode, leaderboard, refreshLeaderboard, timeZone, weekStartsOn, pointsTotal, profile, blocks } = usePlanner();
  const today = now ? dayKey(now.getTime(), timeZone) : null;
  const weekStart = today ? zonedTimeToUtc(startOfWeek(today, weekStartsOn), 0, timeZone) : null;

  useEffect(() => {
    if (weekStart !== null) void refreshLeaderboard(weekStart);
  }, [weekStart, refreshLeaderboard, pointsTotal]);

  if (!now || weekStart === null) return <Skeleton className="h-24 rounded-card" />;

  // Demo mode has no server: it's just you, with XP from this week's finishes.
  const rows =
    mode === "local"
      ? [
          {
            id: "me",
            displayName: profile?.displayName ?? "You",
            handle: "",
            avatarUrl: null,
            avatarColor: "blue" as const,
            city: null,
            region: null,
            weekXp: blocks.some((b) => b.status === "done" && (b.completedAt ?? 0) >= weekStart) ? pointsTotal : 0,
            totalXp: pointsTotal,
            level: levelOf(pointsTotal),
            title: "rookie",
            flameStyle: "classic",
            isMe: true,
          },
        ]
      : leaderboard;

  return (
    <div className="glass-card overflow-hidden rounded-card [&>*+*]:border-t [&>*+*]:border-separator" data-testid="leaderboard">
      {rows.map((r, i) => (
        <div key={r.id} className={cn("flex items-center gap-3 px-4 py-3", r.isMe && "bg-tint/8")}>
          <span className="w-7 text-center text-headline tabular-nums text-secondary-label">{MEDALS[i] ?? i + 1}</span>
          <Avatar name={r.displayName} color={r.avatarColor} src={r.avatarUrl} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-headline">
              {r.isMe ? "You" : r.displayName}
            </div>
            <div className="truncate text-footnote text-secondary-label">
              Level {r.level} · {titleName(r.title)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-headline tabular-nums">{r.weekXp.toLocaleString()}</div>
            <div className="text-caption text-secondary-label">XP</div>
          </div>
        </div>
      ))}
      {rows.length <= 1 && (
        <p className="px-4 py-3 text-footnote text-secondary-label">Add friends to compete for the top spot each week.</p>
      )}
    </div>
  );
}

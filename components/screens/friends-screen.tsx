"use client";

import { Check, Copy, EyeOff, Share2, UserPlus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import { sharedFreeWindows } from "@/lib/planner/free-time";
import { usePlanner } from "@/lib/planner/store";
import type { Friend, Interval } from "@/lib/planner/types";
import { formatDuration, formatRange, mondayIndex, WEEKDAY_SHORT } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/** Shared free time is only searched for between these hours. */
const SOCIAL_START = 8 * 60;
const SOCIAL_END = 22 * 60;
const INVITE_LINK = "autoplanner.app/add/cobey-7f3k";
const ACTIVITIES = ["📚 Study", "🏋️ Gym", "🍕 Food", "🎮 Chill", "🛹 Outside"];

/**
 * FRIENDS: add people with a link, then see when you're BOTH free. Privacy is
 * the core rule: friends only ever see busy/free spans, never what you're
 * doing. Tap a shared free slot to send an invite.
 */
export function FriendsScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const { friends, requests, blocks, acceptRequest, declineRequest } = usePlanner();
  const toast = useToast();
  const [friendId, setFriendId] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const [inviteSlot, setInviteSlot] = useState<Interval | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const friend = friends.find((f) => f.id === friendId) ?? friends[0];
  const today = now ? mondayIndex(now) : 0;
  const day = pickedDay ?? today;

  const mine: Interval[] = blocks.filter((b) => b.day === day);
  const theirs = friend?.busy[day] ?? [];
  const shared = friend ? sharedFreeWindows(mine, theirs, SOCIAL_START, SOCIAL_END, 45) : [];

  return (
    <LargeTitlePage
      title="Friends"
      subtitle="Find time when you're both free."
      trailing={
        <Button variant="glass" size="icon" aria-label="Add friend" onClick={() => setAdding(true)}>
          <UserPlus size={20} className="text-tint" />
        </Button>
      }
    >
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-6">
        <AnimatePresence>
          {requests.map((r) => (
            <motion.div key={r.id} layout variants={fadeUp} initial={entrance} animate="animate" exit="exit">
              <Card className="flex items-center gap-3">
                <Avatar name={r.name} color={r.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-headline">{r.name}</div>
                  <div className="text-subhead text-secondary-label">wants to be friends</div>
                </div>
                <Button
                  size="icon"
                  variant="tinted"
                  aria-label={`Accept ${r.name}`}
                  onClick={() => {
                    acceptRequest(r.id);
                    toast(`You and ${r.name.split(" ")[0]} are friends`);
                  }}
                >
                  <Check size={20} />
                </Button>
                <Button size="icon" variant="danger" aria-label={`Decline ${r.name}`} onClick={() => declineRequest(r.id)}>
                  <X size={20} />
                </Button>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {friends.length === 0 ? (
          <Card>
            <EmptyState
              icon="👋"
              title="No friends yet"
              message="Share your link and see when you're both free."
              action={<Button onClick={() => setAdding(true)}>Invite a friend</Button>}
            />
          </Card>
        ) : (
          <>
            <motion.section variants={fadeUp}>
              <SectionHeader>Your people</SectionHeader>
              <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none]">
                {friends.map((f) => {
                  const active = f.id === friend?.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFriendId(f.id)}
                      className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                    >
                      <motion.span
                        animate={{ scale: active ? 1.06 : 1 }}
                        transition={fluid}
                        className={cn(
                          "rounded-full p-[3px] transition-shadow duration-300",
                          active ? "shadow-[0_0_0_2.5px_var(--tint)]" : "",
                        )}
                      >
                        <Avatar name={f.name} color={f.color} size={52} />
                      </motion.span>
                      <span
                        className={cn(
                          "w-full truncate text-center text-footnote",
                          active ? "font-semibold text-label" : "text-secondary-label",
                        )}
                      >
                        {f.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            {friend && (
              <motion.section variants={fadeUp}>
                <SectionHeader>Free together</SectionHeader>
                <Card>
                  {now ? (
                    <>
                      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                        {WEEKDAY_SHORT.map((label, d) =>
                          d < today ? null : (
                            <Chip key={label} group="friend-day" selected={d === day} onClick={() => setPickedDay(d)}>
                              {d === today ? "Today" : label}
                            </Chip>
                          ),
                        )}
                      </div>
                      <OverlapBars
                        friend={friend}
                        mine={mine}
                        theirs={theirs}
                        shared={shared}
                        onPick={(slot) => {
                          setInviteSlot(slot);
                          setInviteOpen(true);
                        }}
                      />
                    </>
                  ) : (
                    <Skeleton className="h-40" />
                  )}
                </Card>
                <p className="mt-2 flex items-center gap-1.5 px-1 text-footnote text-secondary-label">
                  <EyeOff aria-hidden size={14} /> Friends only see when you&apos;re busy, never what you&apos;re
                  doing.
                </p>
              </motion.section>
            )}
          </>
        )}
      </motion.div>

      <InviteFriendSheet open={adding} onOpenChange={setAdding} />
      {friend && (
        <HangoutSheet
          friend={friend}
          day={day}
          today={today}
          slot={inviteSlot}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
    </LargeTitlePage>
  );
}

/**
 * Three aligned tracks, 8 AM → 10 PM: your busy time, their busy time, and
 * the overlap where you're both free (tappable). Only spans are drawn; no
 * titles, which is the privacy model.
 */
function OverlapBars({
  friend,
  mine,
  theirs,
  shared,
  onPick,
}: {
  friend: Friend;
  mine: Interval[];
  theirs: Interval[];
  shared: Interval[];
  onPick: (slot: Interval) => void;
}) {
  const pct = (m: number) => ((m - SOCIAL_START) / (SOCIAL_END - SOCIAL_START)) * 100;
  const span = (iv: Interval) => ({
    left: `${pct(Math.max(SOCIAL_START, iv.start))}%`,
    width: `${pct(Math.min(SOCIAL_END, iv.end)) - pct(Math.max(SOCIAL_START, iv.start))}%`,
  });

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <Track label="You">
        {mine.map((iv, i) => (
          <span key={i} className="absolute inset-y-0 rounded-full bg-secondary-label/35" style={span(iv)} />
        ))}
      </Track>
      <Track label={friend.name.split(" ")[0]}>
        {theirs.map((iv, i) => (
          <span key={i} className="absolute inset-y-0 rounded-full bg-secondary-label/35" style={span(iv)} />
        ))}
      </Track>
      <Track label="Both">
        {shared.map((iv) => (
          <motion.button
            key={`${iv.start}-${iv.end}`}
            type="button"
            aria-label={`Both free ${formatRange(iv.start, iv.end)}. Send an invite`}
            onClick={() => onPick(iv)}
            initial={{ opacity: 0, scaleX: 0.6 }}
            animate={{ opacity: 1, scaleX: 1 }}
            whileTap={{ scale: 0.94 }}
            transition={fluid}
            className="absolute inset-y-0 rounded-full bg-success shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
            style={span(iv)}
          />
        ))}
      </Track>
      <div className="ml-15 flex justify-between pl-0.5 text-caption text-tertiary-label">
        <span>8a</span>
        <span>12p</span>
        <span>4p</span>
        <span>10p</span>
      </div>

      {shared.length === 0 ? (
        <p className="mt-1 text-subhead text-secondary-label">No shared free time that day. Try another.</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-2">
          {shared.map((iv) => (
            <motion.button
              key={`${iv.start}-${iv.end}`}
              type="button"
              onClick={() => onPick(iv)}
              whileTap={{ scale: 0.95 }}
              transition={fluid}
              className="rounded-full bg-success/15 px-3.5 py-2 text-subhead font-medium text-label"
            >
              {formatRange(iv.start, iv.end)}
              <span className="ml-1.5 text-secondary-label">{formatDuration(iv.end - iv.start)}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

function Track({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 truncate text-footnote text-secondary-label">{label}</span>
      <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-fill">{children}</div>
    </div>
  );
}

function HangoutSheet({
  friend,
  day,
  today,
  slot,
  open,
  onOpenChange,
}: {
  friend: Friend;
  day: number;
  today: number;
  slot: Interval | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const first = friend.name.split(" ")[0];
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Hang out with ${first}`}
      description={
        slot
          ? `${day === today ? "Today" : WEEKDAY_SHORT[day]} · ${formatRange(slot.start, slot.end)}`
          : undefined
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        <div className="flex items-center gap-3">
          <Avatar name={friend.name} color={friend.color} size={52} />
          <p className="text-subhead text-secondary-label">
            You&apos;re both free. Pick a vibe and {first} gets a notification.
          </p>
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {ACTIVITIES.map((a) => (
            <Chip key={a} group="activity" selected={activity === a} onClick={() => setActivity(a)}>
              {a}
            </Chip>
          ))}
        </div>
        <Button
          size="lg"
          onClick={() => {
            toast(`Invite sent to ${first}`);
            onOpenChange(false);
          }}
        >
          Send invite
        </Button>
      </div>
    </Sheet>
  );
}

function InviteFriendSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const url = `https://${INVITE_LINK}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Long-press the link instead");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Add me on Auto-Planner", url });
      } catch {
        // The user closed the share sheet; nothing to do.
      }
    } else {
      await copy();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a friend" description="Anyone with your link can send you a request.">
      <div className="flex flex-col gap-4 pt-1">
        <div className="glass-card select-all truncate rounded-2xl px-4 py-3.5 text-body text-tint">{INVITE_LINK}</div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="tinted" size="lg" onClick={copy}>
            <Copy aria-hidden size={18} /> Copy
          </Button>
          <Button size="lg" onClick={share}>
            <Share2 aria-hidden size={18} /> Share
          </Button>
        </div>
        <p className="text-footnote text-secondary-label">
          Real links and requests arrive with accounts in Phase 9. This one is a preview.
        </p>
      </div>
    </Sheet>
  );
}

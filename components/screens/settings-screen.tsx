"use client";

import { Bell, CalendarClock, FileText, Globe, Moon, Palette, Shield, Sunrise, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useTheme } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, ListGroup, ListRow, RowIcon } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, stagger } from "@/lib/design/motion";
import type { ThemePreference } from "@/lib/theme";
import { formatClock } from "@/lib/time";
import { useNow } from "@/lib/use-now";

const LEAD_TIMES = [5, 10, 15, 30];

/**
 * SETTINGS: profile, appearance, notifications and schedule preferences.
 * Theme is fully working now. The other preferences are local for the moment
 * and get saved to your profile in Phase 10 (with real push notifications).
 */
export function SettingsScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const { preference, setPreference } = useTheme();
  const [notify, setNotify] = useState({ upcoming: true, missed: true, friends: true, recap: false });
  const [lead, setLead] = useState(15);
  const [weekStart, setWeekStart] = useState<"mon" | "sun">("mon");

  // The browser knows the user's IANA time zone, e.g. "America/Chicago".
  const timeZone = now ? Intl.DateTimeFormat().resolvedOptions().timeZone : "…";

  return (
    <LargeTitlePage title="Settings">
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-7">
        <motion.div variants={fadeUp}>
          <Card className="flex items-center gap-4">
            <Avatar name="Cobey" color="blue" size={60} />
            <div className="min-w-0 flex-1">
              <div className="text-title3">Cobey</div>
              <div className="text-subhead text-secondary-label">Sign-in arrives in Phase 3</div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <ListGroup header="Appearance">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <RowIcon color="var(--task-indigo)">
                  <Moon size={17} />
                </RowIcon>
                <span className="text-body">Theme</span>
              </div>
              <SegmentedControl<ThemePreference>
                label="Theme"
                value={preference}
                onChange={setPreference}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
          </ListGroup>
        </motion.div>

        <motion.div variants={fadeUp}>
          <ListGroup header="Notifications" footer="Reminders arrive as push notifications once the app is installed.">
            <ListRow
              icon={
                <RowIcon color="var(--task-red)">
                  <Bell size={17} />
                </RowIcon>
              }
              title="Upcoming blocks"
              trailing={
                <Switch label="Upcoming blocks" checked={notify.upcoming} onChange={(v) => setNotify({ ...notify, upcoming: v })} />
              }
            />
            {notify.upcoming && (
              <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
                <span className="mr-1 shrink-0 text-subhead text-secondary-label">Remind me</span>
                {LEAD_TIMES.map((m) => (
                  <Chip key={m} group="lead" selected={lead === m} onClick={() => setLead(m)}>
                    {m} min
                  </Chip>
                ))}
              </div>
            )}
            <ListRow
              icon={
                <RowIcon color="var(--task-orange)">
                  <CalendarClock size={17} />
                </RowIcon>
              }
              title="Missed tasks"
              detail="We'll offer to reschedule"
              trailing={
                <Switch label="Missed tasks" checked={notify.missed} onChange={(v) => setNotify({ ...notify, missed: v })} />
              }
            />
            <ListRow
              icon={
                <RowIcon color="var(--task-green)">
                  <Users size={17} />
                </RowIcon>
              }
              title="Friend invites"
              trailing={
                <Switch label="Friend invites" checked={notify.friends} onChange={(v) => setNotify({ ...notify, friends: v })} />
              }
            />
            <ListRow
              icon={
                <RowIcon color="var(--task-purple)">
                  <Sunrise size={17} />
                </RowIcon>
              }
              title="Sunday recap"
              trailing={
                <Switch label="Sunday recap" checked={notify.recap} onChange={(v) => setNotify({ ...notify, recap: v })} />
              }
            />
          </ListGroup>
        </motion.div>

        <motion.div variants={fadeUp}>
          <ListGroup header="Schedule">
            <ListRow
              icon={
                <RowIcon color="var(--task-blue)">
                  <CalendarClock size={17} />
                </RowIcon>
              }
              title="Planning hours"
              trailing={
                <span className="text-secondary-label">
                  {now ? `${formatClock(7 * 60)} – ${formatClock(23 * 60)}` : "…"}
                </span>
              }
            />
            <div className="flex items-center gap-3 px-4 py-2.5">
              <RowIcon color="var(--task-teal)">
                <CalendarClock size={17} />
              </RowIcon>
              <span className="flex-1 text-body">Week starts</span>
              <SegmentedControl
                label="Week starts on"
                className="w-40"
                value={weekStart}
                onChange={setWeekStart}
                options={[
                  { value: "mon", label: "Mon" },
                  { value: "sun", label: "Sun" },
                ]}
              />
            </div>
            <ListRow
              icon={
                <RowIcon color="var(--task-indigo)">
                  <Globe size={17} />
                </RowIcon>
              }
              title="Time zone"
              trailing={<span className="max-w-40 truncate text-secondary-label">{timeZone}</span>}
            />
          </ListGroup>
        </motion.div>

        <motion.div variants={fadeUp}>
          <ListGroup header="About">
            <ListRow
              href="/design"
              icon={
                <RowIcon color="var(--task-pink)">
                  <Palette size={17} />
                </RowIcon>
              }
              title="Design system"
              detail="Colors, type, components"
            />
            <ListRow
              icon={
                <RowIcon color="var(--task-green)">
                  <Shield size={17} />
                </RowIcon>
              }
              title="Privacy policy"
              trailing={<span className="text-footnote text-tertiary-label">Phase 10</span>}
            />
            <ListRow
              icon={
                <RowIcon color="var(--secondary-label)">
                  <FileText size={17} />
                </RowIcon>
              }
              title="Terms of service"
              trailing={<span className="text-footnote text-tertiary-label">Phase 10</span>}
            />
          </ListGroup>
        </motion.div>

        <motion.div variants={fadeUp} className="flex flex-col items-center gap-2">
          <Button variant="danger" size="lg" disabled>
            Sign out
          </Button>
          <span className="text-caption text-tertiary-label">Auto-Planner 0.2 · preview build</span>
        </motion.div>
      </motion.div>
    </LargeTitlePage>
  );
}

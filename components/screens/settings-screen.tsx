"use client";

import { Bell, Cloud, HardDrive, CalendarClock, Eye, FileText, Globe, Mail, MapPin, Moon, Palette, Pencil, Shield, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { signOutAction } from "@/app/actions/auth";
import { removeAvatarAction, saveSettingsAction, updateProfileAction, uploadAvatarAction } from "@/app/actions/profile";
import { InstallPrompt } from "@/components/planner/install-prompt";
import { PlaceFields } from "@/components/planner/place-fields";
import { UsernameHint, useUsernameStatus } from "@/components/planner/username-check";
import { useTheme } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card, ListGroup, ListRow, RowIcon } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useAccount } from "@/lib/auth/account-context";
import { clearProfile, useProfile } from "@/lib/auth/profile";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, stagger } from "@/lib/design/motion";
import { usePlanner, type Prefs } from "@/lib/planner/store";
import type { ThemePreference } from "@/lib/theme";

const LEAD_TIMES = [5, 10, 15, 30];

/** Every time zone this browser knows. Browser-only (null on the server), so
 * the server and browser HTML always match even if their lists differ. */
let zoneList: string[] | null = null;
function useTimeZoneList(): string[] | null {
  return useSyncExternalStore(
    () => () => {},
    () => (zoneList ??= Intl.supportedValuesOf("timeZone")),
    () => null,
  );
}

/**
 * SETTINGS: profile (photo, name, city), appearance, email notifications and
 * privacy. Planning is 24/7, so there are no "planning hours" to set.
 * Notifications go to your email until there's an installed app.
 */
export function SettingsScreen() {
  const entrance = useEntrance();
  const toast = useToast();
  const { preference, setPreference } = useTheme();
  const account = useAccount();
  const localProfile = useProfile();
  const { mode, profile, prefs, setPrefs, weekStartsOn, setWeekStartsOn, timeZone } = usePlanner();
  const zones = useTimeZoneList();
  const [editing, setEditing] = useState(false);
  // Bumped on each open so the edit form starts from the saved profile.
  const [editKey, setEditKey] = useState(0);

  const name = account ? (profile?.displayName ?? account.displayName) : (localProfile?.name ?? "Guest");
  const where = profile ? [profile.city, profile.region].filter(Boolean).join(", ") : "";

  async function save(patch: Partial<Prefs>) {
    const res = await setPrefs(patch);
    if (!res.ok) toast(res.error);
  }

  return (
    <LargeTitlePage title="Settings">
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-7">
        <motion.div variants={fadeUp}>
          <Card className="flex items-center gap-4">
            <Avatar name={name} color={profile?.avatarColor ?? "blue"} src={profile?.avatarUrl} size={60} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-title3">{name}</div>
              {profile?.handle && !profile.handle.startsWith("user_") && (
                <div className="truncate text-subhead text-tint" data-testid="my-username">
                  @{profile.handle}
                </div>
              )}
              <div className="truncate text-subhead text-secondary-label">
                {account ? account.email : localProfile ? `${localProfile.email} · demo` : "Exploring without an account"}
              </div>
              {where && (
                <div className="mt-0.5 flex items-center gap-1 truncate text-footnote text-secondary-label">
                  <MapPin aria-hidden size={12} /> {where}
                </div>
              )}
            </div>
            {mode === "remote" && (
              <Button
                variant="tinted"
                size="icon"
                aria-label="Edit profile"
                onClick={() => {
                  setEditKey((k) => k + 1);
                  setEditing(true);
                }}
              >
                <Pencil size={18} />
              </Button>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <InstallPrompt />
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
          {prefs && account ? (
            <ListGroup
              header="Email notifications"
              footer={`Sent to ${account.email}. Push notifications come with the installed app.`}
            >
              <ListRow
                icon={
                  <RowIcon color="var(--task-red)">
                    <Bell size={17} />
                  </RowIcon>
                }
                title="Upcoming blocks"
                trailing={
                  <Switch label="Upcoming blocks" checked={prefs.notifyUpcoming} onChange={(v) => void save({ notifyUpcoming: v })} />
                }
              />
              {prefs.notifyUpcoming && (
                <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
                  <span className="mr-1 shrink-0 text-subhead text-secondary-label">Email me</span>
                  {LEAD_TIMES.map((m) => (
                    <Chip key={m} group="lead" selected={prefs.reminderLeadMinutes === m} onClick={() => void save({ reminderLeadMinutes: m })}>
                      {m} min before
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
                title="Missed blocks"
                detail="When a block ends unfinished"
                trailing={<Switch label="Missed blocks" checked={prefs.notifyMissed} onChange={(v) => void save({ notifyMissed: v })} />}
              />
              <ListRow
                icon={
                  <RowIcon color="var(--task-green)">
                    <Users size={17} />
                  </RowIcon>
                }
                title="Friend requests"
                trailing={
                  <Switch label="Friend requests" checked={prefs.notifyFriends} onChange={(v) => void save({ notifyFriends: v })} />
                }
              />
            </ListGroup>
          ) : (
            <ListGroup header="Email notifications">
              <ListRow
                icon={
                  <RowIcon color="var(--task-red)">
                    <Mail size={17} />
                  </RowIcon>
                }
                title="Reminders by email"
                detail="Create an account to get them"
                href="/"
              />
            </ListGroup>
          )}
        </motion.div>

        <motion.div variants={fadeUp}>
          <ListGroup header="Your data">
            <ListRow
              icon={
                <RowIcon color={mode === "remote" ? "var(--task-green)" : "var(--task-orange)"}>
                  {mode === "remote" ? <Cloud size={17} /> : <HardDrive size={17} />}
                </RowIcon>
              }
              title="Saved to"
              trailing={
                <span className="text-secondary-label" data-testid="saved-to">
                  {mode === "remote" ? "Your account" : "This device only"}
                </span>
              }
            />
          </ListGroup>
        </motion.div>

        <motion.div variants={fadeUp}>
          <ListGroup header="Calendar">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <RowIcon color="var(--task-teal)">
                <CalendarClock size={17} />
              </RowIcon>
              <span className="flex-1 text-body">Week starts</span>
              <SegmentedControl
                label="Week starts on"
                className="w-40"
                value={weekStartsOn === 7 ? "sun" : "mon"}
                onChange={(v) => void setWeekStartsOn(v === "sun" ? 7 : 1)}
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
              trailing={
                mode === "remote" && zones ? (
                  <select
                    aria-label="Time zone"
                    value={timeZone}
                    onChange={async (e) => {
                      const res = await saveSettingsAction({ timeZone: e.target.value }).catch(() => ({ ok: false as const }));
                      // Times everywhere are shown in this zone, so reload with it.
                      if (res.ok) window.location.reload();
                      else toast("Couldn't change the time zone.");
                    }}
                    className="max-w-44 truncate bg-transparent text-right text-secondary-label outline-none"
                  >
                    {[timeZone, ...zones.filter((z) => z !== timeZone)].map((z) => (
                      <option key={z} value={z}>
                        {z.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="max-w-44 truncate text-secondary-label">{timeZone.replaceAll("_", " ")}</span>
                )
              }
            />
          </ListGroup>
        </motion.div>

        {prefs && (
          <motion.div variants={fadeUp}>
            <ListGroup header="Privacy" footer="Lets friends of friends and people in your city see you in “People you may know”.">
              <ListRow
                icon={
                  <RowIcon color="var(--task-purple)">
                    <Eye size={17} />
                  </RowIcon>
                }
                title="Suggest me to others"
                trailing={
                  <Switch label="Suggest me to others" checked={prefs.discoverable} onChange={(v) => void save({ discoverable: v })} />
                }
              />
            </ListGroup>
          </motion.div>
        )}

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
              trailing={<span className="text-footnote text-tertiary-label">Coming soon</span>}
            />
            <ListRow
              icon={
                <RowIcon color="var(--secondary-label)">
                  <FileText size={17} />
                </RowIcon>
              }
              title="Terms of service"
              trailing={<span className="text-footnote text-tertiary-label">Coming soon</span>}
            />
          </ListGroup>
        </motion.div>

        <motion.div variants={fadeUp} className="flex flex-col items-center gap-2">
          <Button
            variant={account || localProfile ? "danger" : "filled"}
            size="lg"
            onClick={() => {
              clearProfile();
              // Signs out of Supabase, forgets demo mode, and redirects to "/".
              void signOutAction();
            }}
          >
            {account || localProfile ? "Sign out" : "Create an account"}
          </Button>
          <span className="text-caption text-tertiary-label">Auto-Planner 0.3 · preview build</span>
        </motion.div>
      </motion.div>

      {mode === "remote" && profile && <EditProfileSheet key={editKey} open={editing} onOpenChange={setEditing} />}
    </LargeTitlePage>
  );
}

/** Change photo, name and city. */
function EditProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const { profile, setProfile } = usePlanner();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const handleStatus = useUsernameStatus(handle, { unchanged: handle.trim().toLowerCase() === profile?.handle });
  const [city, setCity] = useState(profile?.city ?? "");
  const [region, setRegion] = useState(profile?.region ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!profile) return null;

  async function upload(photo: Blob) {
    if (!profile) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", photo, "avatar.jpg");
    const res = await uploadAvatarAction(form).catch(() => ({ ok: false as const, error: "Couldn't upload the photo." }));
    setUploading(false);
    if (res.ok) setProfile({ ...profile, avatarUrl: res.url });
    toast(res.ok ? "Photo updated" : res.error);
  }

  async function removePhoto() {
    if (!profile) return;
    const res = await removeAvatarAction().catch(() => ({ ok: false as const, error: "Couldn't remove the photo." }));
    if (res.ok) setProfile({ ...profile, avatarUrl: null });
    toast(res.ok ? "Photo removed" : res.error);
  }

  async function save() {
    if (!profile) return;
    if (handleStatus.state === "taken" || handleStatus.state === "invalid") {
      toast(handleStatus.message ?? "Pick another username");
      return;
    }
    setSaving(true);
    const newHandle = handle.trim().toLowerCase();
    const res = await updateProfileAction({
      displayName: name,
      city,
      region,
      ...(newHandle !== profile.handle ? { username: newHandle } : {}),
    }).catch(() => ({
      ok: false as const,
      error: "Couldn't reach the server.",
    }));
    setSaving(false);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    setProfile({ ...profile, displayName: name.trim(), handle: newHandle, city: city.trim() || null, region: region || null });
    toast("Profile saved");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Edit profile">
      <div className="flex flex-col gap-5 pt-1">
        <AvatarPicker name={name} color={profile.avatarColor} src={profile.avatarUrl} busy={uploading} onPicked={(p) => void upload(p)} />
        {profile.avatarUrl && (
          <Button variant="plain" size="sm" className="self-center" onClick={() => void removePhoto()}>
            Remove photo
          </Button>
        )}
        <label className="glass-card flex items-center rounded-2xl px-4 py-3">
          <span className="sr-only">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            autoComplete="name"
            placeholder="Your name"
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-tertiary-label"
          />
        </label>
        <div>
          <label className="glass-card flex items-center gap-0.5 rounded-2xl px-4 py-3">
            <span className="sr-only">Username</span>
            <span aria-hidden className="text-body text-tertiary-label">
              @
            </span>
            <input
              value={handle.startsWith("user_") ? "" : handle}
              onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
              maxLength={20}
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="username"
              placeholder="pick a username"
              aria-label="Username"
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-tertiary-label"
            />
          </label>
          {handle.trim() !== "" && !handle.startsWith("user_") && <UsernameHint status={handleStatus} name={handle} />}
        </div>
        <PlaceFields city={city} region={region} onCity={setCity} onRegion={setRegion} />
        <Button size="lg" disabled={saving || name.trim().length === 0} onClick={() => void save()}>
          Save
        </Button>
        <p className="text-center text-footnote text-secondary-label">
          Your city is only used to suggest people near you.{" "}
          <Link href="/friends" className="text-tint" onClick={() => onOpenChange(false)}>
            See suggestions
          </Link>
        </p>
      </div>
    </Sheet>
  );
}

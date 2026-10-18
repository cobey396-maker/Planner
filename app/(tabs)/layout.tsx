import { LevelUp, MissedNotice } from "@/components/planner/level-up";
import { TabTour } from "@/components/planner/tab-tour";
import { TimeZoneCheck } from "@/components/planner/time-zone-check";
import { TabBar } from "@/components/ui/tab-bar";
import { AccountProvider } from "@/lib/auth/account-context";
import { getAccount } from "@/lib/auth/session";
import { loadPlannerData } from "@/lib/planner/load";
import { EMPTY_PLANNER, PlannerProvider, type InitialPlannerData } from "@/lib/planner/store";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared shell for the five main tabs. "(tabs)" in parentheses is a Next.js
 * ROUTE GROUP: it organizes files without adding "/tabs" to the URL.
 *
 * A layout is NOT re-mounted when you navigate between its pages, so the
 * planner state survives tab switches and the tab bar's lens can animate.
 *
 * As a Server Component it loads the signed-in user's real data (in
 * parallel, under row-level security) and hands it to the client store.
 * Without an account (demo mode / "Explore") everything starts empty.
 */
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  let initial: InitialPlannerData = EMPTY_PLANNER;
  let databaseOutdated = false;

  if (account) {
    const supabase = await createClient();
    const data = await loadPlannerData(supabase!, account.id);
    databaseOutdated = data.databaseOutdated;
    initial = {
      timeZone: data.settings.timeZone,
      weekStartsOn: data.settings.weekStartsOn,
      profile: data.profile,
      blocks: data.blocks,
      pointsTotal: data.pointsTotal,
      friends: data.friends,
      requests: data.requests,
      suggestions: data.suggestions,
      inviteCode: data.inviteCode,
      hangouts: data.hangouts,
      hasAcceptedHangout: data.hasAcceptedHangout,
      flameStyle: data.flameStyle,
      title: data.title,
      leaderboard: data.leaderboard,
      missed: data.missed,
      prefs: {
        notifyUpcoming: data.settings.notifyUpcoming,
        notifyMissed: data.settings.notifyMissed,
        notifyFriends: data.settings.notifyFriends,
        reminderLeadMinutes: data.settings.reminderLeadMinutes,
        discoverable: data.settings.discoverable,
      },
    };
  }

  return (
    <AccountProvider account={account}>
      <PlannerProvider initial={initial} mode={account ? "remote" : "local"}>
        {databaseOutdated && (
          <div role="alert" className="pt-safe mx-auto max-w-2xl px-4">
            <div className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger">
              <strong>Your database needs an update.</strong> Some features won&apos;t save until you run{" "}
              <code className="font-mono">npm.cmd run db:migrate</code> in the project folder, then restart the app.
            </div>
          </div>
        )}
        <TimeZoneCheck />
        {children}
        <TabBar />
        <LevelUp />
        <MissedNotice />
        <TabTour accountTourDone={account ? account.tourDone : null} />
      </PlannerProvider>
    </AccountProvider>
  );
}

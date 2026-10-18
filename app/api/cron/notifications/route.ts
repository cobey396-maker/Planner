import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email/send";
import { missedEmail, upcomingEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * EMAIL NOTIFICATIONS JOB
 *
 * Something calls this URL every few minutes (Supabase pg_cron or an
 * external scheduler; see DATABASE.md) with "Authorization: Bearer
 * <CRON_SECRET>". It asks the database to CLAIM everything due (claim
 * stamps each block, so nothing is ever sent twice) and emails each one.
 */
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // Constant-time comparison: no leaking the secret through response timing.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin || !emailConfigured()) {
    return NextResponse.json({ error: "Email isn't configured (SUPABASE_SECRET_KEY, RESEND_API_KEY, NOTIFY_FROM_EMAIL)." }, { status: 503 });
  }

  const { data, error } = await admin.rpc("claim_notifications");
  if (error) return NextResponse.json({ error: "claim failed" }, { status: 500 });

  type Row = { kind: string; email: string; display_name: string; title: string; starts_at: string; time_zone: string };
  let sent = 0;
  for (const row of (data ?? []) as Row[]) {
    const params = {
      name: row.display_name,
      title: row.title,
      startsAt: Date.parse(row.starts_at),
      timeZone: row.time_zone,
      appUrl: appUrl(),
    };
    const email = row.kind === "upcoming" ? upcomingEmail(params) : missedEmail(params);
    if (await sendEmail(row.email, email)) sent++;
  }
  return NextResponse.json({ claimed: data?.length ?? 0, sent });
}

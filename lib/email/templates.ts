/**
 * Email content. Pure functions, so they're unit-tested.
 *
 * Anything a user typed (task titles, names) is HTML-escaped: a task called
 * <img src=x onerror=...> must show up as text, not run in an inbox.
 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type Email = { subject: string; html: string; text: string };

function layout(heading: string, body: string, appUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,Inter,Segoe UI,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<div style="background:#fff;border-radius:20px;padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;color:#000">${heading}</h1>
<div style="font-size:16px;line-height:1.5;color:#3c3c43">${body}</div>
<a href="${escapeHtml(appUrl)}/today" style="display:inline-block;margin-top:20px;background:#007aff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Open Auto-Planner</a>
</div>
<p style="font-size:12px;color:#8e8e93;text-align:center;margin-top:16px">You can turn these emails off in Settings.</p>
</div></body></html>`;
}

function clock(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(ms);
}

export function upcomingEmail(p: { name: string; title: string; startsAt: number; timeZone: string; appUrl: string }): Email {
  const when = clock(p.startsAt, p.timeZone);
  const title = escapeHtml(p.title);
  return {
    subject: `Starting soon: ${p.title} at ${when}`,
    html: layout("Starting soon ⏰", `Hey ${escapeHtml(p.name)}, <b>${title}</b> starts at <b>${when}</b>.`, p.appUrl),
    text: `Hey ${p.name}, "${p.title}" starts at ${when}. ${p.appUrl}/today`,
  };
}

export function missedEmail(p: { name: string; title: string; startsAt: number; timeZone: string; appUrl: string }): Email {
  const when = clock(p.startsAt, p.timeZone);
  const title = escapeHtml(p.title);
  return {
    subject: `Missed: ${p.title}`,
    html: layout(
      "No stress, it happens 🙂",
      `Looks like <b>${title}</b> (planned for ${when}) didn't get checked off. Open the app to mark it done or find it a new time.`,
      p.appUrl,
    ),
    text: `"${p.title}" (planned for ${when}) wasn't checked off. ${p.appUrl}/today`,
  };
}

export function friendRequestEmail(p: { recipient: string; requester: string; appUrl: string }): Email {
  return {
    subject: `${p.requester} wants to be friends on Auto-Planner`,
    html: layout(
      "New friend request 👋",
      `Hey ${escapeHtml(p.recipient)}, <b>${escapeHtml(p.requester)}</b> sent you a friend request. Friends can find free time together.`,
      p.appUrl,
    ),
    text: `${p.requester} sent you a friend request on Auto-Planner. ${p.appUrl}/friends`,
  };
}

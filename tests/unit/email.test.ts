import { describe, expect, it } from "vitest";
import { escapeHtml, friendRequestEmail, missedEmail, upcomingEmail } from "@/lib/email/templates";

const base = { name: "Cobey", startsAt: Date.parse("2026-10-14T23:00:00Z"), timeZone: "America/Chicago", appUrl: "https://planner.app" };

describe("email templates", () => {
  it("say when, in the user's own time zone", () => {
    const e = upcomingEmail({ ...base, title: "Calc problem set" });
    expect(e.subject).toBe("Starting soon: Calc problem set at 6:00 PM");
    expect(e.html).toContain("https://planner.app/today");
  });

  it("escape anything a user typed, so emails can't carry injected HTML", () => {
    const e = missedEmail({ ...base, title: '<img src=x onerror="alert(1)">' });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(friendRequestEmail({ recipient: "<b>", requester: "Eve & Co", appUrl: "https://planner.app" }).html).toContain("Eve &amp; Co");
  });

  it("escapeHtml covers the five dangerous characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

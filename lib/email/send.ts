import "server-only";
import type { Email } from "./templates";

/**
 * Sends an email through Resend's HTTP API (resend.com, free tier).
 * Needs RESEND_API_KEY and NOTIFY_FROM_EMAIL (an address on a domain you
 * verified in Resend, e.g. "Auto-Planner <hello@yourdomain.com>").
 * Returns false instead of throwing, so one bad email never breaks a job.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM_EMAIL);
}

export async function sendEmail(to: string, email: Email): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM_EMAIL, to, subject: email.subject, html: email.html, text: email.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
}

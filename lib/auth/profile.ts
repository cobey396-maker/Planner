"use client";

import { useSyncExternalStore } from "react";

/**
 * TEMPORARY local profile, until real accounts exist (Phase 3).
 *
 * After "signing up" we remember only the name and email in localStorage so
 * the app can greet you. The password is never stored anywhere. In Phase 3
 * this is replaced by the Supabase session.
 */
export type Profile = { name: string; email: string };

const KEY = "profile";
const EVENT = "profilechange";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage blocked (private mode): the app still works, just without a name.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Parse defensively: storage can hold anything (old versions, manual edits). */
export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      typeof (value as Profile).name === "string" &&
      typeof (value as Profile).email === "string"
    ) {
      return { name: (value as Profile).name, email: (value as Profile).email };
    }
  } catch {}
  return null;
}

/** The raw string is the snapshot (stable between reads), parsed per render. */
export function useProfile(): Profile | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return parseProfile(raw);
}

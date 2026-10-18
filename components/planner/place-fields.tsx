"use client";

import { MapPin } from "lucide-react";
import { OUTSIDE_US, US_STATES } from "@/lib/geo";

/**
 * City + state inputs, shared by onboarding and Settings. Both are optional:
 * they only power "people near you" suggestions on the Friends tab.
 */
export function PlaceFields({
  city,
  region,
  onCity,
  onRegion,
}: {
  city: string;
  region: string;
  onCity: (v: string) => void;
  onRegion: (v: string) => void;
}) {
  return (
    <div className="glass-card overflow-hidden rounded-2xl [&>*+*]:border-t [&>*+*]:border-separator">
      <label className="flex items-center gap-3 px-4 py-3">
        <MapPin aria-hidden size={20} className="shrink-0 text-tint" />
        <span className="sr-only">City</span>
        <input
          value={city}
          onChange={(e) => onCity(e.target.value)}
          maxLength={60}
          autoComplete="address-level2"
          placeholder="City"
          className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-tertiary-label"
        />
      </label>
      <label className="flex items-center gap-3 px-4 py-3">
        <span aria-hidden className="w-5 shrink-0" />
        <span className="sr-only">State</span>
        <select
          value={region}
          onChange={(e) => onRegion(e.target.value)}
          autoComplete="address-level1"
          className={`min-w-0 flex-1 bg-transparent text-body outline-none ${region ? "" : "text-tertiary-label"}`}
        >
          <option value="">State</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={OUTSIDE_US}>{OUTSIDE_US}</option>
        </select>
      </label>
    </div>
  );
}

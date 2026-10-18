/**
 * PAID FEATURES (placeholder).
 *
 * The Schedule Helper will become a paid feature. Every check goes through
 * this one function, so adding the paywall later (e.g. a `plan` column on
 * the profile, set by a payment webhook) is a change here only. For now,
 * every signed-in account has access.
 */
export type Feature = "schedule_helper";

export function hasFeature(_feature: Feature, account: { id: string } | null): boolean {
  return account !== null;
}

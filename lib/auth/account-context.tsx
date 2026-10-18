"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Account } from "./session";

/**
 * The signed-in account, handed from the server (app/(tabs)/layout.tsx) to
 * client components like Settings. null = guest (demo mode or "Explore").
 */
const AccountContext = createContext<Account | null>(null);

export function AccountProvider({ account, children }: { account: Account | null; children: ReactNode }) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

export function useAccount(): Account | null {
  return useContext(AccountContext);
}

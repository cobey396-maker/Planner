import type { Metadata } from "next";
import { DesignStates } from "@/components/design/states";

export const metadata: Metadata = { title: "States & feedback" };

export default function Page() {
  return <DesignStates />;
}

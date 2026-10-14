import type { Metadata } from "next";
import { DesignComponents } from "@/components/design/components";

export const metadata: Metadata = { title: "Components" };

export default function Page() {
  return <DesignComponents />;
}
